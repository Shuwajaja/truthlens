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
MAX_BIND = 16 * 1024 * 1024


def referenced_files(argv: list[str], cwd: str | None) -> dict[str, str]:
    """sha256 of every argv element that names an existing regular file (relative to cwd), e.g. `sh deploy.sh`.
    Bound into the action hash so that editing the script after approval changes the hash (round-5 finding b)."""
    import os
    import shutil
    import stat
    root = os.path.realpath(cwd or ".")
    out = {}
    for i, a in enumerate(argv):
        f = os.path.join(root, a)
        if i == 0 and "/" not in a:  # program from PATH: bind its resolved binary too
            f = shutil.which(a) or f
        try:
            st = os.stat(f)
        except (OSError, ValueError):
            continue
        real = os.path.realpath(f)
        in_repo = real == root or real.startswith(root + os.sep)
        if not stat.S_ISREG(st.st_mode) or (i > 0 and not in_repo):
            continue  # only regular files; arguments only inside the repo (no /proc, devices)
        if st.st_size > MAX_BIND:
            raise LedgerError(f"referenced file too large to bind: {a}")
        with open(real, "rb") as fh:
            out[a] = hashlib.sha256(fh.read()).hexdigest()
    return out


def action_hash(argv: list[str], cwd: str | None = None) -> str:
    doc = {"kind": "command", "argv": argv}
    files = referenced_files(argv, cwd)
    if files:
        doc["files"] = files
    return hashlib.sha256(canonical_bytes(doc)).hexdigest()


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
    """`state` (held in the gate process memory) remembers the last seen ledger head and consumed approvals,
    so restoring an older signed ledger cannot re-arm a used approval (round-5 finding d)."""
    vr = verify(led.path, led.hmac_key)
    if not vr.ok:
        raise LedgerError(f"ledger does not verify, refusing to act: line {vr.errors[0][0]}: {vr.errors[0][1]}")
    events = led.read()
    if not events:
        raise LedgerError("act needs an open run ledger")
    if events[-1]["type"] == "run.finished":
        raise LedgerError("run is closed")
    if state is not None and state.get("head"):
        seq, h = state["head"]
        if not any(e["seq"] == seq and e["hash"] == h for e in events):
            raise LedgerError("ledger rollback detected: remembered head is missing")
    run_id, ah = events[0]["run_id"], action_hash(argv, cwd)
    appr = _usable_approval(events, ah)
    if appr is not None and state is not None and appr["id"] in state.setdefault("consumed", set()):
        appr = None
    if appr is None:
        if not any(e["type"] == "action.blocked" and e["payload"].get("action_hash") == ah for e in events):
            led.append(run_id, actor, "action.requested", {"action_hash": ah, "action": {"argv": argv}})
            led.append(run_id, {"kind": "system", "id": "truthlens-gate"}, "action.blocked",
                       {"action_hash": ah, "policy": "requires_human_approval", "reason": "no valid approval"})
        if state is not None:
            last = led.read()[-1]
            state["head"] = (last["seq"], last["hash"])
        return BLOCKED, {"action_hash": ah, "status": "blocked"}
    # reserve first (consumes the approval in the ledger), then execute, then record the outcome
    ev = led.append(run_id, {"kind": "system", "id": "truthlens-gate"}, "action.executed",
                    {"action_hash": ah, "approval_event_id": appr["id"], "result": "started"})
    if state is not None:
        state["consumed"].add(appr["id"])
        state["head"] = (ev["seq"], ev["hash"])
    if action_hash(argv, cwd) != ah:  # re-check right before execution (TOCTOU)
        raise LedgerError("referenced files changed after approval check, refusing to execute")
    proc = subprocess.run(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL, capture_output=True, check=False)
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
            except Exception as e:  # noqa: BLE001 - one bad request must never stop the gate thread
                rc, info = 2, {"status": "error", "error": str(e)}
            req.unlink()
            tmp = res.with_suffix(".tmp")
            tmp.write_text(json.dumps({"rc": rc, **info}))
            tmp.replace(res)

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
