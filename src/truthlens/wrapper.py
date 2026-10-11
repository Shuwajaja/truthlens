"""`truthlens run`: the process wrapper is the only witness (docs/WRAPPER-DESIGN.md).

Everything the agent prints is a claim; git state, the agent's exit code and the test runs the wrapper
executes itself are evidence. One ledger per run, closed with run.finished, manifest after close (D28).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from truthlens.canonical import canonical_bytes
from truthlens.gate import GateServer
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
_COUNT = re.compile(r"(\d+) (passed|failed|skipped|errors?|error)\b")


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


def parse_test_spec(spec: str) -> TestSpec:
    """'c1,c2=pytest -q tests/x.py' -> TestSpec(['c1','c2'], 'pytest -q tests/x.py')."""
    ids, sep, cmd = spec.partition("=")
    if not sep or not cmd.strip():
        raise ValueError(f"--test must be 'c1,c2=<command>': {spec!r}")
    return TestSpec([i.strip() for i in ids.split(",") if i.strip()], cmd.strip())


def parse_pytest_counts(output: str, returncode: int) -> dict:
    """Counts from the pytest summary line. A non-zero exit without counted failures is a failure
    (crash, collection error) – except exit 5 = no tests collected, which stays passed=0 (unverified, D27)."""
    c = {"passed": 0, "failed": 0, "skipped": 0}
    tail = output.strip().splitlines()[-1:] or [""]
    for n, word in _COUNT.findall(tail[0]):
        key = "failed" if word.startswith("error") else word
        c[key] += int(n)
    if returncode not in (0, 5) and c["failed"] == 0:
        c["failed"] = 1
    return c


GIT_SAFE = ("-c", "core.hooksPath=/dev/null", "-c", "diff.external=", "-c", "core.fsmonitor=false",
            "-c", "core.pager=cat", "-c", "protocol.allow=never")
PROTECTED = ("tests/", "test/", "conftest.py", "pytest.ini", "pyproject.toml", "setup.cfg", "tox.ini",
             "package.json")


def _git_env() -> dict[str, str]:
    return {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": "/nonexistent", "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": "/dev/null", "LC_ALL": "C"}


def _git(repo: Path, *args: str, check: bool = True) -> bytes:
    """Git with a filtered env and agent-controllable hooks/external diff/fsmonitor disabled (#26 review)."""
    return subprocess.run(["git", *GIT_SAFE, "-C", str(repo), *args], capture_output=True, check=check,
                          stdin=subprocess.DEVNULL, env=_git_env()).stdout


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


def snapshot(repo: Path) -> dict[str, str]:
    """path -> sha256 of every tracked or untracked (non-ignored) file in the working tree."""
    out = {}
    for rel in _git(repo, "ls-files", "-co", "--exclude-standard", "-z").decode().split("\0"):
        f = repo / rel
        if rel and (f.is_symlink() or f.is_file()):
            out[rel] = hashlib.sha256(_read(f)).hexdigest()
    return out


def child_env(pass_env: list[str], drop: set[str]) -> dict[str, str]:
    env = {k: os.environ[k] for k in ENV_ALLOW if k in os.environ}
    env.update({k: os.environ[k] for k in pass_env if k in os.environ and k not in drop})
    return env


def _scrub_bytes(data: bytes, secrets: list[str]) -> bytes:
    """Redact text blobs (diffs, file contents, headers) before they enter the store; binary stays as is."""
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return data
    return _scrub(text, secrets).encode()


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
        secrets.append(cfg.hmac_key.decode("utf-8", "replace"))  # never store the key in clear if the agent leaks it
    drop = {k for k, v in os.environ.items() if cfg.hmac_key and v.encode() == cfg.hmac_key}

    def emit(actor: dict, t: str, payload: dict) -> dict:
        return led.append(run_id, actor, t, payload)

    def blob(data: bytes) -> str:
        return store.put(data)

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
    pre_diff = _git(cfg.repo, "diff", "--no-ext-diff", "--no-textconv", "HEAD", "--binary")
    sha = blob(canonical_bytes({"head": head, "files": before}) + b"\n" + _scrub_bytes(pre_diff, secrets))
    protected_before = {rel: _read(cfg.repo / rel) for rel in before if is_protected(rel)}
    emit(WRAPPER, "evidence.attached", {"evidence_id": new_id("evd"), "sha256": sha, "kind": "file_changed",
                                        "refers_to": "git_state_before", "result": "info"})

    # agent run: no shell, stdin closed, filtered env, HMAC key never passed
    env = child_env(cfg.pass_env, drop | set(cfg.gate_env))
    gate_dir = cfg.out_dir / "gate"
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
    stdout = _scrub(out.decode("utf-8", "replace"), secrets)
    stderr = _scrub(err.decode("utf-8", "replace"), secrets)
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
    diff = _git(cfg.repo, "diff", "--no-ext-diff", "--no-textconv", "HEAD", "--binary")
    for rel in changed:
        if rel not in before and rel in after:
            diff += _git(cfg.repo, "diff", "--no-ext-diff", "--no-textconv", "--no-index", "--binary", "/dev/null", rel, check=False)
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
        with tempfile.TemporaryDirectory(prefix="tl-test-") as td:
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
                (work / rel).parent.mkdir(parents=True, exist_ok=True)
                (work / rel).unlink(missing_ok=True)
                (work / rel).write_bytes(data)
            test_env = {"PATH": TEST_PATH, "HOME": str(home), "LANG": "C.UTF-8", "TMPDIR": td,
                        "PYTHONSAFEPATH": "1", "PYTHONNOUSERSITE": "1"}
            try:
                tp = subprocess.run(t.command, shell=True, cwd=work, env=test_env, stdin=subprocess.DEVNULL,
                                    capture_output=True, timeout=600, check=False)
                text, trc = (tp.stdout + tp.stderr).decode("utf-8", "replace"), tp.returncode
            except subprocess.TimeoutExpired:
                text, trc = "[truthlens: test timeout]", 124
        text = _scrub(text, secrets)
        counts = parse_pytest_counts(text, trc)
        rep_ = blob(f"$ {t.command}\nexit {trc}\n{text}".encode())
        emit(WRAPPER, "test.reported", {"suite": t.command, **counts, "exit_code": trc,
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
