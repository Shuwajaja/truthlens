"""Small approval gate (D16, D17, D30): a controlled action is executed only by TruthLens itself and only
after a human approval for exactly this action hash that is unexpired, not simulated and not yet consumed.

Flow: `truthlens act` -> action.requested + action.blocked, exit 3, command NOT run.
`truthlens approve <hash>` (human, outside the agent env; signed if the ledger uses HMAC) -> approval.granted.
`truthlens act` again -> finds the approval, runs the command, writes action.executed (consumes it).
"""

from __future__ import annotations

import hashlib
import re
import subprocess
from datetime import UTC, datetime, timedelta

from truthlens.canonical import canonical_bytes
from truthlens.ledger import Ledger, LedgerError, _parse_ts, verify

_SHORT_OPT_PATH = re.compile(r"^(-[A-Za-z])(/.*)$")
_SHORT_OPT_ANY = re.compile(r"^(-[A-Za-z])(.+)$")
SHELL_NAMES = frozenset({"sh", "bash", "dash", "zsh", "ksh", "fish", "busybox"})

# Options whose value names a file the tool then reads (config/ini/plugin/rootdir). Unlike a plain
# positional write target, such a file changes a gated action's behaviour without changing its hash, so an
# absolute value outside the tree is refused whether or not the file exists yet (#83).
_CFG_FILE_OPTS = frozenset({"-c", "--config", "--config-file", "-o", "--override-ini", "-p",
                            "--rootdir", "--confcutdir"})
_INI_VALUE_OPTS = frozenset({"-o", "--override-ini"})  # `key=<value>`, the value is a whitespace list
_INI_KEY_OK = re.compile(r"^[A-Za-z0-9_.-]+$")  # a config key such as `pythonpath`, not a path


def _shell_value_paths(opt: str, val: str):
    """The path strings pytest reads from a config-like option value, using pytest's own parsing (measured
    against pytest 9.1.1): `-o`/`--override-ini` read `key=<value>` whose value is shell-like - only
    whitespace splits it, quotes group a path with spaces and a backslash escape is resolved, exactly what
    `shlex` does - while every other option takes one literal path. Returns None when the shell-like read is
    impossible (unbalanced quote), so the caller can fail closed (#83)."""
    import shlex
    if opt not in _INI_VALUE_OPTS:
        return [val.strip().strip('"').strip("'")]
    body = val
    if "=" in body and not body.startswith("="):
        k, v = body.split("=", 1)
        if _INI_KEY_OK.fullmatch(k):
            body = v
    try:
        return shlex.split(body)
    except ValueError:
        return None


def _shell_map(body: str, root: str, td: str) -> tuple[str, bool]:
    """Rewrite every absolute in-tree path of a shell-like value onto the approved copy, re-quoting each token
    so the child process reads exactly one path per token. Returns (new_body, changed)."""
    import os
    import shlex
    try:
        toks = shlex.split(body)
    except ValueError:
        return body, False
    out, changed = [], False
    for t in toks:
        rel = _in_tree(t, root) if os.path.isabs(t) else None
        if rel is not None:
            out.append(shlex.quote(os.path.normpath(os.path.join(td, rel))))
            changed = True
        else:
            out.append(shlex.quote(t))
    return (" ".join(out), True) if changed else (body, False)


def _map_argv(args: list[str], root: str, td: str) -> list[str]:
    """Rewrite every argv element onto the approved copy: absolute in-tree paths in plain options and in the
    shell-like value of an INI option (`-o key=<value>`, `--override-ini=key=<value>`) are mapped, so no
    element can still reach the live tree (#83)."""
    import os
    out = []
    ini_next = False
    for a in args:
        if ini_next:
            ini_next = False
            if "=" in a and not a.startswith("="):
                k, v = a.split("=", 1)
                if _INI_KEY_OK.fullmatch(k):
                    nv, ch = _shell_map(v, root, td)
                    out.append(k + "=" + nv if ch else a)
                    continue
            nv, ch = _shell_map(a, root, td)
            out.append(nv if ch else a)
            continue
        if a in _INI_VALUE_OPTS:
            ini_next = True
            out.append(a)
            continue
        if "=" in a and not a.startswith("="):
            k, v = a.split("=", 1)
            if k in _INI_VALUE_OPTS and "=" in v and not v.startswith("="):
                k2, v2 = v.split("=", 1)
                if _INI_KEY_OK.fullmatch(k2):
                    nv, ch = _shell_map(v2, root, td)
                    out.append(k + "=" + k2 + "=" + (nv if ch else v2))
                    continue
        out.append(_map_path_arg(a, lambda p: os.path.join(td, rel) if (rel := _in_tree(p, root)) is not None else None))
    return out


def _live_path_hits(arg: str, root: str, td: str):
    """Absolute candidates in an argv element that still resolve into the LIVE tree and were not mapped into
    the approved copy, using the same shell-like tokenization as the config check (defense in depth)."""
    import os
    import shlex
    # Only an INI-style value (`-o key=<value>`, `--override-ini=key=<value>`) is parsed shell-like by pytest,
    # so only there may a whitespace-split hide a live path. A literal option value (`-c 'dir with space'`) is
    # ONE path and must not be split here, otherwise a legitimate in-tree value is misread as external (#83).
    if "=" not in arg or arg.startswith("="):
        return
    cands = [arg]
    body = arg
    for _ in range(3):  # `--override-ini=pythonpath=<value>` nests key= levels
        if "=" in body and not body.startswith("="):
            k, v = body.split("=", 1)
            if _INI_KEY_OK.fullmatch(k) or k in _INI_VALUE_OPTS:
                cands.append(v)
                body = v
                continue
        break
    try:
        cands.extend(shlex.split(body))
    except ValueError:
        pass
    for c in list(cands):
        cands.extend(_opt_value_paths(c, commas=True))
    seen = set()
    for c in cands:
        if not c or not os.path.isabs(c) or c.startswith(td) or c in seen:
            continue
        seen.add(c)
        real = os.path.realpath(c)
        if real == root or real.startswith(root + os.sep):
            yield c


def _opt_value_paths(val: str, commas: bool = False) -> list[str]:
    """Every path candidate a config-like option value could name, with quotes stripped. The whole value, the
    part after a `key=` prefix and each whitespace/`:`/`;`-separated piece are returned, because a config value
    can be a list (`-o pythonpath=<a> <b>`, `<a>:<b>`, `"<a>"`). Returning all of them - instead of guessing
    one separator - is what makes the check fail closed: a comma stays a path character (`<tree>,evil`), and a
    leading path before an `=` (`/tmp/missing=hidden.ini`) is still seen (#83)."""
    out = [val]
    # main-compatible split on the RAW value first: a space or a quote inside a candidate stays part
    # of it, so this branch alone is never looser than the previous implementation (#83 review).
    out += re.split(r"[=:,]", val)
    body = val.replace('"', " ").replace("'", " ")
    if "=" in body and not body.startswith("="):
        out.append(body.split("=", 1)[1])
    # The alias check must stay at least as strict as main: it keeps every candidate (the whole value and
    # the part after `=`, so a path containing a space or a quote is still checked) and ALSO splits at
    # every `=`, `:` and `,` - more candidates, never fewer (#83 review round 8).
    out += re.split(r"[\s=:,]+" if commas else r"[\s:;]+", body)
    # Candidates are NOT trimmed: main keeps a trailing space as part of a candidate, and a symlink whose
    # name ends in a space must stay detectable. A wider split already covers the trimmed reading (#83).
    return [p for p in out if p and p != "="]


def _refuse_cfg_path(opt: str, val: str, root: str, arg: str) -> None:
    """Refuse a config-like value naming anything outside the tree, using pytest's own value parsing (measured
    against pytest 9.1.1): `-o`/`--override-ini` read `key=<value>` whose value is shell-like (see
    `_shell_value_paths`), every other option one literal path. An absolute candidate must resolve into the
    tree lexically (existence is irrelevant); a relative one must not contain a `..` component, because the
    action runs inside the materialized copy, where `..` reaches the live parent tree. A plain in-tree value
    such as `cfg/pytest.ini` stays usable, and a value pytest could not parse shell-like is refused (#83)."""
    import os
    paths = _shell_value_paths(opt, val)
    if paths is None:
        raise LedgerError(f"config file outside the working tree in gated action: {arg} {val}".strip())
    for cand in paths:
        if not cand:
            continue
        # Lexical normalization against the root, exactly like origin/main's check: a relative candidate is
        # resolved against the root, so `sub/../safe` stays in-tree and usable, `../outside` and
        # `sub,../../etc` (a comma is a path character, measured against pytest 9.1.1) climb out and are
        # refused. Existence is irrelevant, so a not-yet-existing target is refused too (#83).
        norm = os.path.normpath(cand if os.path.isabs(cand) else os.path.join(root, cand))
        if not (norm == root or norm.startswith(root + os.sep)):
            raise LedgerError(f"config file outside the working tree in gated action: {arg} {val}".strip())
def _has_path(s: str, p: str) -> bool:
    """True if path p occurs in s as a whole path (followed by end, '/', or a separator), not as a prefix of a
    sibling like p + '-flag'."""
    import re as _re
    return bool(p) and _re.search(_re.escape(p) + r"(?![^/\s:;,'\"=)])", s) is not None

def _iter_abs_pairs(tok: str):
    """Yield (prefix, abs_path) for each absolute-path form in an argv token:
    the whole token, after '=', and after a leading short option -X (single-dash + one letter).
    """
    import os
    m = _SHORT_OPT_PATH.match(tok)
    if m:
        yield m.group(1), m.group(2)
    if "=" in tok and not tok.startswith("="):
        opt, val = tok.split("=", 1)
        if val and os.path.isabs(val):
            yield opt + "=", val
    if os.path.isabs(tok):
        yield "", tok


def _iter_path_pairs(tok: str):
    """Yield (prefix, value) for every path-position candidate in an argv token: the value attached to a
    leading short option -X (single dash + one letter), the value after the first '=', and the whole token."""
    m = _SHORT_OPT_ANY.match(tok)
    if m:
        yield m.group(1), m.group(2)
    if "=" in tok and not tok.startswith("="):
        opt, val = tok.split("=", 1)
        if val:
            yield opt + "=", val
    yield "", tok


def _map_path_arg(tok: str, resolve) -> str:
    """Rewrite an argv token: for each absolute-path form try resolve(prefix+path); if resolve
    returns a non-None string (the copy path), replace the form's value.
    If none match, return tok unchanged.
    """
    for prefix, val in _iter_abs_pairs(tok):
        repl = resolve(val)
        if repl is not None:
            return prefix + repl
    return tok

APPROVAL_TTL = timedelta(minutes=10)  # D6
BLOCKED = 3


MAX_SNAPSHOT_BYTES, MAX_SNAPSHOT_FILES = 64 * 1024 * 1024, 20000


def snapshot(cwd: str, exclude: set[str] = frozenset()) -> dict[str, tuple[str, bytes, int]]:
    """Immutable copy source for gated execution: rel path -> (kind, bytes, mode) for files, symlinks and
    directories (incl. empty ones) of the whole cwd tree, minus `.git` (dir or worktree file). Modes are bound
    too (chmod +x changes the hash). Symlinks must stay inside the tree; absolute targets are stored relative,
    so the copy never points back into the live tree."""
    import os
    import stat
    root = os.path.realpath(cwd)
    out: dict[str, tuple[str, bytes, int]] = {}
    total = 0
    for dp, dns, fns in os.walk(root):
        dns[:] = sorted(d for d in dns if d != ".git")
        for d in dns:
            f = os.path.join(dp, d)
            if not os.path.islink(f):
                out[os.path.relpath(f, root)] = ("dir", b"", os.stat(f).st_mode & 0o7777)
        for n in sorted(n for n in fns if n != ".git") + [d for d in dns if os.path.islink(os.path.join(dp, d))]:
            f = os.path.join(dp, n)
            rel = os.path.relpath(f, root)
            if f in exclude:
                continue
            if os.path.islink(f):
                tgt = os.path.realpath(f)
                if not (tgt == root or tgt.startswith(root + os.sep)):
                    raise LedgerError(f"symlink points outside the working tree: {rel}")
                out[rel] = ("link", os.path.relpath(tgt, os.path.dirname(f)).encode(), 0o777)
            else:
                try:
                    fd = os.open(f, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
                except OSError:
                    continue
                with os.fdopen(fd, "rb") as fh:
                    st = os.fstat(fh.fileno())
                    if not stat.S_ISREG(st.st_mode):
                        continue  # FIFOs/devices are not copied, so the action cannot use them either
                    data = fh.read(MAX_SNAPSHOT_BYTES - total + 1)
                total += len(data)
                out[rel] = ("file", data, st.st_mode & 0o7777)
            if total > MAX_SNAPSHOT_BYTES or len(out) > MAX_SNAPSHOT_FILES:
                raise LedgerError("working tree too large for a gated snapshot; run the action from a smaller dir")
    return out


def _materialize(snap: dict, td: str) -> None:
    import os
    for rel, (kind, _, mode) in sorted(snap.items()):
        if kind == "dir":
            os.makedirs(os.path.join(td, rel), exist_ok=True)
            os.chmod(os.path.join(td, rel), mode | 0o700)
    for rel, (kind, data, mode) in snap.items():
        dst = os.path.join(td, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if kind == "link":
            os.symlink(data.decode(), dst)
        elif kind == "file":
            fd = os.open(dst, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, "wb") as fh:
                fh.write(data)
            os.chmod(dst, mode)


def _in_tree(arg: str, root: str) -> str | None:
    """Lexical (no live symlink is followed) relative path of `arg` inside root, or None."""
    import os
    p = os.path.normpath(arg if os.path.isabs(arg) else os.path.join(root, arg))
    if p == root or p.startswith(root + os.sep):
        return os.path.relpath(p, root)
    return None


def _map_into_copy(arg: str, root: str, td: str) -> str:
    """Absolute in-tree paths are mapped lexically onto the approved copy (decided on the path string only).
    A `key=<value>` option value is tokenized the way pytest reads it (shell-like), so quoted paths and
    whitespace lists are mapped too; other forms keep the whole token, after-`=`, and leading short option
    -X handling."""
    import os
    import shlex
    if "=" in arg and not arg.startswith("="):
        key, val = arg.split("=", 1)
        if re.fullmatch(r"[A-Za-z0-9_.-]+", key or ""):
            try:
                toks = shlex.split(val)
            except ValueError:
                toks = []
            if toks and any(os.path.isabs(t) for t in toks):
                mapped, changed = [], False
                for t in toks:
                    rel = _in_tree(t, root)
                    if rel is not None:
                        mapped.append(shlex.quote(os.path.join(td, rel)))
                        changed = True
                    else:
                        mapped.append(shlex.quote(t))
                if changed:
                    return key + "=" + " ".join(mapped)
    return _map_path_arg(arg, lambda p: os.path.join(td, rel) if (rel := _in_tree(p, root)) is not None else None)
def tree_hash(snap: dict[str, tuple[str, bytes]]) -> str:
    return hashlib.sha256(canonical_bytes({r: [k, hashlib.sha256(d).hexdigest(), m] for r, (k, d, m) in snap.items()})
                          ).hexdigest()


def resolve_program(argv0: str, root: str, env: dict[str, str] | None, snap: dict | None = None) -> str:
    """Program identity bound into the hash. A path (contains '/') must lie inside the tree (lexically, `../`
    escapes refused) and exist in the snapshot -> returned as 'tree:<rel>' and executed from the copy.
    A bare name is looked up in absolute PATH entries of the action env -> absolute path; its bytes are
    bound and exactly those bytes are executed (copied into the run dir), never re-resolved."""
    import os
    import shutil
    if os.path.isabs(argv0) and _in_tree(argv0, root) is None:
        return os.path.realpath(argv0)  # external absolute program: bytes bound and run from a copy
    if "/" in argv0:
        rel = _in_tree(argv0, root)
        if rel is None:
            raise LedgerError(f"program outside the working tree: {argv0}")
        if snap is not None and (rel not in snap or snap[rel][0] == "dir"):
            raise LedgerError(f"program not in the approved snapshot: {argv0}")
        return "tree:" + rel
    path = (env or {}).get("PATH", os.environ.get("PATH", ""))
    found = shutil.which(argv0, path=os.pathsep.join(p for p in path.split(os.pathsep) if os.path.isabs(p)))
    if not found:
        raise LedgerError(f"program not found in absolute PATH entries: {argv0}")
    return os.path.realpath(found)


def _read_program(prog: str) -> bytes:
    import os
    import stat
    try:
        fd = os.open(prog, os.O_RDONLY | os.O_NONBLOCK)
    except OSError as e:
        raise LedgerError(f"cannot open program {prog}: {e}") from e
    with os.fdopen(fd, "rb") as fh:
        if not stat.S_ISREG(os.fstat(fh.fileno()).st_mode):
            raise LedgerError(f"program is not a regular file: {prog}")
        data = fh.read(MAX_SNAPSHOT_BYTES + 1)
    if len(data) > MAX_SNAPSHOT_BYTES:
        raise LedgerError(f"program too large to bind: {prog}")
    return data


def _norm_against_root(val: str, root: str) -> str:
    """Lexical resolution of an arg value against the gate root (no live symlink is followed)."""
    import os
    return os.path.normpath(val if os.path.isabs(val) else os.path.join(root, val))


def _contains_git_component(norm: str, root: str) -> bool:
    """True if an in-tree path crosses a `.git` component, which the snapshot/hash never covers."""
    import os
    rel = os.path.relpath(norm, root)
    return ".git" in rel.split(os.sep)


def _looks_like_rel_path(val: str, root: str, snap: dict | None) -> bool:
    """A relative arg value the gate must resolve as a path: it has a separator or '..', is exactly a `.git`
    component, or names a file already bound in the approved snapshot."""
    import os
    if os.path.isabs(val):
        return False
    if "/" in val or ".." in val or val == ".git":
        return True
    if snap is not None:
        return os.path.normpath(val) in snap
    return False


def _bundled_value_opt(tok: str) -> bool:
    """True if a single-dash bundle (e.g. -qc<x>, -qo<x>, -vp<x>) reaches c/o/p before any other value-taking
    flag (k/m) or a non-letter; `-p no:<plugin>` (disabling) is allowed."""
    if len(tok) < 2 or tok[0] != "-" or tok[1] == "-":
        return False
    for j, ch in enumerate(tok[1:], 1):
        if ch in "cop":
            return not (ch == "p" and tok[j + 1:].startswith("no:"))
        if ch in "km" or not ch.isalpha():
            return False
    return False


def _check_args(args: list[str], root: str, snap: dict | None = None) -> None:
    """Fail closed on argv that could run code not bound in the approved snapshot: relative paths are
    resolved lexically against the root and must stay inside it and outside `.git`; the same applies to
    absolute in-tree paths (`.git` is never in the snapshot)."""
    import os as _os
    for a in args:  # a bundled -c/-o/-p carries a config/ini/plugin outside the approved binding
        if len(a) > 2 and _bundled_value_opt(a):
            raise LedgerError(f"bundled short option with -c/-o/-p in gated action: {a}")
    for a in args:  # an outside alias (symlink) resolving into the live tree would bypass the snapshot
        cands = [a, a.split("=", 1)[1] if "=" in a else ""]
        if len(a) > 2 and a[0] == "-" and a[1] != "-":
            cands.append(a[2:])
        for c in list(cands):  # split fully, exactly like origin/main (at `=`, `:` and `,`)
            cands.extend(re.split(r"[=:,]", c))
        for c in list(cands):  # additionally try every candidate without surrounding quotes, so a quoted
            if len(c) > 1 and c[0] == c[-1] and c[0] in "\"'":  # alias (`--x=k="alias/cfg.ini"`) stays seen
                cands.append(c[1:-1])  # as a symlink bypass without splitting legitimate values on whitespace
        for c in cands:
            if c and _os.path.isabs(c) and _in_tree(c, root) is None:
                real = _os.path.realpath(c)
                if real == root or real.startswith(root + _os.sep):
                    raise LedgerError(f"live repo path via symlink in gated action: {a}")
    for i, a in enumerate(args):  # a config/ini/rootdir value is read by the tool; existence must not matter,
        if "=" in a and not a.startswith("="):  # or a name absent at approval could be created before execution
            _opt, _val = a.split("=", 1)
        elif a in _CFG_FILE_OPTS and i + 1 < len(args):  # (#83: `-c <pfad>` / `--config-file=<pfad>`)
            _opt, _val = a, args[i + 1]
        else:
            continue
        if _opt in _CFG_FILE_OPTS:
            # Every path the value could name is checked lexically against the tree, so neither a quote, a
            # list separator, a comma, a `key=` prefix nor a `..` escape can hide a file outside it (#83).
            _refuse_cfg_path(_opt, _val, root, a)
    import os
    for a in args:
        for prefix, val in _iter_path_pairs(a):
            norm = _norm_against_root(val, root)
            in_tree = norm == root or norm.startswith(root + os.sep)
            if os.path.isabs(val):
                if not in_tree and (os.path.lexists(val) or os.path.lexists(os.path.realpath(val))):
                    raise LedgerError(f"gated action references a path outside the working tree: {a}")
                if in_tree and _contains_git_component(norm, root):
                    raise LedgerError(f"gated action references a path inside .git: {a}")
            elif _looks_like_rel_path(val, root, snap):
                if in_tree and _contains_git_component(norm, root):
                    raise LedgerError(f"gated action references a path inside .git: {a}")
                if not in_tree:
                    raise LedgerError(f"gated action references a path outside the working tree: {a}")
        f = os.path.join(root, a)
        if os.path.lexists(f) and _in_tree(a, root) is None:
            raise LedgerError(f"gated action references a path outside the working tree: {a}")
        if os.path.lexists(f):
            real = os.path.realpath(f)
            if not (real == root or real.startswith(root + os.sep)):
                raise LedgerError(f"gated action references a path outside the working tree: {a}")


def _is_shell_argv(argv: list[str], prog: str | None) -> bool:
    """True if the action runs a shell (basename of argv[0] or of the resolved program)."""
    import os
    bases = [os.path.basename(argv[0])]
    if prog is not None:
        p = prog.removeprefix("tree:")
        bases.append(os.path.basename(p))
    return any(b in SHELL_NAMES for b in bases)


def _reject_shell_c(argv: list[str], prog: str | None = None) -> None:
    """Fail closed: a gated shell with `-c` (or a bundled flag word containing 'c' like -ec/-xc) runs
    arbitrary commands that are never bound in the snapshot."""
    if not _is_shell_argv(argv, prog):
        return
    for a in argv[1:]:
        if a == "-c" or (a.startswith("-") and not a.startswith("--") and "c" in a and "/" not in a and "=" not in a):
            raise LedgerError("shell -c is not allowed in gated actions")


def _check_argv(argv: list[str], root: str, env: dict[str, str] | None = None, snap: dict | None = None) -> str | None:
    """Refuse args naming existing paths outside the tree; sha256 of an external program (tree programs are
    bound by the tree hash)."""
    _check_args(argv[1:], root, snap)
    prog = resolve_program(argv[0], root, env, snap)
    _reject_shell_c(argv, prog)
    if prog.startswith("tree:"):
        return None
    return hashlib.sha256(_read_program(prog)).hexdigest()


def action_hash(argv: list[str], cwd: str | None = None, snap: dict | None = None,
                env: dict[str, str] | None = None, bound: tuple[str, bytes | None] | None = None) -> str:
    import os
    doc: dict = {"kind": "command", "argv": argv}
    if cwd is not None:
        root = os.path.realpath(cwd)
        snap = snap if snap is not None else snapshot(root)
        doc["cwd"] = root  # approval in dir A is not valid for execution in dir B
        if bound is None:
            doc["program"] = resolve_program(argv[0], root, env, snap)
            doc["program_sha256"] = _check_argv(argv, root, env, snap)
        else:  # exactly the bytes that will be executed
            _check_args(argv[1:], root, snap)
            _reject_shell_c(argv, bound[0])
            doc["program"] = bound[0]
            doc["program_sha256"] = None if bound[1] is None else hashlib.sha256(bound[1]).hexdigest()
        doc["tree_sha256"] = tree_hash(snap)
    return hashlib.sha256(canonical_bytes(doc)).hexdigest()


def _anchor_path(run_id: str):
    """External rollback anchor (outside the run dir): last ledger head + consumed approvals per run."""
    import os
    from pathlib import Path
    base = Path(os.environ.get("TRUTHLENS_ANCHOR_DIR") or Path.home() / ".truthlens" / "anchors")
    base.mkdir(parents=True, exist_ok=True, mode=0o700)
    return base / f"{run_id}.json"


def _load_anchor(run_id: str, state: dict) -> None:
    import json
    f = _anchor_path(run_id)
    if f.exists():
        d = json.loads(f.read_text())
        state.setdefault("consumed", set()).update(d.get("consumed", []))
        if d.get("head") and (not state.get("head") or d["head"][0] > state["head"][0]):
            state["head"] = tuple(d["head"])


def _save_anchor(run_id: str, state: dict) -> None:
    import json
    import os
    f = _anchor_path(run_id)
    tmp = f.with_suffix(f".{os.getpid()}.tmp")
    with open(tmp, "w") as fh:
        fh.write(json.dumps({"head": list(state["head"]), "consumed": sorted(state.get("consumed", ()))}))
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, f)
    dfd = os.open(f.parent, os.O_RDONLY)  # durable before the action runs (power loss must not re-arm it)
    try:
        os.fsync(dfd)
    finally:
        os.close(dfd)


def _iso(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _usable_approval(events: list[dict], ah: str) -> dict | None:
    """Strict: human, same hash, not simulated, not consumed, valid UTC expires_at in the future (D30)."""
    consumed = {e["payload"].get("approval_event_id") for e in events if e["type"] == "action.executed"}
    now = datetime.now(UTC)
    for e in reversed(events):
        p = e["payload"]
        if e["type"] != "approval.granted" or e["actor"].get("kind") != "human" or p.get("action_hash") != ah:
            continue
        exp = _parse_ts(p.get("expires_at"))
        if p.get("simulated") is not True and e["id"] not in consumed and exp is not None and exp >= now:
            return e
    return None


def act(led: Ledger, actor: dict, argv: list[str], cwd: str | None = None,
        env: dict[str, str] | None = None, state: dict | None = None) -> tuple[int, dict]:
    """Rollback: last ledger head + consumed approvals are kept in memory (`state`) AND in an external anchor
    file outside the run dir (all callers incl. CLI `truthlens act`). Execution: from an immutable snapshot."""
    import os
    import tempfile
    vr = verify(led.path, led.hmac_key)
    if not vr.ok:
        raise LedgerError(f"ledger does not verify, refusing to act: line {vr.errors[0][0]}: {vr.errors[0][1]}")
    events = led.read()
    if not events:
        raise LedgerError("act needs an open run ledger")
    if events[-1]["type"] == "run.finished":
        raise LedgerError("run is closed")
    state = state if state is not None else {}
    state.setdefault("consumed", set())
    _load_anchor(events[0]["run_id"], state)
    if state.get("head"):
        seq, h = state["head"]
        if not any(e["seq"] == seq and e["hash"] == h for e in events):
            raise LedgerError("ledger rollback detected: remembered head is missing")
    root = os.path.realpath(cwd or os.getcwd())
    snap = snapshot(root, {os.path.realpath(led.path)})
    prog = resolve_program(argv[0], root, env, snap)
    pbytes = None if prog.startswith("tree:") else _read_program(prog)  # read once; these bytes are hashed AND run
    run_id, ah = events[0]["run_id"], action_hash(argv, root, snap, env, (prog, pbytes))
    appr = _usable_approval(events, ah)
    if appr is not None and appr["id"] in state["consumed"]:
        appr = None
    if appr is None:
        if not any(e["type"] == "action.blocked" and e["payload"].get("action_hash") == ah for e in events):
            led.append(run_id, actor, "action.requested", {"action_hash": ah, "action": {"argv": argv}})
            led.append(run_id, {"kind": "system", "id": "truthlens-gate"}, "action.blocked",
                       {"action_hash": ah, "policy": "requires_human_approval", "reason": "no valid approval"})
        last = led.read()[-1]
        state["head"] = (last["seq"], last["hash"])
        _save_anchor(run_id, state)
        return BLOCKED, {"action_hash": ah, "status": "blocked"}
    # reserve first (consumes the approval in the ledger), then execute, then record the outcome
    ev = led.append(run_id, {"kind": "system", "id": "truthlens-gate"}, "action.executed",
                    {"action_hash": ah, "approval_event_id": appr["id"], "result": "started"})
    state["consumed"].add(appr["id"])
    state["head"] = (ev["seq"], ev["hash"])
    _save_anchor(run_id, state)
    with tempfile.TemporaryDirectory(prefix="tl-act-") as td:  # run from the approved bytes, not the live tree
        try:  # preparation errors after the approval was consumed are recorded as the result, too
            _materialize(snap, td)
            if pbytes is None:
                exe = os.path.join(td, prog[len("tree:"):])
            else:  # never re-resolved: run the bound bytes from a private copy
                os.makedirs(os.path.join(td, ".tl-prog"), mode=0o700)
                exe = os.path.join(td, ".tl-prog", os.path.basename(prog))
                fd = os.open(exe, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o700)
                with os.fdopen(fd, "wb") as fh:
                    fh.write(pbytes)
            run_argv = [exe, *_map_argv(argv[1:], root, td)]
            _root_given = cwd or os.getcwd()
            for _a in run_argv:
                if _has_path(_a, _root_given) or _has_path(_a, root):
                    raise LedgerError(f"live repo path in gated action argv: {_a}")
                for _c in _live_path_hits(_a, root, td):  # a shell-quoted path the mapping missed
                    raise LedgerError(f"live repo path in gated action argv: {_a} ({_c})")
                for _prefix, _val in _iter_path_pairs(_a):
                    _real = os.path.realpath(_val)
                    if (_real == root or _real.startswith(root + os.sep)) and not _val.startswith(td):
                        raise LedgerError(f"live repo path via symlink in gated action argv: {_a}")
                    if os.pathsep in _val:
                        for _part in _val.split(os.pathsep):
                            if _part:
                                _realp = os.path.realpath(_part)
                                if (_realp == root or _realp.startswith(root + os.sep)) and not _part.startswith(td):
                                    raise LedgerError(f"live repo path via symlink in gated action argv: {_a}")
            if env is not None:
                for _v in env.values():
                    if _v and (_has_path(_v, _root_given) or _has_path(_v, root)):
                        raise LedgerError("live repo path in gated action env")
                    for _part in _v.split(os.pathsep):
                        if _part:
                            _real = os.path.realpath(_part)
                            if _real == root or _real.startswith(root + os.sep):
                                raise LedgerError("live repo path via symlink in gated action env")
            proc = subprocess.run(run_argv, cwd=td, env=env, stdin=subprocess.DEVNULL, capture_output=True, check=False)
        except (OSError, LedgerError) as e:  # #29.3: never kills the gate, never leaves only "started"
            proc = subprocess.CompletedProcess(argv, 127, b"", f"[truthlens gate: {type(e).__name__}]".encode())
    led.append(run_id, {"kind": "system", "id": "truthlens-gate"}, "evidence.attached",
               {"evidence_id": ev["id"].replace("evt_", "evd_"), "kind": "command_run", "refers_to": ev["id"],
                "sha256": hashlib.sha256(proc.stdout + proc.stderr).hexdigest(), "exit_code": proc.returncode,
                "result": "info"})
    return proc.returncode, {"action_hash": ah, "status": "executed", "event": ev["id"],
                             "exit_code": proc.returncode}


def approve(led: Ledger, approver: str, ah: str) -> dict:
    events = led.read()
    if not any(e["type"] == "action.blocked" and e["payload"].get("action_hash") == ah for e in events):
        raise LedgerError("no blocked action with this hash")
    return led.append(events[0]["run_id"], {"kind": "human", "id": approver}, "approval.granted",
                      {"action_hash": ah, "approver": approver,
                       "expires_at": _iso(datetime.now(UTC) + APPROVAL_TTL)})


def _write_response(res, data: bytes) -> None:
    """#29.4: never follow a pre-planted symlink / existing file: O_CREAT|O_EXCL|O_NOFOLLOW, then rename."""
    import os

    from truthlens.ids import new_id
    tmp = res.with_name(f".{new_id('res')}.tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as fh:
        fh.write(data)
    os.replace(tmp, res)


class GateServer:
    """Request channel for the wrapped agent (D16/D17): the agent drops `<id>.req` files ({"argv": [...]})
    into an inbox; the wrapper (holding the HMAC key and the gated capabilities) answers with `<id>.res`.
    The agent can only *ask*; it cannot sign ledger events and never holds the gated env (e.g. a deploy token)."""

    def __init__(self, led: Ledger, inbox, cwd: str, env: dict[str, str], requester: dict):
        import threading
        from pathlib import Path
        self.led, self.inbox, self.cwd, self.env, self.requester = led, Path(inbox), cwd, env, requester
        self.inbox.mkdir(parents=True, exist_ok=True)
        self.state: dict = {"consumed": set()}
        self._stop = threading.Event()
        self._t = threading.Thread(target=self._loop, daemon=True)

    def start(self):
        self._t.start()
        return self

    def stop(self):
        self._stop.set()
        self._t.join(timeout=5)
        self.poll()

    def poll(self):
        import json
        for req in sorted(self.inbox.glob("*.req")):
            res = req.with_suffix(".res")
            try:
                argv = json.loads(req.read_text())["argv"]
                if not (isinstance(argv, list) and argv and all(isinstance(a, str) for a in argv)):
                    raise ValueError("argv must be a non-empty list of strings")
                rc, info = act(self.led, self.requester, argv, self.cwd, self.env, self.state)
            except Exception as e:  # noqa: BLE001  #29.3: one bad request must not stop the gate thread
                rc, info = 2, {"status": "error", "error": f"{type(e).__name__}: {e}"}
            try:  # cleanup + answer are guarded too (directory x.req / x.res, planted temp names)
                if req.is_dir() and not req.is_symlink():
                    req.rename(req.with_suffix(".bad"))
                else:
                    req.unlink(missing_ok=True)
                _write_response(res, json.dumps({"rc": rc, **info}).encode())
            except OSError:
                continue

    def _loop(self):
        while not self._stop.wait(0.2):
            self.poll()


def request(inbox, argv: list[str], timeout: float = 30) -> tuple[int, dict]:
    """Agent side: ask the wrapper to run a gated action and wait for the answer."""
    import json
    import time
    from pathlib import Path

    from truthlens.ids import new_id
    box = Path(inbox)
    rid = new_id("req")
    tmp = box / f"{rid}.tmp"
    tmp.write_text(json.dumps({"argv": argv}))
    tmp.replace(box / f"{rid}.req")
    res = box / f"{rid}.res"
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if res.exists():
            info = json.loads(res.read_text())
            res.unlink()
            return int(info.pop("rc")), info
        time.sleep(0.1)
    return 2, {"status": "error", "error": "no answer from wrapper (is it running?)"}
