"""Build the labelled reference demo catalog. Numbers are computed from claims."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

NOW = datetime(2026, 10, 26, 15, 53, tzinfo=UTC)


def stamp(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.") + "000Z"


def claim(index: str, text: str, verdict: str, source: str, reason: str) -> dict:
    return {
        "id": index, "text": text, "verdict": verdict, "evidence_refs": [f"ev_{index}"],
        "source_kind": source, "scope": "demo-claim", "reason_code": reason,
    }


def summarize(claims: list[dict], execution: str, audit_state: str, integrity: str) -> str:
    if any(item["verdict"] == "refuted" for item in claims):
        return "refuted"
    if (
        integrity == "unknown"
        or execution != "completed"
        or audit_state != "complete"
        or not claims
        or any(item["verdict"] != "confirmed" for item in claims)
    ):
        return "unclear"
    return "confirmed"


def pack(run_id: str, project: str, agent: str, task: str, started: datetime, claims: list[dict],
         *, audit: str, finished: datetime | None = None, display: dict | None = None) -> dict:
    execution = "completed"
    integrity = "hash-only"
    counts = {"confirmed": 0, "refuted": 0, "unclear": 0}
    for item in claims:
        counts[item["verdict"]] += 1
    duration = int((finished - started).total_seconds() * 1000) if finished else 60_000
    end = finished or (started + timedelta(milliseconds=duration))
    view = {
        "schema_version": "run-view-v1",
        "run_id": run_id,
        "project_id": project,
        "task": task,
        "execution": execution,
        "audit_state": audit,
        "integrity": integrity,
        "review_summary": summarize(claims, execution, audit, integrity),
        "claims": claims,
        "timeline": [{
            "id": f"tl_{run_id}",
            "timestamp": stamp(started),
            "kind": "run.started",
            "title": "Aufgabe gestartet",
            "detail": task,
            "observation": "captured",
        }],
        "counts": counts,
        "agent_id": agent,
        "started_at": stamp(started),
        "finished_at": stamp(end),
        "duration_ms": duration,
        "git_commit": None,
        "audit_revision": "1" if audit == "complete" else None,
        "demo": True,
        "synthetic": False,
    }
    if display:
        view["display"] = display
    return view


def many(verdict: str, count: int, prefix: str) -> list[dict]:
    reason = {"confirmed": "witnessed_pass", "refuted": "witnessed_fail", "unclear": "unwitnessed"}[verdict]
    source = {"confirmed": "witnessed_test", "refuted": "file_diff", "unclear": "none"}[verdict]
    return [claim(f"{prefix}_{index}", f"Beispielaussage {prefix} {index}", verdict, source, reason) for index in range(count)]


def visible() -> list[dict]:
    detail_claims = [
        claim("c1", "Alle 42 Tests laufen grün durch", "confirmed", "witnessed_test", "witnessed_pass"),
        claim("c2", "README enthält neuen Abschnitt „Installation“", "confirmed", "file_diff", "witnessed_pass"),
        claim("c3", "Keine Abhängigkeiten geändert", "refuted", "file_diff", "witnessed_fail"),
        claim("c4", "Linter meldet keine Fehler", "confirmed", "command", "witnessed_pass"),
        claim("c5", "Performance um 30 % verbessert", "unclear", "none", "benchmark_missing"),
        claim("c6", "CHANGELOG für v0.4.0 ergänzt", "confirmed", "file_diff", "witnessed_pass"),
        claim("c7", "Commit auf Branch feat/readme", "confirmed", "git", "witnessed_pass"),
    ]
    started = datetime(2026, 10, 26, 15, 41, 2, tzinfo=UTC)
    finished = datetime(2026, 10, 26, 15, 47, 31, tzinfo=UTC)
    first = pack(
        "run_8f3a21", "mcpdeck", "agent-zero", "README & Tests aktualisieren", started, detail_claims,
        audit="complete", finished=finished, display={
            "evidence": [
                "pytest-Ausgabe: 42 passed", "Diff Zeile 12-38", "package.json: +zod 3.23",
                "eslint: 0 Probleme", "Kein Benchmark im Lauf gefunden", "CHANGELOG.md +9 Zeilen",
                "git log a1c9e2f",
            ],
            "sources": ["Testlauf", "Datei-Diff", "Datei-Diff", "Befehl", "—", "Datei-Diff", "Git"],
            "timeline": [
                ["2026-10-26T15:41:02.000Z", "captured", "Aufgabe gestartet", "Agent Zero erhält „README & Tests aktualisieren“"],
                ["2026-10-26T15:41:30.000Z", "agent_reported", "Dateien gelesen", "14 Dateien im Workspace"],
                ["2026-10-26T15:44:12.000Z", "captured", "Befehl ausgeführt", "npm test → 42 passed"],
                ["2026-10-26T15:46:55.000Z", "captured", "Dateien geändert", "README.md, package.json, CHANGELOG.md"],
                ["2026-10-26T15:47:20.000Z", "agent_reported", "Abschluss-Bericht", "7 Behauptungen erkannt"],
                ["2026-10-26T15:47:31.000Z", "captured", "Prüfung fertig", "5 bestätigt · 1 widerlegt · 1 unklar"],
            ],
        },
    )
    rows = [
        ("run_8f2c07", "vpsman", "codex", "Honcho-Plugin reparieren", NOW - timedelta(minutes=48), (6, 0, 2)),
        ("run_8e9d55", "truthlens", "claude", "CLI-Befehl init bauen", NOW - timedelta(hours=2), (12, 2, 0)),
        ("run_8e71b0", "mausbot", "agent-zero", "Docker-Compose prüfen", NOW - timedelta(hours=3), (4, 3, 1)),
        ("run_8e40fa", "mcpdeck", "codex", "Server-Liste rendern", NOW - timedelta(hours=5), (7, 0, 0)),
        ("run_8dff12", "vpsman", "agent-zero", "Backup-Skript testen", NOW - timedelta(days=1), (3, 1, 4)),
        ("run_8de9a3", "truthlens", "codex", "MCP-Werkzeuge dokumentieren", NOW - timedelta(days=1, hours=3), (8, 0, 1)),
        ("run_8d8e44", "mausbot", "claude", "Speicher-Export", NOW - timedelta(days=2), (5, 2, 0)),
    ]
    built = [first]
    for run_id, project, agent, task, moment, (ok, bad, unsure) in rows:
        claims = many("confirmed", ok, run_id + "y") + many("refuted", bad, run_id + "n") + many("unclear", unsure, run_id + "q")
        built.append(pack(run_id, project, agent, task, moment, claims, audit="complete"))
    return built


def hidden(start_index: int) -> list[dict]:
    projects = ["mcpdeck", "vpsman", "mausbot", "truthlens"]
    agents = ["agent-zero", "codex", "claude"]
    rows = []
    for index in range(120):
        moment = NOW - timedelta(days=3, minutes=40 * index)
        audit = "pending" if index >= 88 else "complete"
        agent = "agent-zero" if index < 20 else agents[index % 3]
        if audit == "pending":
            claims = many("unclear", 1, f"h{index}")
        elif index < 20:
            claims = many("refuted", 1, f"h{index}")
        else:
            claims = many("confirmed", 1, f"h{index}")
        rows.append(pack(
            f"run_h{index:03d}", projects[index % 4], agent, f"Beispielaufgabe {index + start_index}",
            moment, claims, audit=audit,
        ))
    return rows


def main() -> None:
    runs = visible() + hidden(9)
    runs.sort(key=lambda item: item["started_at"], reverse=True)
    payload = {
        "demo": True,
        "now": stamp(NOW),
        "previous_window_runs": 108,
        "source_label": "Beispieldaten (Demo)",
        "projects": [
            {"id": "mcpdeck", "name": "MCPDeck"},
            {"id": "vpsman", "name": "VPSMan"},
            {"id": "mausbot", "name": "Mausbot"},
            {"id": "truthlens", "name": "TruthLens"},
        ],
        "agents": [
            {"id": "agent-zero", "name": "Agent Zero", "initial": "A"},
            {"id": "codex", "name": "Codex", "initial": "C"},
            {"id": "claude", "name": "Claude", "initial": "C"},
        ],
        "runs": runs,
    }
    target = Path(__file__).resolve().parents[1] / "public" / "reference-demo.json"
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(target, len(runs))


if __name__ == "__main__":
    main()
