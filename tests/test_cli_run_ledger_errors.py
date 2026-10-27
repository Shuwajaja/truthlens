"""Run readers fail closed on unreadable ledgers before producing any output."""

from pathlib import Path

import pytest

from tests.test_cli import tl
from tests.test_export_integrity import _closed_run
from truthlens.cli import main

DIAGNOSTIC = "FAIL cannot read ledger.jsonl; pass a run directory containing a readable ledger.jsonl file\n"
MODES = ["report", "report-json", "export", "export-file", "project"]


def _args(mode, root, output):
    command = mode.split("-", 1)[0]
    options = {"report-json": ["--json"], "export-file": ["-o", str(output)]}.get(mode, [])
    return [command, str(root), *options]


def _snapshot(root):
    return {path.relative_to(root): path.read_bytes() if path.is_file() else None for path in root.rglob("*")}


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("problem", ["directory", "missing"])
def test_run_ledger_path_errors_preserve_evidence_and_destinations(tmp_path, mode, problem):
    root, _, _ = _closed_run(tmp_path, signing_key=None)
    ledger = root / "ledger.jsonl"
    ledger.unlink()
    if problem == "directory":
        ledger.mkdir()
        (ledger / "sentinel.txt").write_bytes(b"synthetic directory content")
    output = tmp_path / "export.json"
    output.write_bytes(b"existing export must survive\n")
    (root / "projection.sqlite").write_bytes(b"existing projection must survive\n")
    before = _snapshot(tmp_path)

    result = tl(*_args(mode, root, output))

    assert result.returncode == 1
    assert result.stderr == ""
    assert result.stdout == (DIAGNOSTIC if problem == "directory" else "FAIL line 0: ledger file not found\n")
    assert _snapshot(tmp_path) == before


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("read_number", [1, 2], ids=["verification-read", "event-read"])
@pytest.mark.parametrize("error_type", [PermissionError, OSError])
def test_run_ledger_io_errors_omit_details_and_preserve_files(
    tmp_path, monkeypatch, capsys, mode, read_number, error_type
):
    root, _, _ = _closed_run(tmp_path, signing_key=None)
    ledger = root / "ledger.jsonl"
    output = tmp_path / "export.json"
    output.write_bytes(b"existing export must survive\n")
    before = _snapshot(tmp_path)
    read_bytes = Path.read_bytes
    reads = 0

    def unreadable(path):
        nonlocal reads
        if path == ledger:
            reads += 1
            if reads == read_number:
                raise error_type("synthetic-private-exception-detail")
        return read_bytes(path)

    # Inject I/O failure: chmod cannot reliably deny reads to a root test runner.
    with monkeypatch.context() as patch:
        patch.setattr(Path, "read_bytes", unreadable)
        assert main(_args(mode, root, output)) == 1

    captured = capsys.readouterr()
    assert reads == read_number
    assert captured.out == DIAGNOSTIC
    assert captured.err == ""
    assert _snapshot(tmp_path) == before
    assert not (root / "projection.sqlite").exists()
