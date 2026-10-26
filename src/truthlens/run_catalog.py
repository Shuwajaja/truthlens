"""Read human run projections from a project workspace. Never a broker response."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from truthlens.ids import new_id
from truthlens.ledger import Ledger, verify
from truthlens.run_view import RunViewRejected, load_declared_view, project_run, review_summary
from truthlens.workspace_store import WorkspaceError, load

MAX_IMPORT = 2 * 1024 * 1024


def _workspace_project(root: Path) -> str:
    path = root / ".truthlens" / "workspace.toml"
    if not path.is_file():
        return "local"
    try:
        document, _foreign = load(path)
    except WorkspaceError:
        return "local"
    return str(document["project_id"])


def _damaged(run_id: str, project_id: str, task: str) -> dict:
    return {
        "run_id": run_id,
        "project_id": project_id,
        "task": task or run_id,
        "problem": "damaged",
        "review_summary": "unclear",
        "execution": "interrupted",
        "audit_state": "unavailable",
        "integrity": "unknown",
        "counts": {"confirmed": 0, "refuted": 0, "unclear": 0},
        "synthetic": False,
        "demo": False,
        "excluded_from_metrics": True,
        "message": "Nachweis beschädigt oder inkonsistent",
    }


def _stored_view(directory: Path, project_id: str) -> dict | None:
    path = directory / "view.json"
    if not path.is_file() or path.stat().st_size > MAX_IMPORT:
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        view = load_declared_view(payload, None, project_id=project_id, imported=True)
    except (OSError, UnicodeError, json.JSONDecodeError, RunViewRejected):
        return None
    if view.get("integrity") == "hmac":
        view["integrity"] = "unknown"
        view["review_summary"] = review_summary(
            view["claims"], view["execution"], view["audit_state"], "unknown"
        )
    return view


def _item_from_dir(root: Path, directory: Path, *, origin: str) -> dict | None:
    ledger_path = directory / "ledger.jsonl"
    if not ledger_path.is_file():
        project_id = _workspace_project(root)
        view = _stored_view(directory, project_id)
        if view is None:
            return None
        return {
            "item": view,
            "synthetic": False,
            "demo": False,
            "excluded_from_metrics": False,
            "origin": "imported",
            "problem": None,
        }
    record: dict = {}
    record_path = directory / "record.json"
    if record_path.is_file():
        try:
            loaded = json.loads(record_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                record = loaded
        except (OSError, UnicodeError, json.JSONDecodeError):
            record = {}
    project_id = (
        record.get("project_id") if isinstance(record.get("project_id"), str) else _workspace_project(root)
    )
    task = record.get("task") if isinstance(record.get("task"), str) else None
    run_hint = record.get("run_id") if isinstance(record.get("run_id"), str) else directory.name
    checked = verify(ledger_path, None)
    if not checked.ok:
        return _damaged(run_hint, project_id, task or run_hint)
    try:
        view = project_run(
            Ledger(ledger_path).read(),
            project_id=project_id,
            audit_state=record.get("audit_state")
            if record.get("audit_state") in {"pending", "running", "complete", "unavailable"}
            else "pending",
            integrity="hash-only",
            task=task,
            agent_id=record.get("agent_id") if isinstance(record.get("agent_id"), str) else None,
            execution_override=record.get("execution") if record.get("execution") == "interrupted" else None,
            audit_revision=record.get("audit_revision")
            if isinstance(record.get("audit_revision"), str)
            else None,
            imported=origin == "imported" or record.get("origin") == "imported",
        )
    except RunViewRejected:
        return _damaged(run_hint, project_id, task or run_hint)
    synthetic = bool(record.get("synthetic"))
    demo = bool(record.get("demo"))
    return {
        "item": view,
        "synthetic": synthetic,
        "demo": demo,
        "excluded_from_metrics": synthetic or demo,
        "origin": record.get("origin") or origin,
        "problem": None,
    }


def collect(root: Path) -> list[dict]:
    items = []
    for origin, folder in (
        ("recorded", root / ".truthlens" / "runs"),
        ("imported", root / ".truthlens" / "imports"),
    ):
        if not folder.is_dir():
            continue
        for directory in sorted(folder.iterdir()):
            if directory.is_dir():
                item = _item_from_dir(root, directory, origin=origin)
                if item is not None:
                    items.append(item)
    items.sort(
        key=lambda item: (
            (item.get("item") or {}).get("started_at") or "",
            (item.get("item") or item).get("run_id", ""),
        )
    )
    return items


def public_list_item(entry: dict) -> dict:
    if entry.get("problem") == "damaged":
        return {
            key: entry[key]
            for key in (
                "run_id",
                "project_id",
                "task",
                "problem",
                "review_summary",
                "execution",
                "audit_state",
                "integrity",
                "counts",
                "synthetic",
                "demo",
                "excluded_from_metrics",
                "message",
            )
        }
    view = entry["item"]
    return {
        "run_id": view["run_id"],
        "project_id": view["project_id"],
        "task": view["task"],
        "agent_id": view.get("agent_id"),
        "execution": view["execution"],
        "audit_state": view["audit_state"],
        "integrity": view["integrity"],
        "review_summary": view["review_summary"],
        "counts": view["counts"],
        "started_at": view.get("started_at"),
        "synthetic": entry["synthetic"],
        "demo": entry["demo"],
        "excluded_from_metrics": entry["excluded_from_metrics"],
        "problem": None,
    }


def metrics(entries: list[dict]) -> dict[str, int]:
    counts = {"confirmed": 0, "refuted": 0, "unclear": 0}
    for entry in entries:
        if entry.get("excluded_from_metrics") or entry.get("problem") == "damaged":
            continue
        item = entry.get("item")
        if not item:
            continue
        for key in counts:
            counts[key] += item["counts"][key]
    return counts


def import_source(root: Path, source: Path) -> dict:
    if not source.exists():
        raise WorkspaceError("USAGE", "Importpfad fehlt", 2)
    job_id = new_id("job")
    quarantine = root / ".truthlens" / "quarantine" / job_id
    quarantine.mkdir(parents=True, exist_ok=False)
    if source.is_dir():
        ledger = source / "ledger.jsonl"
        if not ledger.is_file() or ledger.stat().st_size > MAX_IMPORT:
            raise WorkspaceError("IMPORT_REJECTED", "Import ist kein gültiges Exportbündel", 1)
        shutil.copyfile(ledger, quarantine / "ledger.jsonl")
        checked = verify(quarantine / "ledger.jsonl", None)
        if not checked.ok:
            raise WorkspaceError("DAMAGED", "Nachweis beschädigt oder inkonsistent", 1)
        view = project_run(
            Ledger(quarantine / "ledger.jsonl").read(),
            project_id=_workspace_project(root),
            audit_state="unavailable",
            integrity="hash-only",
            imported=True,
        )
    elif source.is_file() and source.suffix == ".json" and source.stat().st_size <= MAX_IMPORT:
        try:
            payload = json.loads(source.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise WorkspaceError("IMPORT_REJECTED", "Import ist kein gültiges Exportbündel", 1) from exc
        if not isinstance(payload, dict):
            raise WorkspaceError("IMPORT_REJECTED", "Import ist kein gültiges Exportbündel", 1)
        events = payload.get("events") if isinstance(payload.get("events"), list) else None
        view_doc = payload.get("item") if isinstance(payload.get("item"), dict) else payload
        try:
            view = load_declared_view(view_doc, events, project_id=_workspace_project(root), imported=True)
        except (RunViewRejected, KeyError, TypeError, ValueError) as exc:
            code = exc.code if isinstance(exc, RunViewRejected) else "IMPORT_REJECTED"
            message = (
                exc.message if isinstance(exc, RunViewRejected) else "Import ist kein gültiges Exportbündel"
            )
            raise WorkspaceError(code, message, 1) from exc
        if events is None:
            (quarantine / "bundle.json").write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
    else:
        raise WorkspaceError("USAGE", "Importpfad fehlt", 2)
    if view["integrity"] == "hmac" or view["review_summary"] == "confirmed":
        raise WorkspaceError("TRUST_NOT_RAISED", "Import hebt keinen Vertrauensstatus an", 1)
    destination = root / ".truthlens" / "imports" / view["run_id"]
    if destination.exists():
        raise WorkspaceError("IMPORT_REJECTED", "Import ist bereits vorhanden", 1)
    destination.mkdir(parents=True)
    if (quarantine / "ledger.jsonl").is_file():
        shutil.copyfile(quarantine / "ledger.jsonl", destination / "ledger.jsonl")
    record = {
        "run_id": view["run_id"],
        "project_id": view["project_id"],
        "task": view["task"],
        "origin": "imported",
        "synthetic": False,
        "demo": False,
        "audit_state": "unavailable",
        "execution": view["execution"],
    }
    (destination / "record.json").write_text(
        json.dumps(record, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    (destination / "view.json").write_text(json.dumps(view, ensure_ascii=False) + "\n", encoding="utf-8")
    return {
        "schema_version": 1,
        "job_id": job_id,
        "state": "complete",
        "run_id": view["run_id"],
        "integrity": view["integrity"],
    }
