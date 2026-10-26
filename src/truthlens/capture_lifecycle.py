"""Bounded capture lifecycle for a qualified operator launcher.

Status readers cannot open a run. Extension messages stay ``agent_reported``
and cannot mint witnessed events, approvals or a finished successful run.
An interrupted record stays interrupted.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from truthlens.ids import new_id
from truthlens.ledger import Ledger
from truthlens.workspace_store import WorkspaceError, load

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


def _qualified(root: Path, harness: str) -> str | None:
    document, _foreign = load(root / ".truthlens" / "workspace.toml")
    for item in document["adapters"]:
        if item["id"] == harness:
            version = item.get("qualified_harness_version")
            return version if isinstance(version, str) and version else None
    return None


def start_run(*, role: str, root: Path, task: str, harness: str, project_id: str) -> dict:
    if role != "operator":
        return {"captured": False, "code": "START_REFUSED", "message": "Start durch diese Rolle verweigert"}
    if harness != "agent-zero":
        return {
            "captured": False,
            "code": "NOT_QUALIFIED",
            "message": "Manueller Import oder nicht verbunden",
        }
    try:
        version = _qualified(root, harness)
    except WorkspaceError as exc:
        return {"captured": False, "code": exc.code, "message": exc.message}
    if version != "test-fixture":
        return {
            "captured": False,
            "code": "NOT_QUALIFIED",
            "message": "Kein qualifizierter Agent-Zero-Launcher für die installierte Version",
        }
    if not task.strip():
        return {"captured": False, "code": "USAGE", "message": "Aufgabe fehlt"}
    run_id = new_id("run")
    destination = root / ".truthlens" / "runs" / run_id
    destination.mkdir(parents=True, exist_ok=True)
    Ledger(destination / "ledger.jsonl").append(
        run_id,
        WRAPPER,
        "run.started",
        {"repo": str(root), "ref": "", "command": task, "agent": harness},
    )
    record = {
        "run_id": run_id,
        "project_id": project_id,
        "task": task,
        "harness": harness,
        "execution": "running",
        "qualified_harness_version": version,
        "fixture_qualification": version == "test-fixture",
        "inbox": [],
    }
    _write_record(root, record)
    return {"captured": True, "code": "STARTED", "run_id": run_id, "execution": "running", "record": record}


def mark_interrupted(*, role: str, root: Path, run_id: str) -> dict:
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


def resume(*, role: str, root: Path, run_id: str) -> dict:
    record = _read_record(root, run_id)
    if role != "operator" or record["execution"] == "interrupted":
        return {"code": "RESUME_REFUSED", "execution": record["execution"], "run_id": run_id}
    return {"code": "UNCHANGED", "execution": record["execution"], "run_id": run_id}


def finish(*, role: str, root: Path, run_id: str, exit_code: int) -> dict:
    if role != "recorder":
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
    role: str,
    root: Path,
    run_id: str,
    project_id: str,
    message_id: str,
    text: str,
    event_type: str,
) -> dict:
    if role != "extension":
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
