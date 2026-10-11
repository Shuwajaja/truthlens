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
from truthlens.ledger import Ledger, LedgerError

APPROVAL_TTL = timedelta(minutes=10)  # D6
BLOCKED = 3


def action_hash(argv: list[str]) -> str:
    return hashlib.sha256(canonical_bytes({"kind": "command", "argv": argv})).hexdigest()


def _iso(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _usable_approval(events: list[dict], ah: str) -> dict | None:
    consumed = {e["payload"].get("approval_event_id") for e in events if e["type"] == "action.executed"}
    now = _iso(datetime.now(UTC))
    for e in reversed(events):
        p = e["payload"]
        if (e["type"] == "approval.granted" and e["actor"]["kind"] == "human" and p.get("action_hash") == ah
                and p.get("simulated") is not True and e["id"] not in consumed
                and str(p.get("expires_at", ""))[:19] >= now[:19]):
            return e
    return None


def act(led: Ledger, actor: dict, argv: list[str], cwd: str | None = None,
        env: dict[str, str] | None = None) -> tuple[int, dict]:
    events = led.read()
    if not events:
        raise LedgerError("act needs an open run ledger")
    if events[-1]["type"] == "run.finished":
        raise LedgerError("run is closed")
    run_id, ah = events[0]["run_id"], action_hash(argv)
    appr = _usable_approval(events, ah)
    if appr is None:
        if not any(e["type"] == "action.blocked" and e["payload"].get("action_hash") == ah for e in events):
            led.append(run_id, actor, "action.requested", {"action_hash": ah, "action": {"argv": argv}})
            led.append(run_id, {"kind": "system", "id": "truthlens-gate"}, "action.blocked",
                       {"action_hash": ah, "policy": "requires_human_approval", "reason": "no valid approval"})
        return BLOCKED, {"action_hash": ah, "status": "blocked"}
    proc = subprocess.run(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL, capture_output=True, check=False)
    ev = led.append(run_id, {"kind": "system", "id": "truthlens-gate"}, "action.executed",
                    {"action_hash": ah, "approval_event_id": appr["id"],
                     "result": {"exit_code": proc.returncode}})
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
                rc, info = act(self.led, self.requester, argv, self.cwd, self.env)
            except (ValueError, KeyError, LedgerError) as e:
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
