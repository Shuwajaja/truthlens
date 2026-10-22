"""Read-only projections for a future authenticated gateway, never registration."""

from __future__ import annotations

from truthlens.audit import _json
from truthlens.audit_inputs import SafeRunReader
from truthlens.pipeline import check_snapshot
from truthlens.pipeline_jobs import status
from truthlens.registry import Registry, deny


def summary(store: Registry, run_id: str, uid: int, session_id: str) -> dict:
    if not isinstance(session_id, str) or not session_id:
        deny()
    return status(store, run_id, uid, session_id)


def events(
    store: Registry, run_id: str, uid: int, session_id: str, after_seq: int, before_seq: int | None = None
) -> dict:
    if not isinstance(session_id, str) or not session_id:
        deny()
    if type(after_seq) is not int or not 0 <= after_seq <= 100000:
        deny()
    registration = store.run(run_id, uid, session_id)
    check_snapshot(store, registration)
    root = store.root / "snapshots" / registration["dispatch_id"]
    with SafeRunReader(root) as reader:
        raw = reader.read("ledger.jsonl", limit=reader.limits.ledger_bytes)
        all_events = [_json(line) for line in raw.splitlines()]
        reader.finish()
    if after_seq > len(all_events):
        deny()
    if before_seq is not None:
        if type(before_seq) is not int or not 1 <= before_seq <= len(all_events) + 1 or after_seq != 0:
            deny()
        selected = all_events[max(0, before_seq - 6) : before_seq - 1]
    else:
        selected = all_events[-5:] if after_seq == 0 else all_events[after_seq : after_seq + 5]
    projected = []
    for event in selected:
        payload = event["payload"]
        item = {
            "run_id": run_id,
            "seq": event["seq"],
            "hash": event["hash"],
            "type": event["type"],
            "actor": event["actor"]["kind"],
            "recorded_at": event["ts"],
            "evidence_refs": [payload[k] for k in ("sha256", "report_artifact_id") if k in payload],
        }
        if event["type"] == "test.reported":
            item["result"] = {
                k: payload[k]
                for k in ("passed", "failed", "skipped", "exit_code")
                if type(payload.get(k)) is int
            }
        projected.append(item)
    return {
        "run_id": run_id,
        "events": projected,
        "next_seq": selected[-1]["seq"] if selected else after_seq,
        "has_more": bool(selected and selected[0]["seq"] > 1),
        "audit": summary(store, run_id, uid, session_id),
        "provisional": False,
        "connection": "not connected",
    }
