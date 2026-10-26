"""Human workspace commands. They do not change ``init``, ``doctor`` or agent status."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import ClassVar

from truthlens.human_io import (
    color_enabled,
    emit_json,
    error_payload,
    fail,
    paint,
    reference_enabled,
    write_banner,
)
from truthlens.ids import new_id
from truthlens.ledger import Ledger
from truthlens.workspace_store import (
    HARNESSES,
    WorkspaceError,
    adapter,
    blank,
    check_profile,
    config_path,
    load,
    read_managed,
    resolve_root,
    save,
    slug,
    write_managed,
)

WRAPPER = {"kind": "wrapper", "id": "truthlens-workspace-test"}


class _Parser(argparse.ArgumentParser):
    argv: ClassVar[list[str]] = []

    def error(self, message: str) -> None:
        if "--json" in self.argv:
            emit_json(error_payload("USAGE", "Aufruf unvollständig"))
        else:
            self.print_usage(sys.stderr)
            sys.stderr.write(f"error: {message}\n")
        raise SystemExit(2)


def _now() -> str:
    moment = datetime.now(UTC)
    return moment.strftime("%Y-%m-%dT%H:%M:%S.") + f"{moment.microsecond // 1000:03d}Z"


def _check(code: str, state: str, message: str) -> dict:
    return {"code": code, "state": state, "message": message, "observed_at": _now()}


def _root_from(args: argparse.Namespace) -> Path:
    return resolve_root(args.root or os.getcwd())


def _say(args: argparse.Namespace, symbol: str, text: str, color: str) -> None:
    if args.json or (args.quiet and symbol != "✗"):
        return
    line = f"{paint(symbol, color, color_enabled(sys.argv))} {text}"
    sys.stdout.write(line + "\n")


_HOOK = """#!/usr/bin/env python3
\"\"\"Record one task-end note. This file does not open a ledger.\"\"\"
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
text = " ".join(sys.argv[1:]).strip()
if not text and not sys.stdin.isatty():
    text = sys.stdin.read(4000).strip()
if not text:
    sys.stderr.write("Aufgabe fehlt\\n")
    raise SystemExit(2)
inbox = root / "inbox"
inbox.mkdir(parents=True, exist_ok=True)
payload = {
    "schema_version": 1,
    "kind": "agent_reported",
    "text": text[:4000],
    "observed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}
path = inbox / "task-end.jsonl"
fd = os.open(path, os.O_APPEND | os.O_CREAT | os.O_WRONLY, 0o644)
with os.fdopen(fd, "a", encoding="utf-8") as handle:
    handle.write(json.dumps(payload, ensure_ascii=False) + "\\n")
    handle.flush()
    os.fsync(handle.fileno())
sys.stdout.write("Agentenbericht gespeichert. Kein Lauf geöffnet.\\n")
"""


def _detect(root: Path) -> tuple[str, str, list[str]]:
    found: list[str] = []
    if (root / ".agent-zero").is_dir() or (root / "AGENTS.md").is_file():
        found.append("agent-zero")
    if (root / ".codex").is_dir():
        found.append("codex")
    if (root / ".claude").is_dir():
        found.append("claude-code")
    if (root / "agy.toml").is_file():
        found.append("agy")
    if not found:
        raise WorkspaceError("USAGE", "Kein Adapter im Projekt gefunden", 2)
    return slug(root.name), "local", found


def _install_hook(root: Path) -> Path:
    path = root / ".truthlens" / "hooks" / "task-end"
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o755)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(_HOOK)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)
    os.chmod(path, 0o755)
    return path


_INIT_VALUES = {"--root", "--config", "--project", "--harness", "--target"}


def redirect_bare_init(argv: list[str]) -> int | None:
    """`truthlens init` without a ledger path sets up the workspace when enabled."""
    if not reference_enabled() or argv[:1] != ["init"]:
        return None
    items = argv[1:]
    index = 0
    while index < len(items):
        item = items[index]
        flag = item.split("=", 1)[0]
        if flag in {"--repo", "--ref", "--command", "--agent"} or not item.startswith("-"):
            return None
        index += 2 if flag in _INIT_VALUES and "=" not in item else 1
    return main(argv)


def _init(args: argparse.Namespace) -> int:
    try:
        root = _root_from(args)
        harnesses: list[str]
        if args.project and args.target and args.harness:
            profile = check_profile(args.target)
            project = slug(args.project)
            display = args.project
            harnesses = list(args.harness)
        elif args.project or args.target or args.harness:
            return fail(
                "USAGE",
                "Projekt, Zielprofil und mindestens ein Adapter sind erforderlich",
                as_json=args.json,
                status=2,
            )
        else:
            project, profile, harnesses = _detect(root)
            display = project
    except WorkspaceError as exc:
        return fail(exc.code, exc.message, as_json=args.json, status=exc.status)
    path = config_path(root, args.config)
    foreign: dict = {}
    managed = read_managed(path) if path.is_file() else []
    try:
        if path.is_file():
            document, foreign = load(path)
            if document["project_id"] != project:
                return fail(
                    "PROJECT_MISMATCH",
                    "Workspace gehört zu einem anderen Projekt",
                    as_json=args.json,
                    status=1,
                )
        else:
            document = blank(display, root, profile)
    except WorkspaceError as exc:
        return fail(exc.code, exc.message, as_json=args.json, status=exc.status)
    changes: list[str] = []
    warnings: list[str] = []
    if document["target_profile"] != profile:
        document["target_profile"] = profile
        changes.append("Zielprofil aktualisieren")
    if document["display_name"] != display:
        document["display_name"] = display
        changes.append("Anzeigename aktualisieren")
    for harness in harnesses:
        if harness not in HARNESSES:
            return fail("USAGE", "Unbekannter Adapter", as_json=args.json, status=2)
        desired = adapter(harness)
        current = next((item for item in document["adapters"] if item["id"] == harness), None)
        if current is None:
            document["adapters"].append(desired)
            managed.append(harness)
            changes.append(f"Adapter {harness} hinzufügen")
        elif harness not in managed:
            return fail("FOREIGN_CONFIG", "Fremder Adapter bleibt unverändert", as_json=args.json, status=1)
        warnings.append(f"{harness}: Live-Aufzeichnung noch nicht qualifiziert")
    payload = {
        "schema_version": 1,
        "operation": "workspace.init",
        "applied": False,
        "changes": changes,
        "warnings": warnings,
    }
    _say(args, "◆", f"Projekt: {project}", "36")
    for change in changes:
        _say(args, "◆", f"Geplante Änderung: {change}", "36")
    for warning in warnings:
        _say(args, "⚠", warning, "33")
    if args.dry_run:
        _say(args, "◆", "Keine Änderungen vorgenommen", "36")
    elif not args.yes:
        return fail("USAGE", "--yes oder --dry-run ist erforderlich", as_json=args.json, status=2)
    else:
        try:
            save(path, document, foreign)
            write_managed(path, managed)
        except WorkspaceError as exc:
            return fail(exc.code, exc.message, as_json=args.json, status=exc.status)
        hook = _install_hook(root)
        payload["applied"] = True
        payload["hook"] = hook.name
        _say(args, "✔", "Workspace geschrieben", "32")
        _say(args, "✔", f"Hook geschrieben {hook.relative_to(root)}", "32")
        _say(args, "⚠", "Der Hook speichert einen Agentenbericht und öffnet keinen Lauf", "33")
    if args.json:
        emit_json(payload)
    return 0


def _unlink(args: argparse.Namespace) -> int:
    if not args.harness:
        return fail("USAGE", "Adapter fehlt", as_json=args.json, status=2)
    try:
        root = _root_from(args)
        path = config_path(root, args.config)
        document, foreign = load(path)
    except WorkspaceError as exc:
        return fail(exc.code, exc.message, as_json=args.json, status=exc.status)
    managed = read_managed(path)
    if args.harness not in managed:
        return fail(
            "FOREIGN_CONFIG", "Nur eigene Adapter-Einträge werden entfernt", as_json=args.json, status=1
        )
    kept = [item for item in document["adapters"] if item["id"] != args.harness]
    changes = [f"Adapter {args.harness} entfernen"] if len(kept) != len(document["adapters"]) else []
    document["adapters"] = kept
    applied = False
    if args.dry_run:
        pass
    elif not args.yes:
        return fail("USAGE", "--yes oder --dry-run ist erforderlich", as_json=args.json, status=2)
    else:
        save(path, document, foreign)
        write_managed(path, [item for item in managed if item != args.harness])
        applied = True
    if args.json:
        emit_json(
            {"schema_version": 1, "applied": applied, "changes": changes if applied or args.dry_run else []}
        )
    else:
        _say(args, "◆", changes[0] if changes else "Keine Änderung", "36")
    return 0


def _doctor(args: argparse.Namespace) -> int:
    try:
        root = _root_from(args)
    except WorkspaceError as exc:
        return fail(exc.code, exc.message, as_json=args.json, status=exc.status)
    checks = []
    path = config_path(root, args.config)
    document = None
    if not path.is_file():
        checks.append(_check("workspace", "warning", "Workspace ist noch nicht eingerichtet"))
    else:
        try:
            document, _foreign = load(path)
            checks.append(_check("workspace", "ok", "Workspace ist gültig und lesbar"))
        except WorkspaceError:
            checks.append(_check("workspace", "error", "Workspace ist ungültig oder unlesbar"))
    if document is None or not document["adapters"]:
        checks.append(_check("capture_adapter", "not_configured", "Kein Adapter konfiguriert"))
    else:
        qualified = [item for item in document["adapters"] if item.get("qualified_harness_version")]
        broken = [item for item in document["adapters"] if not item.get("capabilities")]
        if broken:
            checks.append(_check("capture_adapter", "error", "Konfigurierte Integration ist unvollständig"))
        elif qualified:
            checks.append(
                _check(
                    "capture_adapter",
                    "warning",
                    "Qualifikation ist eingetragen, Live-Aufzeichnung nicht nachgewiesen",
                )
            )
        else:
            checks.append(
                _check(
                    "capture_adapter", "warning", "Adapter ist nur eingetragen oder die Version ist unbekannt"
                )
            )
    runs = root / ".truthlens" / "runs"
    if runs.is_dir() and any(runs.iterdir()):
        checks.append(_check("heartbeat", "warning", "Lebenszeichen wurde nicht gegen einen Dienst geprüft"))
    else:
        checks.append(_check("heartbeat", "ok", "Kein letzter Lauf ist bei einem neuen Projekt normal"))
    unreachable = False
    channel = _output_channel(root)
    if channel[0] == "unreachable":
        unreachable = True
        checks.append(_check("output_channel", "error", channel[1]))
    else:
        checks.append(_check("output_channel", channel[0], channel[1]))
    receipt = root / ".truthlens" / "test-receipt.json"
    if receipt.is_file():
        checks.append(
            _check(
                "agent_status",
                "warning",
                "Lokaler Synthesetest vorhanden; autorisierter Pfad nicht nachgewiesen",
            )
        )
    else:
        checks.append(
            _check(
                "agent_status",
                "warning",
                "Konfiguration wurde nicht durch einen synthetischen Test nachgewiesen",
            )
        )
    hook = root / ".truthlens" / "hooks" / "task-end"
    if hook.is_file():
        checks.append(_check("task_hook", "ok", "Hook-Datei liegt bereit und öffnet keinen Lauf"))
    else:
        checks.append(_check("task_hook", "warning", "Kein Task-Hook installiert"))
    checks.append(_check("isolation", "unverified", "Isolation ist nicht geprüft"))
    summary = {"ok": 0, "warning": 0, "error": 0}
    for item in checks:
        if item["state"] == "ok":
            summary["ok"] += 1
        elif item["state"] in {"warning", "unverified"}:
            summary["warning"] += 1
        elif item["state"] == "error":
            summary["error"] += 1
    report = {"schema_version": 1, "checks": checks, "summary": summary, "isolation": "unverified"}
    if args.json:
        emit_json(report)
    else:
        if not args.quiet:
            write_banner(compact=True)
        for item in checks:
            mark = {"ok": "✔", "warning": "⚠", "error": "✗", "unverified": "⚠", "not_configured": "·"}[
                item["state"]
            ]
            color = {"ok": "32", "warning": "33", "error": "31", "unverified": "33", "not_configured": "37"}[
                item["state"]
            ]
            _say(args, mark, f"{item['code']}: {item['message']}", color)
        warn_word = "Warnung" if summary["warning"] == 1 else "Warnungen"
        error_word = "Fehler"
        sys.stdout.write(
            f"{summary['ok']} ok · {summary['warning']} {warn_word} · {summary['error']} {error_word}\n"
        )
    if unreachable:
        return 4
    if summary["error"]:
        return 1
    if args.strict and summary["warning"]:
        return 3
    return 0


def _output_channel(root: Path) -> tuple[str, str]:
    pointer = root / ".truthlens" / "reader-target"
    if not pointer.is_file():
        return "warning", "Ausgabe nur lokal vorhanden; kein Reader konfiguriert"
    try:
        text = pointer.read_text(encoding="utf-8").strip()
    except (OSError, UnicodeError):
        return "unreachable", "Verbindung nicht erreichbar"
    path = Path(text)
    if "://" in text or path.is_absolute() or ".." in path.parts or not text:
        return "unreachable", "Verbindung nicht erreichbar"
    candidate = (root / path).resolve()
    if candidate != root and root not in candidate.parents:
        return "unreachable", "Verbindung nicht erreichbar"
    if not candidate.is_dir():
        return "unreachable", "Verbindung nicht erreichbar"
    return "ok", "Lokaler Ausgabekanal ist lesbar"


def _test(args: argparse.Namespace) -> int:
    try:
        root = _root_from(args)
        path = config_path(root, args.config)
        load(path)
    except WorkspaceError as exc:
        return fail(exc.code, exc.message, as_json=args.json, status=exc.status)
    try:
        project_id = slug(args.project) if args.project else load(path)[0]["project_id"]
    except WorkspaceError as exc:
        return fail(exc.code, exc.message, as_json=args.json, status=exc.status)
    run_id = new_id("run")
    directory = root / ".truthlens" / "runs" / run_id
    directory.mkdir(parents=True)
    ledger = Ledger(directory / "ledger.jsonl")
    ledger.append(
        run_id,
        WRAPPER,
        "run.started",
        {
            "repo": str(root),
            "ref": "",
            "command": "truthlens workspace test",
            "agent": "workspace-test",
        },
    )
    record = {
        "run_id": run_id,
        "project_id": project_id,
        "task": "truthlens workspace test",
        "execution": "running",
        "synthetic": True,
        "demo": False,
        "origin": "workspace-test",
        "audit_state": "unavailable",
        "excluded_from_metrics": True,
    }
    (directory / "record.json").write_text(json.dumps(record) + "\n", encoding="utf-8")
    try:
        completed = subprocess.run(
            [sys.executable, "-c", "print('truthlens-workspace-test')"],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        record["execution"] = "interrupted"
        (directory / "record.json").write_text(json.dumps(record) + "\n", encoding="utf-8")
        return fail("TEST_INTERRUPTED", "Synthesetest wurde unterbrochen", as_json=args.json, status=1)
    previous = ledger.read()[-1]["hash"]
    code = completed.returncode
    ledger.append(
        run_id,
        WRAPPER,
        "run.finished",
        {
            "exit_code": code,
            "status": "ok" if code == 0 else "failed",
            "last_hash": previous,
        },
    )
    record["execution"] = "completed" if code == 0 else "failed"
    (directory / "record.json").write_text(json.dumps(record) + "\n", encoding="utf-8")
    receipt = {
        "schema_version": 1,
        "synthetic": True,
        "excluded_from_metrics": True,
        "run_id": run_id,
        "exit_code": code,
        "observed_at": _now(),
    }
    (root / ".truthlens" / "test-receipt.json").write_text(json.dumps(receipt) + "\n", encoding="utf-8")
    payload = {"schema_version": 1, "job_id": run_id, "state": "complete" if code == 0 else "failed"}
    if args.json:
        emit_json(payload)
    else:
        _say(
            args,
            "✓" if code == 0 else "✗",
            f"Synthesetest {payload['state']} ({run_id})",
            "32" if code == 0 else "31",
        )
    return 0 if code == 0 else 1


def _repair(args: argparse.Namespace) -> int:
    if args.check != "duplicate-adapters":
        return fail("USAGE", "Unbekannter Reparaturcode", as_json=args.json, status=2)
    try:
        root = _root_from(args)
        path = config_path(root, args.config)
        document, foreign = load(path)
    except WorkspaceError as exc:
        return fail(exc.code, exc.message, as_json=args.json, status=exc.status)
    seen: set[str] = set()
    kept = []
    removed = []
    for item in document["adapters"]:
        if item["id"] in seen:
            removed.append(item["id"])
        else:
            seen.add(item["id"])
            kept.append(item)
    changes = [f"Doppelten Adapter {item} entfernen" for item in removed]
    applied = False
    if args.apply:
        if not args.yes:
            return fail("USAGE", "--apply braucht --yes", as_json=args.json, status=2)
        if removed:
            backup = path.with_suffix(".toml.bak")
            shutil.copyfile(path, backup)
            document["adapters"] = kept
            save(path, document, foreign)
            applied = True
            changes.append(f"Sicherung {backup.name}")
    if args.json:
        emit_json({"schema_version": 1, "applied": applied, "changes": changes})
    else:
        _say(args, "◆", "Reparaturplan" if not applied else "Reparatur angewendet", "36")
        for change in changes or ["Keine Änderung"]:
            _say(args, "◆", change, "36")
    return 0


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not reference_enabled():
        return fail(
            "REFERENCE_DISABLED", "Referenzbefehle sind abgeschaltet", as_json="--json" in argv, status=2
        )
    _Parser.argv = argv
    parser = _Parser(prog="truthlens workspace")
    sub = parser.add_subparsers(dest="cmd", required=True)

    def add_common(target: argparse.ArgumentParser) -> None:
        target.add_argument("--json", action="store_true")
        target.add_argument("--quiet", action="store_true")
        target.add_argument("--no-color", action="store_true")
        target.add_argument("--config")
        target.add_argument("--root")

    init = sub.add_parser("init")
    add_common(init)
    init.add_argument("--project")
    init.add_argument("--harness", action="append")
    init.add_argument("--target")
    init.add_argument("--dry-run", action="store_true")
    init.add_argument("--yes", action="store_true")
    unlink = sub.add_parser("unlink")
    add_common(unlink)
    unlink.add_argument("--harness")
    unlink.add_argument("--dry-run", action="store_true")
    unlink.add_argument("--yes", action="store_true")
    doctor = sub.add_parser("doctor")
    add_common(doctor)
    doctor.add_argument("--strict", action="store_true")
    test = sub.add_parser("test")
    add_common(test)
    test.add_argument("--project")
    repair = sub.add_parser("repair")
    add_common(repair)
    repair.add_argument("--check")
    repair.add_argument("--apply", action="store_true")
    repair.add_argument("--yes", action="store_true")
    repair.add_argument("--dry-run", action="store_true")
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        return exc.code if isinstance(exc.code, int) else 2
    handlers = {"init": _init, "unlink": _unlink, "doctor": _doctor, "test": _test, "repair": _repair}
    return handlers[args.cmd](args)
