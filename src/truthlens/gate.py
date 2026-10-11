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


def act(led: Ledger, actor: dict, argv: list[str], cwd: str | None = None) -> tuple[int, dict]:
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
    proc = subprocess.run(argv, cwd=cwd, stdin=subprocess.DEVNULL, capture_output=True, check=False)
    ev = led.append(run_id, {"kind": "system", "id": "truthlens-gate"}, "action.executed",
                    {"action_hash": ah, "approval_event_id": appr["id"],
                     "result": {"exit_code": proc.returncode}})
    return proc.returncode, {"action_hash": ah, "status": "executed", "event": ev["id"]}


def approve(led: Ledger, approver: str, ah: str) -> dict:
    events = led.read()
    if not any(e["type"] == "action.blocked" and e["payload"].get("action_hash") == ah for e in events):
        raise LedgerError("no blocked action with this hash")
    return led.append(events[0]["run_id"], {"kind": "human", "id": approver}, "approval.granted",
                      {"action_hash": ah, "approver": approver,
                       "expires_at": _iso(datetime.now(UTC) + APPROVAL_TTL)})
