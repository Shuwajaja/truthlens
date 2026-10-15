"""`truthlens run`: the process wrapper is the only witness (docs/WRAPPER-DESIGN.md).

Everything the agent prints is a claim; git state, the agent's exit code and the test runs the wrapper
executes itself are evidence. One ledger per run, closed with run.finished, manifest after close (D28).
"""

from __future__ import annotations

import difflib
import hashlib
import json
import os
import re
import shlex
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


class _HelperError(Exception):
    pass


def junit_counts(xml: Path, rc: int) -> dict[str, int]:
    """Counts from pytest's JUnit XML, never from stdout. Missing/invalid XML -> nothing passed.
    A non-zero exit (except 5 = no tests collected, D27) is always at least one failure."""
    import xml.etree.ElementTree as ET
    bad = rc not in (0, 5)
    c = {"passed": 0, "failed": int(bad), "skipped": 0}
    try:
        root = ET.parse(xml).getroot()
    except (OSError, ET.ParseError):
        return c
    suites = [root] if root.tag == "testsuite" else root.findall("testsuite")
    try:
        tot = {k: sum(int(su.get(k, 0) or 0) for su in suites) for k in ("tests", "failures", "errors", "skipped")}
    except ValueError:
        return c
    if not suites or min(tot.values()) < 0 or tot["failures"] + tot["errors"] + tot["skipped"] > tot["tests"]:
        return c  # malformed / inconsistent XML is no evidence
    failed = tot["failures"] + tot["errors"]
    c = {"passed": max(tot["tests"] - failed - tot["skipped"], 0), "failed": failed, "skipped": tot["skipped"]}
    if bad and c["failed"] == 0:
        c["failed"] = 1
    return c


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


def _read(f: Path) -> bytes:
    """File content; a symlink is recorded as its link text and never followed out of the repo."""
    return b"symlink:" + os.readlink(f).encode() if f.is_symlink() else f.read_bytes()


def _read_before(repo: Path, rel: str, before_snapshot: dict[str, str]) -> bytes:
    path = repo / rel
    if path.exists() and not path.is_symlink():
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        if sha == before_snapshot.get(rel):
            return path.read_bytes()
    return b""


def _make_diff(repo: Path, before: dict[str, str], after: dict[str, str],
               before_data: dict[str, bytes] | None = None) -> bytes:
    lines: list[str] = []
    all_keys = sorted(set(before) | set(after))
    for rel in all_keys:
        sha_b = before.get(rel)
        sha_a = after.get(rel)
        if sha_b == sha_a:
            continue
        path = repo / rel
        if rel not in before:
            lines.append(f"diff --git a/dev/null b/{rel}")
            lines.append("new file mode 100644")
            lines.append("--- /dev/null")
            lines.append(f"+++ b/{rel}")
            try:
                data = _read(path)
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
                data = _read(path)
            except OSError:
                continue
        if b"\0" in data:
            lines.append("Binary files differ")
        else:
            text = data.decode("utf-8", "replace")
            # `before_data` holds the pre-run bytes captured before the agent ran; when absent (pre-diff)
            # fall back to `_read_before` so that path is unchanged.
            if before_data is None:
                src = _read_before(repo, rel, before).decode("utf-8", "replace")
            else:
                src = before_data.get(rel, b"").decode("utf-8", "replace")
            diff = list(difflib.unified_diff(src.splitlines(True), text.splitlines(True),
                                             fromfile=f"a/{rel}", tofile=f"b/{rel}", n=3))
            lines.extend(l.rstrip("\n") for l in diff)
    return "\n".join(lines).encode()


def snapshot(repo: Path) -> dict[str, str]:
    """path -> sha256 of every tracked or untracked (non-ignored) file in the working tree."""
    out = {}
    for rel in _git(repo, "ls-files", "-co", "--exclude-standard", "-z").decode().split("\0"):
        f = repo / rel
        if rel and (f.is_symlink() or f.is_file()):
            out[rel] = hashlib.sha256(_read(f)).hexdigest()
    return out


def _capture_before(repo: Path, before: dict[str, str]) -> dict[str, bytes]:
    """Bytes of the pre-run working tree, captured BEFORE the agent runs.

    The after-diff needs the original (`-`) side. Re-reading the working tree after the run (what
    `_read_before` does) only matches files the agent left untouched, so removed lines and deleted
    content would be silently dropped. Symlinks are skipped, like `_read_before`.
    """
    out: dict[str, bytes] = {}
    for rel, sha in before.items():
        path = repo / rel
        if not path.exists() or path.is_symlink():
            continue
        try:
            data = path.read_bytes()
        except OSError:
            continue
        if hashlib.sha256(data).hexdigest() == sha:
            out[rel] = data
    return out


def _read_before(repo: Path, rel: str, before_snapshot: dict[str, str]) -> bytes:
    path = repo / rel
    if path.exists() and not path.is_symlink():
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        if sha == before_snapshot.get(rel):
            return path.read_bytes()
    return b""


def _make_diff(repo: Path, before: dict[str, str], after: dict[str, str],
               before_data: dict[str, bytes] | None = None) -> bytes:
    lines: list[str] = []
    all_keys = sorted(set(before) | set(after))
    for rel in all_keys:
        sha_b = before.get(rel)
        sha_a = after.get(rel)
        if sha_b == sha_a:
            continue
        path = repo / rel
        if rel not in before:
            lines.append(f"diff --git a/dev/null b/{rel}")
            lines.append("new file mode 100644")
            lines.append("--- /dev/null")
            lines.append(f"+++ b/{rel}")
            try:
                data = _read(path)
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
                data = _read(path)
            except OSError:
                continue
        if b"\0" in data:
            lines.append("Binary files differ")
        else:
            text = data.decode("utf-8", "replace")
            # `before_data` holds the pre-run bytes captured before the agent ran; when absent (pre-diff)
            # fall back to `_read_before` so that path is unchanged.
            if before_data is None:
                src = _read_before(repo, rel, before).decode("utf-8", "replace")
            else:
                src = before_data.get(rel, b"").decode("utf-8", "replace")
            diff = list(difflib.unified_diff(src.splitlines(True), text.splitlines(True),
                                             fromfile=f"a/{rel}", tofile=f"b/{rel}", n=3))
            lines.extend(l.rstrip("\n") for l in diff)
    return "\n".join(lines).encode()


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
    """Execute one witnessed run. Returns {run_id, exit_code, manifest_sha256, ledger}."""
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
    before_data = _capture_before(cfg.repo, before)  # pre-run `-` side, captured before the agent runs
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
    protected_before = {rel: _read(cfg.repo / rel) for rel in before if is_protected(rel)}
    emit(WRAPPER, "evidence.attached", {"evidence_id": new_id("evd"), "sha256": sha, "kind": "file_changed",
                                        "refers_to": "git_state_before", "result": "info"})

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
    server.stop()
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

    # after snapshot: diff + one artifact per changed file
    after = snapshot(cfg.repo)
    changed = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
    diff = _make_diff(cfg.repo, before, after, before_data)
    emit(WRAPPER, "evidence.attached", {"evidence_id": new_id("evd"), "kind": "file_changed",
                                        "sha256": blob(_scrub_bytes(diff, secrets)), "refers_to": "git_diff_after",
                                        "changed": [_scrub(c, secrets) for c in changed], "result": "info"})
    for rel in changed:
        if rel in after:
            s = blob(_scrub_bytes(_read(cfg.repo / rel), secrets))
            emit(WRAPPER, "artifact.recorded", {"artifact_id": new_id("art"), "sha256": s, "path": _scrub(rel, secrets),
                                                "manifest_ref": "manifest.json", "kind": "file",
                                                "provenance": "original"})

    # witnessed tests (#26 review): run in a copy of the post-run tree where test files/config are restored
    # to their pre-run content (agent edits to tests/conftest never count), fresh HOME, fixed PATH, no keys.
    tampered = sorted(r for r in changed if is_protected(r))
    if tampered:
        emit(WRAPPER, "evidence.attached", {"evidence_id": new_id("evd"), "kind": "test_files_changed",
                                            "sha256": blob("\n".join(tampered).encode()), "refers_to": "protected",
                                            "changed": [_scrub(c, secrets) for c in tampered], "result": "info"})
    for t in cfg.tests:
        with tempfile.TemporaryDirectory(prefix="tl-test-", ignore_cleanup_errors=True) as td:
            work, home = Path(td) / "w", Path(td) / "home"
            # round-5 finding c: copy only tracked + non-ignored files (git-ignored conftest.py never enters),
            # drop shadow modules (pytest.py, _pytest/, sitecustomize.py, *.pth), run with PYTHONSAFEPATH
            work.mkdir()
            for rel in after:
                if _is_shadow(rel) or (rel not in before and rel.split("/")[-1] in NEW_IMPORT_HOOKS):
                    continue
                src, dst = cfg.repo / rel, work / rel
                # symlinks never enter the test copy (external pytest packages, tests/ -> foreign tests)
                if src.is_symlink() or not src.resolve().is_relative_to(cfg.repo.resolve()):
                    continue
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_bytes(src.read_bytes())
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
            if cfg.test_user:
                rc_cmd = [SUDO, "-n", "-u", cfg.test_user, "/usr/bin/env", "-i", f"PATH={cfg.test_path or TEST_PATH}",
                          "python", "-s", "-c", "import pytest"]
            else:
                rc_cmd = [sys.executable, "-s", "-c", "import pytest"]
            try:  # sudo is absolute and started with a trusted env, never from --test-path
                runner_ok = subprocess.run(rc_cmd, cwd="/", capture_output=True, check=False,
                                           env=HELPER_ENV if cfg.test_user else
                                           {"PATH": TEST_PATH, "HOME": str(home), "PYTHONNOUSERSITE": "1"}
                                           ).returncode == 0
            except OSError:
                runner_ok = False
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
                        env_ = None
                    try:
                        if helper_err:
                            raise _HelperError(helper_err)
                        tp = subprocess.run(argv, cwd=work, env=env_, stdin=subprocess.DEVNULL,
                                            capture_output=True, timeout=600, check=False)
                        text, trc = _strip_secret_bytes(tp.stdout + tp.stderr, secrets).decode("utf-8", "replace"), tp.returncode
                    except subprocess.TimeoutExpired:
                        text, trc = "[truthlens: test timeout]", 124
                    except _HelperError as e:  # isolation could not be established: no evidence, run still finishes
                        text, trc = f"[truthlens: test isolation failed: {e}; tests not run]", 125
                    counts = junit_counts(jx, trc) if not helper_err else {"passed": 0, "failed": 0, "skipped": 0}
                    if cfg.test_user:  # hand the copy back so the temp dir can be removed; failure is reported
                        try:
                            back = subprocess.run([SUDO, "-n", "chown", "-R", str(os.getuid()), str(work), str(home),
                                                   str(jx.parent)], capture_output=True, check=False, env=HELPER_ENV)
                        except OSError:
                            back = subprocess.CompletedProcess([], 127)
                        if back.returncode != 0 and not helper_err:
                            text += f"\n[truthlens: chown back failed (exit {back.returncode}); temp dir may remain]"
        text = _scrub(text, secrets)
        if "pytest" in t.command and not runner_ok:  # #32.4: decided independently of the test output
            counts = {"passed": 0, "failed": 0, "skipped": 0}
            text += "\n[truthlens: pytest not importable in the clean env; result not decisive]"
        rep_ = blob(f"$ {_scrub(t.command, secrets)}\nexit {trc}\n{text}".encode())
        emit(WRAPPER, "test.reported", {"suite": _scrub(t.command, secrets), **counts, "exit_code": trc,
                                        "report_artifact_id": rep_,
                                        "criterion_ids": [i for i in t.criterion_ids if i in texts]})

    # close (D28)
    last = led.read()[-1]["hash"]
    emit(WRAPPER, "run.finished", {"exit_code": rc, "status": "ok" if rc == 0 else "failed", "last_hash": last})
    manifest = build_manifest(led.read(), {"name": cfg.agent, "command": _scrub(" ".join(cfg.command), secrets)})
    mbytes = canonical_bytes(manifest) + b"\n"
    (cfg.out_dir / "manifest.json").write_bytes(mbytes)
    msha = hashlib.sha256(mbytes).hexdigest()
    (cfg.out_dir / "manifest.sha256").write_text(msha + "\n")
    return {"run_id": run_id, "exit_code": rc, "manifest_sha256": msha, "ledger": str(ledger_path)}
