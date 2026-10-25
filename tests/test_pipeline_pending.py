"""Synthetic operator inspection; identity/trust overrides do not qualify a host."""

import argparse
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import pytest

from truthlens import pipeline, pipeline_explain, pipeline_jobs, registry
from truthlens.cli import main

NOW = datetime(2026, 10, 25, 12, tzinfo=UTC)


def forbidden(*args, **kwargs):
    pytest.fail("inspection attempted a forbidden operation")


@pytest.fixture
def journal(tmp_path, monkeypatch):
    monkeypatch.setattr(os, "getuid", lambda: 0)
    monkeypatch.setattr(os, "geteuid", lambda: 0)
    monkeypatch.setattr(registry, "trusted", lambda *a, **kw: None)
    store = registry.Registry(tmp_path)
    monkeypatch.setattr(registry, "Registry", lambda: store)
    monkeypatch.setattr(registry, "stamp", lambda: "2026-10-25T11:00:00+00:00")
    monkeypatch.setattr(
        pipeline_explain,
        "datetime",
        SimpleNamespace(now=lambda tz: NOW, fromisoformat=datetime.fromisoformat),
        raising=False,
    )
    monkeypatch.setattr(registry, "caller_uid", forbidden)
    for name in ("read_audit_key", "load_profile", "run_profile", "finalize", "recover_captures"):
        monkeypatch.setattr(pipeline, name, forbidden)
    monkeypatch.setattr(pipeline_jobs, "drain", forbidden)
    return store


def inspect(capsys):
    assert main(["pipeline", "explain", "pending"]) == 0
    out, err = capsys.readouterr()
    assert err == ""
    assert len(out.encode()) <= 32768
    return json.loads(out)


def dispatch(store, name="agent-zero"):
    return store.dispatch(name, 1234, "Shu", [1234], "a" * 64)


@pytest.mark.parametrize("uid,euid", [(1234, 1234), (0, 1234), (1234, 0)])
def test_pending_requires_both_root_ids_before_parsing_or_reads(monkeypatch, capsys, uid, euid):
    monkeypatch.setattr(os, "getuid", lambda: uid)
    monkeypatch.setattr(os, "geteuid", lambda: euid)
    monkeypatch.setattr(argparse.ArgumentParser, "parse_args", forbidden)
    monkeypatch.setattr(registry, "Registry", forbidden)
    monkeypatch.setattr(os, "open", forbidden)
    assert main(["pipeline", "explain", "pending", "PRIVATE"]) == 2
    assert capsys.readouterr() == ("", "ROOT_REQUIRED\n")


@pytest.mark.parametrize("existing", [False, True])
def test_empty_registry_does_not_create_files(journal, capsys, existing):
    path = journal.root / "registry.jsonl"
    if existing:
        path.write_bytes(b"")
    before = {p.name: p.read_bytes() for p in journal.root.iterdir()}
    assert inspect(capsys) == {"pending": [], "truncated": False}
    assert {p.name: p.read_bytes() for p in journal.root.iterdir()} == before


@pytest.mark.parametrize("count", [1, 3])
def test_uncaptured_dispatches_are_safe_and_journal_is_unchanged(journal, monkeypatch, capsys, count):
    pending = [dispatch(journal) for _ in range(count)]
    # Arbitrary fields in a protected record must never become operator output.
    journal.append("dispatch", {**pending[0], "text": "PRIVATE /evidence sk-test-synthetic"})
    before = (journal.root / "registry.jsonl").read_bytes()
    real_open = os.open
    opens = []

    def readonly(path, flags, *args):
        opens.append((Path(path).name, flags))
        assert flags & os.O_ACCMODE == os.O_RDONLY
        assert not flags & (os.O_CREAT | os.O_TRUNC | os.O_APPEND)
        return real_open(path, flags, *args)

    monkeypatch.setattr(os, "open", readonly)
    monkeypatch.setattr(journal, "append", forbidden)
    monkeypatch.setattr(journal, "_write", forbidden)
    monkeypatch.setattr(journal, "run", forbidden)
    assert inspect(capsys) == {
        "pending": [
            {
                "dispatch_id": d["dispatch_id"],
                "profile": "agent-zero",
                "age_seconds": 3600,
                "state": "awaiting_capture",
                "retry": "each_worker_round",
            }
            for d in pending
        ],
        "truncated": False,
    }
    assert opens and all(name == "registry.jsonl" for name, _ in opens)
    assert (journal.root / "registry.jsonl").read_bytes() == before
    assert {p.name for p in journal.root.iterdir()} == {"registry.jsonl"}


def test_captured_and_completed_runs_are_not_pending(journal, capsys):
    for completed in (False, True):
        d = dispatch(journal)
        journal.append("captured", {"dispatch_id": d["dispatch_id"], "run_id": "synthetic-run"})
        if completed:
            journal.append("completed", {"run_id": "synthetic-run", "audit_id": "synthetic-audit"})
    assert inspect(capsys) == {"pending": [], "truncated": False}


@pytest.mark.parametrize("count", [100, 101, 150])
def test_output_has_a_fixed_row_and_byte_bound(journal, capsys, count):
    for _ in range(count):
        dispatch(journal, "a" * 80)
    result = inspect(capsys)
    assert len(result["pending"]) == min(count, 100)
    assert result["truncated"] is (count > 100)


@pytest.mark.parametrize(
    "field,value",
    [
        ("dispatch_id", "PRIVATE\n/evidence"),
        ("dispatch_id", []),
        ("dispatch_id", "a" * 81),
        ("profile", "PRIVATE\x1b[31m"),
        ("profile", {}),
        ("profile", "a" * 81),
    ],
)
def test_invalid_display_fields_fail_closed_without_partial_output(journal, capsys, field, value):
    dispatch(journal)
    journal.append("dispatch", {**dispatch(journal), field: value})
    before = (journal.root / "registry.jsonl").read_bytes()
    assert main(["pipeline", "explain", "pending"]) == 2
    assert capsys.readouterr() == ("", "REGISTRY_UNAVAILABLE\n")
    assert (journal.root / "registry.jsonl").read_bytes() == before


@pytest.mark.parametrize(
    "stamp,age",
    [
        ("2026-10-25T13:00:00+00:00", 0),
        ("0001-01-01T00:00:00+00:00", 2147483647),
    ],
)
def test_age_is_bounded(journal, monkeypatch, capsys, stamp, age):
    monkeypatch.setattr(registry, "stamp", lambda: stamp)
    dispatch(journal)
    assert inspect(capsys)["pending"][0]["age_seconds"] == age


@pytest.mark.parametrize("stamp", ["PRIVATE", "2026-10-25T11:00:00", None, "a" * 1000])
def test_invalid_timestamp_is_a_fixed_error(journal, monkeypatch, capsys, stamp):
    monkeypatch.setattr(registry, "stamp", lambda: stamp)
    dispatch(journal)
    assert main(["pipeline", "explain", "pending"]) == 2
    assert capsys.readouterr() == ("", "REGISTRY_UNAVAILABLE\n")


def test_corrupt_journal_is_not_repaired(journal, capsys):
    path = journal.root / "registry.jsonl"
    path.write_bytes(b"PRIVATE incomplete journal")
    assert main(["pipeline", "explain", "pending"]) == 2
    assert capsys.readouterr() == ("", "REGISTRY_UNAVAILABLE\n")
    assert path.read_bytes() == b"PRIVATE incomplete journal"
