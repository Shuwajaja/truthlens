"""The labelled reference catalog must agree with the projection rules."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from truthlens.run_view import assert_consistent

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "viewer" / "public" / "reference-demo.json"
SCHEMA = json.loads((ROOT / "schemas" / "run-view-v1.schema.json").read_text(encoding="utf-8"))
CATALOG_FIELDS = {"demo", "synthetic", "display", "problem"}
NOW = datetime(2026, 10, 26, 15, 53, tzinfo=UTC)


def test_reference_demo_matches_projection_rules():
    payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert payload["demo"] is True
    assert payload["source_label"] == "Beispieldaten (Demo)"
    assert "/srv/" not in payload["source_label"]
    assert payload["previous_window_runs"] == 108
    runs = payload["runs"]
    assert len(runs) == 128
    assert [item["run_id"] for item in runs[:8]] == [
        "run_8f3a21",
        "run_8f2c07",
        "run_8e9d55",
        "run_8e71b0",
        "run_8e40fa",
        "run_8dff12",
        "run_8de9a3",
        "run_8d8e44",
    ]
    allowed = set(SCHEMA["properties"])
    window = NOW - timedelta(days=7)
    refuted: dict[str, int] = {}
    complete = 0
    for item in runs:
        assert item["demo"] is True
        assert item["synthetic"] is False
        assert item["integrity"] == "hash-only"
        started = datetime.fromisoformat(item["started_at"])
        assert started >= window
        if item["audit_state"] == "complete":
            complete += 1
        refuted[item["agent_id"]] = refuted.get(item["agent_id"], 0) + item["counts"]["refuted"]
        view = {key: value for key, value in item.items() if key not in CATALOG_FIELDS}
        assert set(view) <= allowed
        assert_consistent(view)
    assert complete == 96
    leader = max(refuted, key=refuted.get)
    others = [value for agent, value in refuted.items() if agent != leader]
    assert leader == "agent-zero"
    assert refuted[leader] > max(others)
    first = next(item for item in runs if item["run_id"] == "run_8f3a21")
    assert first["review_summary"] == "refuted"
    assert first["counts"] == {"confirmed": 5, "refuted": 1, "unclear": 1}
    assert first["duration_ms"] == 389_000
    assert first["display"]["timeline"][1][1] == "agent_reported"
