"""Clock regressions for prefixed ULIDs and their real ledger consumers."""

import re
import sqlite3
from itertools import pairwise

import pytest

from truthlens import ids, projection
from truthlens.ledger import Ledger, verify


@pytest.fixture(autouse=True)
def isolated_generator(monkeypatch):
    # Restore process-global state afterward so simulated future ticks cannot
    # affect other tests. Deterministic entropy makes forward resets repeatable.
    monkeypatch.setattr(ids, "_last_timestamp_ms", 0)
    monkeypatch.setattr(ids, "_last_random", 0)
    monkeypatch.setattr(ids.os, "urandom", lambda size: bytes(size))


@pytest.mark.parametrize(
    "ticks",
    [
        [10_000, 10_000, 10_000],
        [10_000, 9_999, 9_998],
        [10_000, 9_999, 10_000, 10_001],
        [10_000, 10_001, 10_002],
    ],
    ids=["same-tick", "rollback", "recovery", "forward"],
)
def test_ids_stay_unique_and_increasing_through_clock_changes(monkeypatch, ticks):
    clock = iter(ticks)
    monkeypatch.setattr(ids.time, "time", lambda: next(clock))

    generated = [ids.new_id("evt") for _ in ticks]

    assert all(re.fullmatch(r"evt_[0-7][0-9A-HJKMNP-TV-Z]{25}", value) for value in generated)
    assert len(set(generated)) == len(ticks)
    assert all(before < after for before, after in pairwise(generated))


def test_rollback_events_verify_and_rebuild_projection(tmp_path, monkeypatch):
    clock = iter([10_000, 9_999, 9_998])
    monkeypatch.setattr(ids.time, "time", lambda: next(clock))
    ledger = Ledger(tmp_path / "ledger.jsonl")
    for step in range(3):
        ledger.append("run_clock", {"kind": "wrapper", "id": "clock-test"}, "x", {"step": step})

    assert verify(ledger.path).ok
    events = ledger.read()
    database = projection.build(events, tmp_path / "projection.sqlite")
    with sqlite3.connect(database) as connection:
        rows = connection.execute("SELECT seq, id FROM events ORDER BY seq").fetchall()
    assert rows == [(event["seq"], event["id"]) for event in events]
    assert len(rows) == 3
