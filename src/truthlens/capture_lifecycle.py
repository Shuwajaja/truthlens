"""Bounded capture lifecycle for a qualified operator launcher.

Status readers cannot open a run. Extension messages stay ``agent_reported``
and cannot mint witnessed events, approvals or a finished successful run.
An interrupted record stays interrupted.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from truthlens.ledger import Ledger
from truthlens.workspace_store import WorkspaceError

WRAPPER = {"kind": "wrapper", "id": "truthlens-recorder"}
AGENT = {"kind": "agent", "id": "extension"}
WITNESS_TYPES = {
    "run.started",
    "run.finished",
    "test.reported",
    "evidence.attached",
    "artifact.recorded",
    "approval.granted",
    "criteria.confirmed",
}
TERMINAL = {"completed", "failed", "cancelled", "interrupted"}


def _record_path(root: Path, run_id: str) -> Path:
    return root / ".truthlens" / "runs" / run_id / "record.json"


def _read_record(root: Path, run_id: str) -> dict:
    path = _record_path(root, run_id)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise WorkspaceError("RUN_MISSING", "Lauf nicht gefunden", 1) from exc
    if not isinstance(payload, dict) or payload.get("run_id") != run_id:
        raise WorkspaceError("RUN_MISSING", "Lauf nicht gefunden", 1)
    return payload


def _write_record(root: Path, record: dict) -> None:
    path = _record_path(root, record["run_id"])
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def _peer_role(peer: object | None) -> str | None:
    """Capture role is not a caller string and not a workspace.toml field.

    A G1 status peer may query status. It is not a capture operator, and this
    function does not read ``SO_PEERCRED`` or ``qualified_harness_version``.
    Production returns None. Tests may replace this function; that replacement
    does not qualify a live harness and cannot be switched on from a config file.
    """
    del peer
    return None


def start_run(*, root: Path, task: str, harness: str, project_id: str, peer: object | None = None) -> dict:
    """Refuse to open a ledger. There is no production launcher.

    ``peer`` is not a role name. ``workspace.toml`` is not consulted. A verified
    operator still gets ``NOT_QUALIFIED`` until a separate launcher exists.
    """
    del root, task, harness, project_id
    if _peer_role(peer) != "operator":
        return {"captured": False, "code": "START_REFUSED", "message": "Start durch diese Rolle verweigert"}
    return {
        "captured": False,
        "code": "NOT_QUALIFIED",
        "message": "Kein qualifizierter Agent-Zero-Launcher für die installierte Version",
    }


def mark_interrupted(*, root: Path, run_id: str, peer: object | None = None) -> dict:
    role = _peer_role(peer)
    if role not in {"operator", "recorder"}:
        return {
            "captured": True,
            "code": "START_REFUSED",
            "execution": _read_record(root, run_id)["execution"],
        }
    record = _read_record(root, run_id)
    if record["execution"] in TERMINAL and record["execution"] != "interrupted":
        return {"code": "ALREADY_CLOSED", "execution": record["execution"], "run_id": run_id}
    record["execution"] = "interrupted"
    _write_record(root, record)
    return {"code": "INTERRUPTED", "execution": "interrupted", "run_id": run_id}


def resume(*, root: Path, run_id: str, peer: object | None = None) -> dict:
    record = _read_record(root, run_id)
    if _peer_role(peer) != "operator" or record["execution"] == "interrupted":
        return {"code": "RESUME_REFUSED", "execution": record["execution"], "run_id": run_id}
    return {"code": "UNCHANGED", "execution": record["execution"], "run_id": run_id}


def finish(*, root: Path, run_id: str, exit_code: int, peer: object | None = None) -> dict:
    if _peer_role(peer) != "recorder":
        return {"code": "START_REFUSED", "message": "Nur der Recorder schließt die Aufnahme"}
    record = _read_record(root, run_id)
    if record["execution"] == "interrupted":
        return {"code": "RESUME_REFUSED", "execution": "interrupted", "run_id": run_id}
    if record["execution"] in TERMINAL:
        return {"code": "ALREADY_CLOSED", "execution": record["execution"], "run_id": run_id}
    ledger = Ledger(root / ".truthlens" / "runs" / run_id / "ledger.jsonl")
    previous = ledger.read()[-1]["hash"]
    status = "ok" if exit_code == 0 else "failed"
    ledger.append(
        run_id,
        WRAPPER,
        "run.finished",
        {
            "exit_code": exit_code,
            "status": status,
            "last_hash": previous,
        },
    )
    record["execution"] = "completed" if exit_code == 0 else "failed"
    _write_record(root, record)
    return {"code": "FINISHED", "execution": record["execution"], "run_id": run_id}


def ingest_extension(
    *,
    root: Path,
    run_id: str,
    project_id: str,
    message_id: str,
    text: str,
    event_type: str,
    peer: object | None = None,
) -> dict:
    if _peer_role(peer) != "extension":
        return {"accepted": False, "code": "START_REFUSED", "message": "Start durch diese Rolle verweigert"}
    if event_type in WITNESS_TYPES:
        return {
            "accepted": False,
            "code": "WITNESS_REFUSED",
            "message": "Extension kann keine bezeugten Ereignisse schreiben",
        }
    record = _read_record(root, run_id)
    if project_id != record["project_id"]:
        return {"accepted": False, "code": "PROJECT_MISMATCH", "message": "Projektzuordnung stimmt nicht"}
    for existing in record["inbox"]:
        if existing["message_id"] == message_id:
            return {
                "accepted": True,
                "code": "DUPLICATE",
                "observation": "agent_reported",
                "count": len(record["inbox"]),
            }
    record["inbox"].append(
        {
            "message_id": message_id,
            "text": text,
            "event_type": "agent.reported",
            "observation": "agent_reported",
        }
    )
    _write_record(root, record)
    kinds = []
    for line in (
        (root / ".truthlens" / "runs" / run_id / "ledger.jsonl").read_text(encoding="utf-8").splitlines()
    ):
        if line:
            kinds.append(json.loads(line).get("type"))
    if any(kind in WITNESS_TYPES and kind != "run.started" for kind in kinds):
        return {"accepted": False, "code": "WITNESS_REFUSED", "message": "Bezeugtes Ereignis wurde abgelehnt"}
    return {
        "accepted": True,
        "code": "REPORTED",
        "observation": "agent_reported",
        "count": len(record["inbox"]),
    }
