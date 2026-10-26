"""Unreadable verify inputs fail closed with actionable, bounded diagnostics."""

from pathlib import Path

from tests.test_cli import tl
from truthlens.cli import main

DIAGNOSTIC = "FAIL cannot read ledger; pass a readable ledger.jsonl file (not a run directory)\n"


def test_verify_run_directory_explains_file_argument_without_writes(tmp_path):
    run = tmp_path / "run"
    run.mkdir()
    ledger = run / "ledger.jsonl"
    original = b"synthetic ledger must remain unchanged\n"
    ledger.write_bytes(original)

    result = tl("verify", str(run))

    assert result.returncode == 1
    assert result.stdout == DIAGNOSTIC
    assert result.stderr == ""
    assert list(run.iterdir()) == [ledger]
    assert ledger.read_bytes() == original


def test_verify_permission_denied_omits_exception_details(tmp_path, monkeypatch, capsys):
    ledger = tmp_path / "ledger.jsonl"
    original = b"synthetic ledger must remain unchanged\n"
    ledger.write_bytes(original)
    read_bytes = Path.read_bytes

    def denied(path):
        if path == ledger:
            raise PermissionError("synthetic-private-exception-detail")
        return read_bytes(path)

    # Inject denial because chmod does not deny reads when tests run as root.
    with monkeypatch.context() as patch:
        patch.setattr(Path, "read_bytes", denied)
        assert main(["verify", str(ledger)]) == 1

    captured = capsys.readouterr()
    assert captured.out == DIAGNOSTIC
    assert captured.err == ""
    assert list(tmp_path.iterdir()) == [ledger]
    assert ledger.read_bytes() == original
