"""`truthlens run`: the process wrapper is the only witness (docs/WRAPPER-DESIGN.md).

Everything the agent prints is a claim; git state, the agent's exit code and the test runs the wrapper
executes itself are evidence. One ledger per run, closed with run.finished, manifest after close (D28).
"""

from __future__ import annotations

import difflib
import errno
import hashlib
import json
import os
import re
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from truthlens.canonical import canonical_bytes
from truthlens.gate import GateServer, _bundled_value_opt, _map_path_arg
from truthlens.ids import new_id
from truthlens.ledger import Ledger
from truthlens.manifest import build_manifest
from truthlens.redaction import redact_str
from truthlens.store import BlobStore

WRAPPER = {"kind": "wrapper", "id": "truthlens-run"}
ENV_ALLOW = ("PATH", "HOME", "LANG", "LC_ALL", "TERM", "USER", "SHELL", "TMPDIR", "XDG_CONFIG_HOME",
             "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME")
TEST_PATH = os.pathsep.join(dict.fromkeys([os.path.dirname(sys.executable), "/usr/local/bin", "/usr/bin", "/bin"]))
CLAIM_TRAILER = re.compile(r"^TRUTHLENS_CLAIMS:\s*(\[.*\])\s*$", re.MULTILINE)


@dataclass
class TestSpec:
    criterion_ids: list[str]
    command: str


@dataclass
class RunConfig:
    out_dir: Path
    repo: Path
    command: list[str]
    criteria: dict = field(default_factory=dict)
    confirm: list[str] = field(default_factory=list)
    tests: list[TestSpec] = field(default_factory=list)
    pass_env: list[str] = field(default_factory=list)
    hmac_key: bytes | None = None
    hmac_key_id: str | None = None
    timeout: int = 1800
    agent: str = ""
    human: str = "owner"
    gate_env: list[str] = field(default_factory=list)
    test_user: str | None = None  # run witnessed tests as this unix user (sudo -n -u), e.g. tl-agent
    test_path: str | None = None  # PATH for the test user (its own venv); default TEST_PATH



def _has_path(s: str, p: str) -> bool:
    """True if path p occurs in s as a whole path (followed by end, '/', or a separator), not as a prefix of a
    sibling like p + '-flag'."""
    import re as _re
    return bool(p) and _re.search(_re.escape(p) + r"(?![^/\s:;,'\"=)])", s) is not None

def parse_test_spec(spec: str) -> TestSpec:
    """'c1,c2=pytest -q tests/x.py' -> TestSpec(['c1','c2'], 'pytest -q tests/x.py')."""
    ids, sep, cmd = spec.partition("=")
    if not sep or not cmd.strip():
        raise ValueError(f"--test must be 'c1,c2=<command>': {spec!r}")
    return TestSpec([i.strip() for i in ids.split(",") if i.strip()], cmd.strip())


SUDO = "/usr/bin/sudo"
HELPER_ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LANG": "C.UTF-8"}


def _runner_probe(tokens: list[str], env: dict[str, str], user: str | None) -> bool | None:
    """Probe only a recognized configured runner, using fixed arguments and test isolation."""
    if not tokens or any(t in {"|", "||", "&&", ";", "&"} for t in tokens):
        return None
    name = Path(tokens[0]).name
    if name == "pytest":
        args = ["--version"]
    elif re.fullmatch(r"python(?:[0-9]+(?:\.[0-9]+)*)?", name) and tokens[1:3] == ["-m", "pytest"]:
        args = ["-s", "-c", "import pytest"]
    else:
        return None
    if "/" in tokens[0] and not os.path.isabs(tokens[0]):
        return None  # relative executables depend on the test copy, never the wrapper cwd
    target = shutil.which(tokens[0], path=env["PATH"])
    if target is None:
        return False
    if not os.path.isabs(target):
        return None  # relative PATH entries have a different meaning in the test copy
    argv = [target, *args]
    if user:
        argv = [SUDO, "-n", "-u", user, "/usr/bin/env", "-i",
                *[f"{k}={v}" for k, v in env.items()], *argv]
    try:
        # Output is intentionally discarded: a static diagnostic cannot leak runner stderr/secrets.
        return subprocess.run(argv, cwd="/", env=HELPER_ENV if user else env,
                              stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                              stderr=subprocess.DEVNULL, timeout=15, check=False).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


class _HelperError(Exception):
    pass


def junit_counts(xml: Path, rc: int) -> dict[str, int]:
    """Counts from pytest's JUnit XML, never from stdout. Missing/invalid XML -> nothing passed.
    A non-zero exit (except 5 = no tests collected, D27) is always at least one failure."""
    return _junit_counts(xml, rc)[0]


def _junit_counts(xml: Path, rc: int) -> tuple[dict[str, int], bool]:
    """Also retain whether XML passed validation, independently of synthetic exit failures."""
    import xml.etree.ElementTree as ET
    bad = rc not in (0, 5)
    c = {"passed": 0, "failed": int(bad), "skipped": 0}
    try:
        root = ET.parse(xml).getroot()
    except (OSError, ET.ParseError):
        return c, False
    suites = [root] if root.tag == "testsuite" else root.findall("testsuite")
    try:
        tot = {k: sum(int(su.get(k, 0) or 0) for su in suites) for k in ("tests", "failures", "errors", "skipped")}
    except ValueError:
        return c, False
    if not suites or min(tot.values()) < 0 or tot["failures"] + tot["errors"] + tot["skipped"] > tot["tests"]:
        return c, False  # malformed / inconsistent XML is no evidence
    failed = tot["failures"] + tot["errors"]
    c = {"passed": max(tot["tests"] - failed - tot["skipped"], 0), "failed": failed, "skipped": tot["skipped"]}
    if bad and c["failed"] == 0:
        c["failed"] = 1
    return c, True


GIT_SAFE = ("-c", "core.hooksPath=/dev/null", "-c", "core.attributesFile=/dev/null", "-c", "diff.external=",
             "-c", "core.fsmonitor=false", "-c", "core.pager=cat", "-c", "protocol.allow=never")
PROTECTED = ("tests/", "test/", "conftest.py", "pytest.ini", "pyproject.toml", "setup.cfg", "tox.ini",
             "package.json")


def _git_env() -> dict[str, str]:
    return {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": "/nonexistent", "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": "/dev/null", "LC_ALL": "C"}


def _disable_filters(repo: Path) -> list[str]:
    """Query repo-configured git filter drivers and return -c overrides to disable them."""
    extra = []
    try:
        out = subprocess.run(["git", *GIT_SAFE, "-C", str(repo), "config", "--name-only", "--get-regexp", r"^filter\."],
                             capture_output=True, check=False, stdin=subprocess.DEVNULL,
                             env=_git_env()).stdout.decode()
        seen = set()
        for line in out.strip().split("\n"):
            line = line.strip()
            if line.startswith("filter."):
                rest = line[len("filter."):]
                dot = rest.rfind(".")
                if dot == -1:
                    continue
                name = rest[:rest.rfind(".")]
                if name and name not in seen:
                    seen.add(name)
                    extra.extend(["-c", f"filter.{name}.clean=cat", "-c", f"filter.{name}.smudge=cat",
                                  "-c", f"filter.{name}.process=", "-c", f"filter.{name}.required=false"])
    except OSError:
        pass
    return extra


def _git(repo: Path, *args: str, check: bool = True) -> bytes:
    """Git with a filtered env and agent-controllable hooks/external diff/fsmonitor disabled (#26 review)."""
    return subprocess.run(["git", *GIT_SAFE, *_disable_filters(repo), "-C", str(repo), *args],
                          capture_output=True, check=check, stdin=subprocess.DEVNULL, env=_git_env()).stdout


def _read_head_blob(repo: Path, sha: str) -> bytes | None:
    """Content of a HEAD object for the pre-run diff, or None if it cannot be read.

    Never triggers a lazy fetch (#80 review): on a partial/promisor clone `git cat-file` could
    otherwise fetch the object, and a repository-level `protocol.<x>.allow=always` would override
    the global `protocol.allow=never`. A refused read is reported as None, never as empty content.
    """
    env = {**_git_env(), "GIT_NO_LAZY_FETCH": "1"}
    try:
        return subprocess.run(["git", *GIT_SAFE, "-C", str(repo), "cat-file", "blob", sha],
                              capture_output=True, check=True, stdin=subprocess.DEVNULL,
                              env=env).stdout
    except subprocess.CalledProcessError:
        return None


def is_protected(rel: str) -> bool:
    name = rel.rsplit("/", 1)[-1]
    if (name.startswith("test_") and name.endswith(".py")) or name.endswith("_test.py") or ".test." in name:
        return True
    return any(rel.startswith(p) if p.endswith("/") else (rel == p or name == "conftest.py") for p in PROTECTED)


NEW_IMPORT_HOOKS = {"__init__.py", "conftest.py", "__main__.py"}  # agent-created ones never enter the test copy
SHADOW = {"pytest.py", "sitecustomize.py", "usercustomize.py", "py.py"}


def _is_shadow(rel: str) -> bool:
    parts = rel.split("/")
    return parts[-1] in SHADOW or parts[-1].endswith(".pth") or "_pytest" in parts or "pytest" in parts


class UnsafeRepositoryPath(RuntimeError):
    """A repository path cannot be read without traversing an unsafe component."""


class _NonRegularFile(OSError):
    """A working-tree entry is neither a regular file nor an allowed final symlink."""


def _read(repo: Path, rel: str, *, symlinks: bool = True) -> bytes:
    """Read relative to directory descriptors; parent symlinks are never traversed.

    Pin each parent with O_NOFOLLOW before opening the next component. Replacing a
    parent after it is opened cannot redirect the read. Final symlinks retain link
    text, and nonblocking opens let fstat reject FIFOs/devices without reading them.
    """
    parts = rel.split("/")
    if any(p in ("", ".", "..") for p in parts) or os.path.isabs(rel):
        raise UnsafeRepositoryPath(f"unsafe repository path: {rel!r}")
    directory = os.open(repo, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in parts[:-1]:
            try:
                child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
            except OSError as e:
                if e.errno in (errno.ELOOP, errno.ENOTDIR):
                    # ENOTDIR also describes an ordinary non-directory parent (a
                    # legitimate deletion). This lstat classifies refusal only;
                    # no later open relies on its result for containment.
                    mode = os.stat(part, dir_fd=directory, follow_symlinks=False).st_mode
                    if stat.S_ISLNK(mode):
                        raise UnsafeRepositoryPath(f"unsafe repository path: {rel!r}") from e
                    raise _NonRegularFile(rel) from e
                raise
            os.close(directory)
            directory = child
        try:
            fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
        except OSError as e:
            if e.errno != errno.ELOOP:
                raise
            if not symlinks:
                raise _NonRegularFile(rel) from e
            return b"symlink:" + os.fsencode(os.readlink(parts[-1], dir_fd=directory))
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode):
                raise _NonRegularFile(rel)
            with os.fdopen(fd, "rb", closefd=False) as stream:
                return stream.read()
        finally:
            os.close(fd)
    finally:
        os.close(directory)


def _read_before(repo: Path, rel: str, before_snapshot: dict[str, str]) -> bytes:
    """Recover the old side only when its bytes match the snapshot; never invent empty content."""
    if rel not in before_snapshot:
        return b""
    expected = before_snapshot[rel]
    try:
        data = _read(repo, rel)
    except OSError:
        pass
    else:
        if hashlib.sha256(data).hexdigest() == expected:
            return data
    # The pre-diff compares HEAD to the working tree, so its old bytes live in git, not the tree.
    data = _read_head_blob(repo, f"HEAD:{rel}")
    if data is not None:
        for candidate in (data, b"symlink:" + data):
            if hashlib.sha256(candidate).hexdigest() == expected:
                return candidate
    raise RuntimeError(f"cannot recover pre-run content for {rel!r}")


def _make_diff(repo: Path, before: dict[str, str], after: dict[str, str],
               before_dir: Path | None = None) -> bytes:
    lines: list[str] = []
    all_keys = sorted(set(before) | set(after))
    for rel in all_keys:
        sha_b = before.get(rel)
        sha_a = after.get(rel)
        if sha_b == sha_a:
            continue
        if rel not in before:
            lines.append(f"diff --git a/dev/null b/{rel}")
            lines.append("new file mode 100644")
            lines.append("--- /dev/null")
            lines.append(f"+++ b/{rel}")
            try:
                data = _read(repo, rel)
            except OSError:
                continue
        elif rel not in after:
            lines.append(f"diff --git a/{rel} b/dev/null")
            lines.append("deleted file mode 100644")
            lines.append(f"--- a/{rel}")
            lines.append("+++ /dev/null")
            data = b""
        else:
            lines.append(f"diff --git a/{rel} b/{rel}")
            lines.append(f"--- a/{rel}")
            lines.append(f"+++ b/{rel}")
            try:
                data = _read(repo, rel)
            except OSError:
                continue
        if b"\0" in data:
            lines.append("Binary files differ")
        else:
            text = data.decode("utf-8", "replace")
            # `before_dir` holds the pre-run bytes on disk; when absent (pre-diff) fall back to
            # `_read_before` so that path is unchanged, otherwise read this changed file on demand.
            # A file that did not exist before the run has a legitimately empty `-` side; a file that
            # did exist must have a capture, else `_read_captured` raises instead of faking empty.
            if before_dir is None:
                src = _read_before(repo, rel, before).decode("utf-8", "replace")
            elif rel in before:
                src = _read_captured(before_dir, rel).decode("utf-8", "replace")
            else:
                src = ""
            diff = list(difflib.unified_diff(src.splitlines(True), text.splitlines(True),
                                             fromfile=f"a/{rel}", tofile=f"b/{rel}", n=3))
            lines.extend(l.rstrip("\n") for l in diff)
    return "\n".join(lines).encode()


def snapshot(repo: Path) -> dict[str, str]:
    """path -> sha256 of every tracked or untracked (non-ignored) file in the working tree."""
    out = {}
    for rel in _git(repo, "ls-files", "-co", "--exclude-standard", "-z").decode().split("\0"):
        if not rel:
            continue
        try:
            data = _read(repo, rel)
        except (FileNotFoundError, _NonRegularFile):
            continue  # deleted paths and nonregular entries are absent from the snapshot
        out[rel] = hashlib.sha256(data).hexdigest()
    return out


def _capture_before(repo: Path, before: dict[str, str], dest: Path) -> None:
    """Write the pre-run working tree into `dest` (outside the repo) for the after-diff `-` side.

    The after-diff needs the original (`-`) side. Re-reading the working tree after the run (what
    `_read_before` does) only matches files the agent left untouched, so removed lines and deleted
    content would be silently dropped. Holding every before-byte in RAM is unbounded (#90 review):
    a large tree would OOM the wrapper before the agent starts. The bytes therefore go to a temp
    dir and are read back on demand. A file is written only while it still hashes to `before[rel]`;
    symlinks are captured as link text, exactly like snapshot().
    """
    for rel, sha in before.items():
        if os.path.isabs(rel) or ".." in rel.split("/"):
            raise RuntimeError(f"refusing to capture non-relative path: {rel!r}")
        try:
            data = _read(repo, rel)  # symlink -> b"symlink:<target>", exactly what snapshot() hashes
        except OSError as e:
            raise RuntimeError(f"cannot read pre-run content for {rel!r}: {e}") from e
        if hashlib.sha256(data).hexdigest() != sha:
            raise RuntimeError(f"pre-run content changed between snapshot and capture: {rel!r}")
        try:
            out = dest / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(data)
            if out.stat().st_size != len(data):
                raise OSError("short write")
        except OSError as e:
            raise RuntimeError(f"cannot store pre-run content for {rel!r}: {e}") from e


def _read_captured(before_dir: Path, rel: str) -> bytes:
    """Read one file's pre-run bytes from the temp dir, on demand (never all files at once).

    A missing capture for a file that existed before the run is an error, not empty content:
    silently returning b"" would drop removed-line/deleted evidence without marking it (#81 review).
    """
    try:
        return (before_dir / rel).read_bytes()
    except OSError as e:
        raise RuntimeError(f"missing pre-run capture for {rel!r}: {e}") from e


def child_env(pass_env: list[str], drop: set[str]) -> dict[str, str]:
    env = {k: os.environ[k] for k in ENV_ALLOW if k in os.environ}
    env.update({k: os.environ[k] for k in pass_env if k in os.environ and k not in drop})
    return env


def _strip_secret_bytes(data: bytes, secrets: list[str]) -> bytes:
    """Remove known secrets at byte level (before any decoding, so non-UTF-8 keys match too)."""
    for sec in secrets:
        b = sec.encode("utf-8", "surrogateescape") if sec else b""
        if len(b) >= 4:
            data = data.replace(b, b"[REDACTED]")
    return data


def _escaped_repr(secret: str) -> str | None:
    b = secret.encode("utf-8", "surrogateescape")
    if all(0x20 <= c < 0x7f for c in b):
        return None
    return repr(b)[2:-1]


def _scrub_bytes(data: bytes, secrets: list[str]) -> bytes:
    """Redact blobs before they enter the store. Known secrets (incl. the HMAC key) are removed at byte level
    first; then pattern redaction runs on the surrogateescape-decoded text, so non-UTF-8 bytes stay intact."""
    data = _strip_secret_bytes(data, secrets)
    text = data.decode("utf-8", "surrogateescape")
    for sec in secrets:
        if len(sec) < 4:
            continue
        escaped = _escaped_repr(sec)
        if escaped and escaped in text:
            text = text.replace(escaped, "[REDACTED]")
    return _scrub(text, secrets).encode("utf-8", "surrogateescape")


def _scrub(text: str, secrets: list[str]) -> str:
    for s in secrets:
        if s and len(s) >= 4:
            text = text.replace(s, "[REDACTED]")
    return redact_str(text)


def extract_claims(stdout: str) -> list[dict]:
    """Agent claims: an optional JSON trailer line, else the last paragraph as one unmapped claim."""
    m = None
    for m in CLAIM_TRAILER.finditer(stdout):
        pass
    if m:
        try:
            items = json.loads(m.group(1))
            out = [{"text": str(i.get("text", ""))[:2000],
                    "criterion_ids": [str(c) for c in i.get("criterion_ids", []) if isinstance(c, str)]}
                   for i in items if isinstance(i, dict)]
            if out:
                return out
        except (ValueError, AttributeError):
            pass
    paras = [p.strip() for p in re.split(r"\n\s*\n", stdout) if p.strip()]
    return [{"text": paras[-1][-2000:], "criterion_ids": []}] if paras else []


def run(cfg: RunConfig) -> dict:
    """Execute one witnessed run. Returns run_id, agent exit_code, capture_failed, manifest_sha256 and ledger."""
    cfg.out_dir.mkdir(parents=True, exist_ok=True)
    ledger_path = cfg.out_dir / "ledger.jsonl"
    if ledger_path.exists() and ledger_path.stat().st_size:
        raise FileExistsError(f"{ledger_path} exists (one ledger per run)")
    if not cfg.hmac_key or not cfg.hmac_key_id:
        raise ValueError("truthlens run requires an HMAC key file (--hmac-key-file, --hmac-key-id) (#26 review)")
    led = Ledger(ledger_path, cfg.hmac_key, cfg.hmac_key_id)
    store = BlobStore(cfg.out_dir / "blobs")
    run_id = new_id("run")
    secrets = [os.environ.get(k, "") for k in cfg.pass_env + cfg.gate_env]
    if cfg.hmac_key:
        secrets.append(cfg.hmac_key.decode("utf-8", "surrogateescape"))  # never store the key in clear if the agent leaks it
    drop = {k for k, v in os.environ.items() if cfg.hmac_key and v.encode() == cfg.hmac_key}

    def emit(actor: dict, t: str, payload: dict) -> dict:
        return led.append(run_id, actor, t, payload)

    def blob(data: bytes) -> str:
        return store.put(_strip_secret_bytes(data, secrets))  # every blob: known secrets removed before hashing

    head = _git(cfg.repo, "rev-parse", "HEAD").decode().strip()
    emit(WRAPPER, "run.started", {"repo": str(cfg.repo), "ref": head,
                                  "command": _scrub(" ".join(cfg.command), secrets), "agent": cfg.agent})

    # criteria (D22–D24): user criteria by the human, derived ones stay proposed until confirmed
    human = {"kind": "human", "id": cfg.human}
    req = cfg.criteria.get("requirement")
    if req:
        emit(human, "requirement.recorded", {"requirement_id": req["id"], "text": req["text"], "source": "user"})
    texts = {}
    for c in cfg.criteria.get("criteria", []):
        tsha = hashlib.sha256(c["text"].encode()).hexdigest()
        texts[c["id"]] = tsha
        p = {"criterion_id": c["id"], "text": c["text"], "text_sha256": tsha, "source": c.get("source", "derived")}
        if req:
            p["requirement_id"] = req["id"]
        if p["source"] == "derived":
            p["derived_by"] = c.get("derived_by", {"kind": "agent", "id": cfg.agent or "agent"})
            emit({"kind": "agent", "id": p["derived_by"]["id"]}, "criterion.recorded", p)
        else:
            emit(human, "criterion.recorded", p)
    if cfg.confirm:
        emit(human, "criteria.confirmed", {"criterion_ids": cfg.confirm,
                                           "criteria": [{"criterion_id": c, "text_sha256": texts.get(c)}
                                                        for c in cfg.confirm]})

    # before snapshot
    before = snapshot(cfg.repo)
    head_files = {}
    unreadable: set[str] = set()
    for line in _git(cfg.repo, "ls-tree", "-r", "-z", "HEAD").decode().split("\0"):
        if line:
            parts = line.split("\t", 1)
            if len(parts) == 2:
                meta, rel = parts
                fields = meta.split(" ")
                if len(fields) < 3:
                    continue
                mode, sha = fields[0], fields[2]
                if mode not in ("100644", "100755", "120000"):
                    continue  # e.g. 160000 gitlinks have no blob; snapshot() does not list them either
                data = _read_head_blob(cfg.repo, sha)
                if data is None:
                    unreadable.add(rel)
                    continue  # missing/corrupt object: never a phantom entry, see below
                head_files[rel] = hashlib.sha256(b"symlink:" + data if mode == "120000" else data).hexdigest()
    # An entry we could not read from HEAD must produce NO diff line at all. Were it left in `before`
    # only, `_make_diff` would report the unchanged file as fully added (phantom evidence).
    diffable_before = {rel: s for rel, s in before.items() if rel in head_files or rel not in unreadable}
    pre_diff = _make_diff(cfg.repo, head_files, diffable_before)
    sha = blob(canonical_bytes({"head": head, "files": before}) + b"\n" + _scrub_bytes(pre_diff, secrets))
    protected_before = {rel: _read(cfg.repo, rel) for rel in before if is_protected(rel)}
    emit(WRAPPER, "evidence.attached", {"evidence_id": new_id("evd"), "sha256": sha, "kind": "file_changed",
                                        "refers_to": "git_state_before", "result": "info"})

    # pre-run `-` side on disk (outside the repo) and the run, both torn down in the finally:
    # minutes-long agent runs and timeouts must never leak the temp dir (#90 review).
    before_dir = Path(tempfile.mkdtemp(prefix="tl-before-"))  # memory-bounded, unlike a full RAM copy
    try:
        _capture_before(cfg.repo, before, before_dir)

        # agent run: no shell, stdin closed, filtered env, HMAC key never passed
        env = child_env(cfg.pass_env, drop | set(cfg.gate_env))
        gate_dir = Path(tempfile.mkdtemp(prefix="tl-gate-"))  # #29.4: inbox outside the run dir, mode 700
        env["TRUTHLENS_GATE_DIR"] = str(gate_dir)
        gated_env = child_env(cfg.gate_env, drop - set(cfg.gate_env))
        server = GateServer(led, gate_dir, str(cfg.repo), gated_env,
                            {"kind": "agent", "id": cfg.agent or "agent"}).start()
        try:
            proc = subprocess.run(cfg.command, cwd=cfg.repo, env=env, stdin=subprocess.DEVNULL,
                                  capture_output=True, timeout=cfg.timeout, check=False)
            rc, out, err = proc.returncode, proc.stdout, proc.stderr
        except subprocess.TimeoutExpired as e:
            rc, out, err = 124, e.stdout or b"", (e.stderr or b"") + b"\n[truthlens: timeout]"
        finally:
            server.stop()
            shutil.rmtree(gate_dir, ignore_errors=True)
        stdout = _scrub(_strip_secret_bytes(out, secrets).decode("utf-8", "replace"), secrets)
        stderr = _scrub(_strip_secret_bytes(err, secrets).decode("utf-8", "replace"), secrets)
        emit(WRAPPER, "evidence.attached", {"evidence_id": new_id("evd"), "kind": "command_run",
                                            "sha256": blob(f"$ {_scrub(' '.join(cfg.command), secrets)}\n--- stdout\n{stdout}\n"
                                                           f"--- stderr\n{stderr}".encode()),
                                            "refers_to": "agent_command", "exit_code": rc, "result": "info"})
        for c in extract_claims(stdout):
            p = {"claim_id": new_id("clm"), "kind": "completion", "text": c["text"]}
            known = [i for i in c["criterion_ids"] if i in texts]
            if known:
                p["criterion_ids"] = known
            emit({"kind": "agent", "id": cfg.agent or "agent"}, "agent.claim", p)

        # Catch only capture reads/Git operations; ledger and store failures must propagate.
        capture_failed = False
        after, changed = {}, []
        try:
            after = snapshot(cfg.repo)
            changed = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
            diff = _make_diff(cfg.repo, before, after, before_dir)
            captured_after = Path(tempfile.mkdtemp(prefix="tl-after-", dir=before_dir))
            captured = []
            for i, rel in enumerate(changed):
                if rel in after:
                    dest = captured_after / str(i)
                    dest.write_bytes(_read(cfg.repo, rel))
                    captured.append((rel, dest))
        except (OSError, subprocess.CalledProcessError, RuntimeError):
            capture_failed = True
        if capture_failed:
            emit(WRAPPER, "evidence.attached", {"evidence_id": new_id("evd"), "kind": "capture_error",
                "sha256": blob(b"[truthlens: post-agent capture failed; artifacts and tests skipped]"),
                "refers_to": "post_agent_capture", "result": "info"})
            changed = []
        else:
            emit(WRAPPER, "evidence.attached", {"evidence_id": new_id("evd"), "kind": "file_changed",
                "sha256": blob(_scrub_bytes(diff, secrets)), "refers_to": "git_diff_after",
                "changed": [_scrub(c, secrets) for c in changed], "result": "info"})
            for rel, dest in captured:
                # The staged file is wrapper-owned; store/ledger exceptions are outside the capture catch.
                s = blob(_scrub_bytes(dest.read_bytes(), secrets))
                emit(WRAPPER, "artifact.recorded", {"artifact_id": new_id("art"), "sha256": s,
                    "path": _scrub(rel, secrets), "manifest_ref": "manifest.json", "kind": "file",
                    "provenance": "original"})
    finally:
        shutil.rmtree(before_dir, ignore_errors=True)

    # witnessed tests (#26 review): run in a copy of the post-run tree where test files/config are restored
    # to their pre-run content (agent edits to tests/conftest never count), fresh HOME, fixed PATH, no keys.
    tampered = sorted(r for r in changed if is_protected(r))
    if tampered:
        emit(WRAPPER, "evidence.attached", {"evidence_id": new_id("evd"), "kind": "test_files_changed",
                                            "sha256": blob("\n".join(tampered).encode()), "refers_to": "protected",
                                            "changed": [_scrub(c, secrets) for c in tampered], "result": "info"})
    for t in ([] if capture_failed else cfg.tests):
        runner_ok, valid_report = None, False
        with tempfile.TemporaryDirectory(prefix="tl-test-", ignore_cleanup_errors=True) as td:
            work, home = Path(td) / "w", Path(td) / "home"
            # round-5 finding c: copy only tracked + non-ignored files (git-ignored conftest.py never enters),
            # drop shadow modules (pytest.py, _pytest/, sitecustomize.py, *.pth), run with PYTHONSAFEPATH
            work.mkdir()
            try:
                for rel in after:
                    if _is_shadow(rel) or (rel not in before and rel.split("/")[-1] in NEW_IMPORT_HOOKS):
                        continue
                    # Source reads use the same pinned parents as evidence capture.
                    # Final symlinks never enter the fresh, wrapper-owned test copy.
                    try:
                        data = _read(cfg.repo, rel, symlinks=False)
                    except _NonRegularFile:
                        continue
                    dst = work / rel
                    if not dst.resolve().is_relative_to(work.resolve()):
                        raise UnsafeRepositoryPath(f"unsafe test-copy path: {rel!r}")
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    dst.write_bytes(data)
            except (OSError, RuntimeError):
                capture_failed = True
                emit(WRAPPER, "evidence.attached", {"evidence_id": new_id("evd"), "kind": "capture_error",
                    "sha256": blob(b"[truthlens: test-copy capture failed; remaining tests skipped]"),
                    "refers_to": "post_agent_capture", "result": "info"})
                break
            home.mkdir()
            for rel in after:
                if is_protected(rel) and rel not in protected_before:
                    (work / rel).unlink(missing_ok=True)
            for rel, data in protected_before.items():
                if not Path(os.path.realpath(work / rel)).parent.is_relative_to(work.resolve()):
                    continue  # #32.5: check containment BEFORE creating anything (no mkdir through symlinks)
                (work / rel).parent.mkdir(parents=True, exist_ok=True)
                (work / rel).unlink(missing_ok=True)
                (work / rel).write_bytes(data)
            test_env = {"PATH": cfg.test_path or TEST_PATH, "HOME": str(home), "LANG": "C.UTF-8",
                        "TMPDIR": str(home), "PYTHONSAFEPATH": "1", "PYTHONNOUSERSITE": "1"}
            jx = Path(td) / "junit" / "report.xml"  # outside the copied tree; via env, not appended to the line
            jx.parent.mkdir()
            test_env["PYTEST_ADDOPTS"] = f"--junitxml={jx}"
            _repo_real = str(cfg.repo.resolve())
            _work_str = str(work)

            def resolve(p: str, _repo_real: str = _repo_real, _work_str: str = _work_str) -> str | None:
                real = os.path.realpath(p)
                if real == _repo_real or real.startswith(_repo_real + os.sep):
                    return real.replace(_repo_real, _work_str, 1)
                return None
            _raw_tokens = shlex.split(t.command)
            _refused_opts = frozenset({"PYTHONPATH", "PYTEST_ADDOPTS", "-o", "--override-ini", "-c", "--rootdir", "-p", "--confcutdir", "--config-file"})
            _refused = bool(_raw_tokens and _raw_tokens[0] == "env")
            if not _refused:
                for _i, _tok in enumerate(_raw_tokens):
                    _nxt = _raw_tokens[_i + 1] if _i + 1 < len(_raw_tokens) else ""
                    if _tok == "-p" and _nxt.startswith("no:") or _tok.startswith("-pno:"):
                        continue  # disabling a plugin is allowed; loading one is not
                    if _i > 0 and _raw_tokens[_i - 1] == "-p" and _tok.startswith("no:"):
                        continue
                    if "=" in _tok and not _tok.startswith("-") and _tok.split("=", 1)[0].isidentifier():
                        _refused = True  # VAR=value prefix
                        break
                    if any(_tok == _p or _tok.startswith(_p + "=") or (len(_p) == 2 and _tok.startswith(_p))
                           for _p in _refused_opts):
                        _refused = True
                        break
                    if len(_tok) > 2 and _bundled_value_opt(_tok):  # -qc<x>, -qo<x>, -vp<x>
                        _refused = True
                        break
            if _refused:
                text, trc = "[truthlens: forbidden option in test command; refused]", 125
                counts = {"passed": 0, "failed": 0, "skipped": 0}
            else:
                tokens = [_map_path_arg(tok, resolve) for tok in _raw_tokens]
                cmd = shlex.join(tokens)
                argv, env_ = ["/bin/sh", "-c", cmd], test_env
                helper_err = None
                _repo_given = str(cfg.repo)
                _check_tokens = list(argv)
                if env_ is not None:
                    _check_tokens.extend(f"{k}={v}" for k, v in env_.items())
                _live_refused = any(
                    _has_path(_val, _repo_given) or _has_path(_val, _repo_real)
                    for _val in _check_tokens
                )
                if _live_refused:
                    text, trc = "[truthlens: live repo path in test command/env; refused]", 125
                    counts = {"passed": 0, "failed": 0, "skipped": 0}
                else:
                    if cfg.test_user:
                        # separate UID: test code cannot read the HMAC key, the rollback anchors or other box secrets.
                        # Leftover processes of that user are killed first (pkill exit 1 = none; anything else aborts).
                        u = cfg.test_user
                        try:
                            ok = subprocess.run([SUDO, "-n", "-u", u, "/bin/true"], capture_output=True, check=False,
                                                env=HELPER_ENV).returncode == 0
                            pk = subprocess.run([SUDO, "-n", "-u", u, "/usr/bin/pkill", "-KILL", "-u", u],
                                                capture_output=True, check=False, env=HELPER_ENV) if ok else None
                        except OSError:
                            ok, pk = False, None
                        if ok and pk is not None and pk.returncode in (0, 1):
                            if pk.returncode == 1:
                                pg = subprocess.run([SUDO, "-n", "-u", u, "/usr/bin/pgrep", "-u", u],
                                                    capture_output=True, check=False, env=HELPER_ENV)
                                if pg.returncode != 1:
                                    helper_err = f"sudo/pkill as {u} failed (pkill rc 1 but pgrep rc {pg.returncode})"
                                    ok_clean = False
                                else:
                                    ok_clean = True
                            else:
                                ok_clean = True
                        else:
                            ok_clean = False
                            if pk is None:
                                helper_err = f"sudo as {u} failed"
                            elif pk.returncode not in (0, 1):
                                helper_err = f"sudo/pkill as {u} failed (exit {pk.returncode})"
                            else:
                                helper_err = f"sudo/pkill as {u} failed"
                        if ok_clean:
                            os.chmod(td, 0o711)
                            try:
                                ch = subprocess.run([SUDO, "-n", "chown", "-R", u, str(work), str(home), str(jx.parent)],
                                                    capture_output=True, check=False, env=HELPER_ENV)
                            except OSError:
                                ch = subprocess.CompletedProcess([], 127)
                            if ch.returncode != 0:
                                helper_err = f"chown to {u} failed (exit {ch.returncode})"
                        argv = [SUDO, "-n", "-u", u, "/usr/bin/env", "-i", *[f"{k}={v}" for k, v in test_env.items()], *argv]
                        env_ = HELPER_ENV
                    try:
                        if helper_err:
                            raise _HelperError(helper_err)
                        runner_ok = _runner_probe(tokens, test_env, cfg.test_user)
                        jx.unlink(missing_ok=True)  # probe output can never supply the witnessed report
                        tp = subprocess.run(argv, cwd=work, env=env_, stdin=subprocess.DEVNULL,
                                            capture_output=True, timeout=600, check=False)
                        text, trc = _strip_secret_bytes(tp.stdout + tp.stderr, secrets).decode("utf-8", "replace"), tp.returncode
                    except subprocess.TimeoutExpired:
                        text, trc = "[truthlens: test timeout]", 124
                    except _HelperError as e:  # isolation could not be established: no evidence, run still finishes
                        text, trc = f"[truthlens: test isolation failed: {e}; tests not run]", 125
                    counts, valid_report = _junit_counts(jx, trc)
                    if helper_err:
                        counts = {"passed": 0, "failed": 0, "skipped": 0}
                    if cfg.test_user:  # hand the copy back so the temp dir can be removed; failure is reported
                        try:
                            back = subprocess.run([SUDO, "-n", "chown", "-R", str(os.getuid()), str(work), str(home),
                                                   str(jx.parent)], capture_output=True, check=False, env=HELPER_ENV)
                        except OSError:
                            back = subprocess.CompletedProcess([], 127)
                        if back.returncode != 0 and not helper_err:
                            text += f"\n[truthlens: chown back failed (exit {back.returncode}); temp dir may remain]"
        text = _scrub(text, secrets)
        if runner_ok is False:
            if not valid_report:
                counts = {"passed": 0, "failed": 0, "skipped": 0}
            text += "\n[truthlens: configured pytest runner unavailable; without valid XML result not decisive]"
        elif runner_ok is None:
            text += "\n[truthlens: runner probe skipped; command form not classified or tests refused]"
        rep_ = blob(f"$ {_scrub(t.command, secrets)}\nexit {trc}\n{text}".encode())
        emit(WRAPPER, "test.reported", {"suite": _scrub(t.command, secrets), **counts, "exit_code": trc,
                                        "report_artifact_id": rep_,
                                        "criterion_ids": [i for i in t.criterion_ids if i in texts]})

    # close (D28)
    last = led.read()[-1]["hash"]
    emit(WRAPPER, "run.finished", {"exit_code": rc, "status": "ok" if rc == 0 and not capture_failed else "failed", "last_hash": last})
    manifest = build_manifest(led.read(), {"name": cfg.agent, "command": _scrub(" ".join(cfg.command), secrets)})
    mbytes = canonical_bytes(manifest) + b"\n"
    (cfg.out_dir / "manifest.json").write_bytes(mbytes)
    msha = hashlib.sha256(mbytes).hexdigest()
    (cfg.out_dir / "manifest.sha256").write_text(msha + "\n")
    return {"run_id": run_id, "exit_code": rc, "capture_failed": capture_failed, "manifest_sha256": msha, "ledger": str(ledger_path)}
