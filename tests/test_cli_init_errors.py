"""Initialization filesystem failures get bounded diagnostics without a run ID."""

import builtins
import os
from pathlib import Path

import pytest

from tests.test_cli import tl
from truthlens.cli import main
from truthlens.ledger import Ledger, verify

DIAGNOSTIC = (
    "FAIL cannot initialize ledger; pass a writable ledger file path with an existing parent directory\n"
)


@pytest.mark.parametrize("problem", ["missing-parent", "file-parent"])
def test_init_invalid_parent_is_actionable_without_creating_directories(tmp_path, problem):
    parent = tmp_path / "parent"
    original = b"synthetic parent file\n"
    if problem == "file-parent":
        parent.write_bytes(original)
    ledger = parent / "ledger.jsonl"

    result = tl("init", str(ledger), "--repo", ".")

    assert result.returncode == 1
    assert result.stdout == DIAGNOSTIC
    assert result.stderr == ""
    if problem == "file-parent":
        assert list(tmp_path.iterdir()) == [parent]
        assert parent.read_bytes() == original
    else:
        assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize("stage", ["stat", "lock", "fsync"])
def test_init_io_failure_omits_exception_details_and_success_id(tmp_path, monkeypatch, capsys, stage):
    ledger = tmp_path / "ledger.jsonl"
    ledger.write_bytes(b"")
    open_file = builtins.open

    def denied(*args, **kwargs):
        raise PermissionError("synthetic-private-exception-detail")

    def open_with_lock_denied(path, *args, **kwargs):
        if Path(path) == Path(f"{ledger}.lock"):
            return denied()
        return open_file(path, *args, **kwargs)

    def failed_fsync(_fd):
        raise OSError("synthetic-private-exception-detail")

    # Inject failures so root execution does not turn a chmod denial into success.
    with monkeypatch.context() as patch:
        if stage == "stat":
            patch.setattr(os.path, "getsize", denied)
        elif stage == "lock":
            patch.setattr(builtins, "open", open_with_lock_denied)
        else:
            patch.setattr(os, "fsync", failed_fsync)
        assert main(["init", str(ledger), "--repo", "."]) == 1

    captured = capsys.readouterr()
    assert captured.out == DIAGNOSTIC
    assert captured.err == ""
    if stage == "fsync":
        # Bytes can be written before fsync fails; the CLI must not claim success.
        assert verify(ledger).ok
        assert len(Ledger(ledger).read()) == 1
    else:
        assert ledger.read_bytes() == b""
        assert list(tmp_path.iterdir()) == [ledger]


@pytest.mark.parametrize("existing_empty_file", [False, True])
def test_init_success_still_prints_run_id_and_records_one_system_event(tmp_path, existing_empty_file):
    ledger = tmp_path / "ledger.jsonl"
    if existing_empty_file:
        ledger.write_bytes(b"")

    result = tl("init", str(ledger), "--repo", ".")

    assert result.returncode == 0
    assert result.stderr == ""
    assert result.stdout.startswith("run_")
    assert len(result.stdout.splitlines()) == 1
    assert verify(ledger).ok
    (event,) = Ledger(ledger).read()
    assert event["run_id"] == result.stdout.strip()
    assert event["type"] == "run.started"
    assert event["actor"] == {"kind": "system", "id": "truthlens-cli"}
    assert event["payload"] == {"repo": ".", "ref": "", "command": "", "agent": ""}


def test_init_refuses_nonempty_ledger_without_mutation_or_lock(tmp_path):
    ledger = tmp_path / "ledger.jsonl"
    original = b"existing ledger must survive\n"
    ledger.write_bytes(original)

    result = tl("init", str(ledger), "--repo", ".")

    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr == "error: ledger exists\n"
    assert ledger.read_bytes() == original
    assert list(tmp_path.iterdir()) == [ledger]
