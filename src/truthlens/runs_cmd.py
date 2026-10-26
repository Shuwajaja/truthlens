"""Human run list, projection, recheck and import. Not an agent tool."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import ClassVar

from truthlens.audit import audit_run
from truthlens.human_io import color_enabled, emit_json, error_payload, fail, paint, reference_enabled
from truthlens.ids import new_id
from truthlens.run_catalog import collect, import_source, public_list_item
from truthlens.workspace_store import WorkspaceError, resolve_root

LABELS = {"confirmed": "bestätigt", "refuted": "widerlegt", "unclear": "unklar"}


class _Parser(argparse.ArgumentParser):
    argv: ClassVar[list[str]] = []

    def error(self, message: str) -> None:
        if "--json" in self.argv:
            emit_json(error_payload("USAGE", "Aufruf unvollständig"))
        else:
            self.print_usage(sys.stderr)
            sys.stderr.write(f"error: {message}\n")
        raise SystemExit(2)


def _root(args: argparse.Namespace) -> Path:
    return resolve_root(args.root or os.getcwd())


def _stamp(value: str | None) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed


def _matches(entry: dict, args: argparse.Namespace) -> bool:
    view = entry.get("item") or entry
    if args.project and view.get("project_id") != args.project:
        return False
    if args.agent and view.get("agent_id") != args.agent:
        return False
    if args.status and view.get("review_summary") != args.status:
        return False
    if entry.get("problem") == "damaged" and args.status:
        return False
    if args.since:
        started = _stamp(view.get("started_at"))
        threshold = _stamp(args.since)
        if threshold is None:
            raise WorkspaceError("USAGE", "Zeitfilter ist kein UTC-Zeitstempel", 2)
        if started is None or started < threshold:
            return False
    return True


def _list(args: argparse.Namespace) -> int:
    try:
        root = _root(args)
        if args.since and _stamp(args.since) is None:
            return fail("USAGE", "Zeitfilter ist kein UTC-Zeitstempel", as_json=args.json, status=2)
        entries = [entry for entry in collect(root) if _matches(entry, args)]
    except WorkspaceError as exc:
        return fail(exc.code, exc.message, as_json=args.json, status=exc.status)
    offset = 0
    if args.cursor:
        if not args.cursor.startswith("c:") or not args.cursor[2:].isdigit():
            return fail("USAGE", "Cursor ist ungültig", as_json=args.json, status=2)
        offset = int(args.cursor[2:])
    window = entries[offset : offset + args.limit]
    next_offset = offset + args.limit
    payload = {
        "schema_version": 1,
        "items": [public_list_item(entry) for entry in window],
        "next_cursor": f"c:{next_offset}" if next_offset < len(entries) else None,
    }
    if args.json:
        emit_json(payload)
        return 0
    colored = color_enabled(sys.argv)
    sys.stdout.write(f"{'LAUF':<12} {'AGENT':<12} {'AUFGABE':<32} {'✓':>3} {'✗':>3} {'?':>3}  ERGEBNIS\n")
    for item in payload["items"]:
        counts = item["counts"]
        label = (
            "beschädigt" if item.get("problem") == "damaged" else LABELS.get(item["review_summary"], "unklar")
        )
        agent = str(item.get("agent_id") or "—")
        task = str(item["task"]).replace("\n", " ")
        if len(task) > 32:
            task = task[:31] + "…"
        line = (
            f"{item['run_id'][-10:]:<12} {agent[:12]:<12} {task:<32} "
            f"{counts['confirmed']:>3} {counts['refuted']:>3} {counts['unclear']:>3}  {label}"
        )
        color = {"bestätigt": "32", "widerlegt": "31", "unklar": "33", "beschädigt": "31"}[label]
        sys.stdout.write(paint(line, color, colored) + "\n")
    return 0


def _find(root: Path, run_id: str) -> dict | None:
    for entry in collect(root):
        view = entry.get("item") or entry
        if view.get("run_id") == run_id:
            return entry
    return None


def _show(args: argparse.Namespace) -> int:
    try:
        root = _root(args)
    except WorkspaceError as exc:
        return fail(exc.code, exc.message, as_json=args.json, status=exc.status)
    entry = _find(root, args.run_id)
    if entry is None:
        return fail("RUN_MISSING", "Lauf nicht gefunden", as_json=args.json, status=1)
    if entry.get("problem") == "damaged":
        return fail("DAMAGED", "Nachweis beschädigt oder inkonsistent", as_json=args.json, status=1)
    view = entry["item"]
    if args.json:
        emit_json({"schema_version": 1, "demo": entry["demo"], "item": view})
        return 0
    label = LABELS[view["review_summary"]]
    sys.stdout.write(f"{view['run_id']}  {view['task']}  {label}\n")
    sys.stdout.write(
        f"Integrität: {view['integrity']} · Audit: {view['audit_state']} · Ausführung: {view['execution']}\n"
    )
    sys.stdout.write("Integrität ist keine Freigabe.\n")
    if entry["demo"]:
        sys.stdout.write("Beispieldaten\n")
    if args.timeline:
        for event in view["timeline"]:
            marker = {"captured": "●", "agent_reported": "○", "imported": "◇"}[event["observation"]]
            sys.stdout.write(f"{marker} {event['timestamp']} {event['title']} — {event['detail']}\n")
    return 0


def _recheck(args: argparse.Namespace) -> int:
    try:
        root = _root(args)
    except WorkspaceError as exc:
        return fail(exc.code, exc.message, as_json=args.json, status=exc.status)
    entry = _find(root, args.run_id)
    if entry is None or entry.get("problem") == "damaged":
        return fail("RUN_MISSING", "Lauf nicht gefunden", as_json=args.json, status=1)
    view = entry["item"]
    directory = (
        root / ".truthlens" / ("imports" if entry.get("origin") == "imported" else "runs") / view["run_id"]
    )
    record_path = directory / "record.json"
    try:
        record = json.loads(record_path.read_text(encoding="utf-8")) if record_path.is_file() else {}
    except (OSError, UnicodeError, json.JSONDecodeError):
        record = {}
    current = record.get("audit_revision")
    if args.expected_revision is not None and args.expected_revision != (current or ""):
        return fail("REVISION_CONFLICT", "Auditrevision hat sich geändert", as_json=args.json, status=1)
    job_id = new_id("job")
    jobs = root / ".truthlens" / "jobs"
    jobs.mkdir(parents=True, exist_ok=True)
    job = {
        "schema_version": 1,
        "job_id": job_id,
        "state": "queued",
        "kind": "recheck",
        "run_id": view["run_id"],
    }
    (jobs / f"{job_id}.json").write_text(json.dumps(job) + "\n", encoding="utf-8")
    try:
        report = audit_run(directory)
    except Exception:  # noqa: BLE001 -- fixed diagnosis, no traceback to the operator
        job["state"] = "failed"
        (jobs / f"{job_id}.json").write_text(json.dumps(job) + "\n", encoding="utf-8")
        return fail("RECHECK_FAILED", "Auditjob ist fehlgeschlagen", as_json=args.json, status=1)
    conclusion = report.get("conclusion") if isinstance(report, dict) else None
    revision = str(int(current) + 1) if isinstance(current, str) and current.isdigit() else "1"
    revisions = directory / "revisions"
    revisions.mkdir(exist_ok=True)
    (revisions / f"{revision}.json").write_text(
        json.dumps({"conclusion": conclusion}) + "\n", encoding="utf-8"
    )
    judged = conclusion in {"supported_within_scope", "contradictory"}
    record.update(
        {
            "run_id": view["run_id"],
            "project_id": view["project_id"],
            "task": view["task"],
            "audit_revision": revision,
            "audit_state": "complete" if judged else "unavailable",
            "origin": entry.get("origin") or record.get("origin") or "recorded",
            "synthetic": bool(record.get("synthetic")),
            "demo": bool(record.get("demo")),
        }
    )
    record_path.write_text(json.dumps(record) + "\n", encoding="utf-8")
    job["state"] = "complete"
    (jobs / f"{job_id}.json").write_text(json.dumps(job) + "\n", encoding="utf-8")
    payload = {"schema_version": 1, "job_id": job_id, "state": "complete"}
    if args.json:
        emit_json(payload)
    else:
        sys.stdout.write(f"Neue Auditrevision {revision}; die vorherige bleibt erhalten.\n")
    return 0


def _import(args: argparse.Namespace) -> int:
    try:
        root = _root(args)
        payload = import_source(root, Path(args.path))
    except WorkspaceError as exc:
        return fail(exc.code, exc.message, as_json=args.json, status=exc.status)
    if args.json:
        emit_json({"schema_version": 1, "job_id": payload["job_id"], "state": payload["state"]})
    else:
        sys.stdout.write("Import geprüft. Der Vertrauensstatus wurde nicht angehoben.\n")
    return 0


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not reference_enabled():
        return fail(
            "REFERENCE_DISABLED", "Referenzbefehle sind abgeschaltet", as_json="--json" in argv, status=2
        )
    _Parser.argv = argv
    parser = _Parser(prog="truthlens runs")
    sub = parser.add_subparsers(dest="cmd", required=True)

    def add_common(target: argparse.ArgumentParser) -> None:
        target.add_argument("--json", action="store_true")
        target.add_argument("--quiet", action="store_true")
        target.add_argument("--no-color", action="store_true")
        target.add_argument("--root")

    listing = sub.add_parser("list")
    add_common(listing)
    listing.add_argument("--limit", type=int, default=50)
    listing.add_argument("--project")
    listing.add_argument("--agent")
    listing.add_argument("--status", choices=("confirmed", "refuted", "unclear"))
    listing.add_argument("--since")
    listing.add_argument("--cursor")
    show = sub.add_parser("show")
    add_common(show)
    show.add_argument("run_id")
    show.add_argument("--timeline", action="store_true")
    recheck = sub.add_parser("recheck")
    add_common(recheck)
    recheck.add_argument("run_id")
    recheck.add_argument("--expected-revision")
    incoming = sub.add_parser("import")
    add_common(incoming)
    incoming.add_argument("path")
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        return exc.code if isinstance(exc.code, int) else 2
    if getattr(args, "limit", 50) is not None and getattr(args, "cmd", "") == "list" and args.limit < 1:
        return fail("USAGE", "Limit ist ungültig", as_json=args.json, status=2)
    return {"list": _list, "show": _show, "recheck": _recheck, "import": _import}[args.cmd](args)
