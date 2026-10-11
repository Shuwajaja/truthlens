"""Small approval gate (D16, D17, D30): a controlled action is executed only by TruthLens itself and only
after a human approval for exactly this action hash that is unexpired, not simulated and not yet consumed.

Flow: `truthlens act` -> action.requested + action.blocked, exit 3, command NOT run.
`truthlens approve <hash>` (human, outside the agent env; signed if the ledger uses HMAC) -> approval.granted.
`truthlens act` again -> finds the approval, runs the command, writes action.executed (consumes it).
"""

from __future__ import annotations

import hashlib
import subprocess
from datetime import UTC, datetime, timedelta

from truthlens.canonical import canonical_bytes
from truthlens.ledger import Ledger, LedgerError, _parse_ts, verify

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


def _map_into_copy(arg: str, root: str, td: str) -> str:
    """Absolute paths into the live tree are redirected to the approved copy (never the live file)."""
    import os
    if os.path.isabs(arg):
        real = os.path.realpath(arg)
        if real == root or real.startswith(root + os.sep):
            return os.path.join(td, os.path.relpath(real, root))
    return arg


def tree_hash(snap: dict[str, tuple[str, bytes]]) -> str:
    return hashlib.sha256(canonical_bytes({r: [k, hashlib.sha256(d).hexdigest(), m] for r, (k, d, m) in snap.items()})
                          ).hexdigest()


def resolve_program(argv0: str, root: str, env: dict[str, str] | None) -> str:
    """Absolute program path used for BOTH hashing and execution. Bare names are looked up only in absolute
    PATH entries of the action env (relative entries like `bin` are ignored); relative paths are taken from
    the snapshot copy at execution time (returned unchanged, covered by the tree hash)."""
    import os
    import shutil
    if "/" in argv0:
        return argv0
    path = (env or {}).get("PATH", os.environ.get("PATH", ""))
    found = shutil.which(argv0, path=os.pathsep.join(p for p in path.split(os.pathsep) if os.path.isabs(p)))
    if not found:
        raise LedgerError(f"program not found in absolute PATH entries: {argv0}")
    return os.path.realpath(found)


def _check_argv(argv: list[str], root: str, env: dict[str, str] | None = None) -> str | None:
    """sha256 of the resolved program (bounded, regular file only); refuse args naming paths outside the
    tree or non-regular files."""
    import os
    import stat
    for a in argv[1:]:
        f = os.path.join(root, a)
        if os.path.lexists(f):
            real = os.path.realpath(f)
            if not (real == root or real.startswith(root + os.sep)):
                raise LedgerError(f"gated action references a path outside the working tree: {a}")
    prog = resolve_program(argv[0], root, env)
    p = os.path.join(root, prog)
    if not os.path.isabs(prog):
        return None  # inside the tree: bound by the tree hash
    try:
        fd = os.open(p, os.O_RDONLY | os.O_NONBLOCK)
    except OSError as e:
        raise LedgerError(f"cannot open program {prog}: {e}") from e
    with os.fdopen(fd, "rb") as fh:
        if not stat.S_ISREG(os.fstat(fh.fileno()).st_mode):
            raise LedgerError(f"program is not a regular file: {prog}")
        data = fh.read(MAX_SNAPSHOT_BYTES + 1)
    if len(data) > MAX_SNAPSHOT_BYTES:
        raise LedgerError(f"program too large to bind: {prog}")
    return hashlib.sha256(data).hexdigest()


def action_hash(argv: list[str], cwd: str | None = None, snap: dict | None = None,
                env: dict[str, str] | None = None) -> str:
    import os
    doc: dict = {"kind": "command", "argv": argv}
    if cwd is not None:
        root = os.path.realpath(cwd)
        doc["program"] = resolve_program(argv[0], root, env)
        doc["program_sha256"] = _check_argv(argv, root, env)
        doc["tree_sha256"] = tree_hash(snap if snap is not None else snapshot(root))
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
    run_id, ah = events[0]["run_id"], action_hash(argv, root, snap, env)
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
            prog = _map_into_copy(resolve_program(argv[0], root, env), root, td)
            run_argv = [prog, *[_map_into_copy(a, root, td) for a in argv[1:]]]
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
