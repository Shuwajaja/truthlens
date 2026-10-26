"""Export output mistakes get bounded diagnostics after evidence verification."""

import json
from pathlib import Path

import pytest

from tests.test_cli import tl
from tests.test_export_integrity import _closed_run
from truthlens.cli import main

DIAGNOSTIC = "FAIL cannot write export; pass a writable output file path with an existing parent directory\n"


def _snapshot(root):
    return {path.relative_to(root): path.read_bytes() for path in root.rglob("*") if path.is_file()}


@pytest.mark.parametrize("problem", ["directory", "missing-parent", "file-parent"])
def test_export_output_path_error_is_actionable_and_preserves_run(tmp_path, problem):
    root, _, _ = _closed_run(tmp_path, signing_key=None)
    before = _snapshot(root)
    parent = tmp_path / "destination"
    if problem == "directory":
        parent.mkdir()
        sentinel = parent / "existing.txt"
        sentinel.write_bytes(b"existing destination content")
        output = parent
    elif problem == "file-parent":
        parent.write_bytes(b"existing parent file")
        output = parent / "export.json"
    else:
        output = parent / "export.json"

    result = tl("export", str(root), "-o", str(output))

    assert result.returncode == 1
    assert result.stdout == DIAGNOSTIC
    assert result.stderr == ""
    assert _snapshot(root) == before
    if problem == "directory":
        assert list(parent.iterdir()) == [sentinel]
        assert sentinel.read_bytes() == b"existing destination content"
    elif problem == "file-parent":
        assert parent.read_bytes() == b"existing parent file"
    else:
        assert not parent.exists()


@pytest.mark.parametrize("error_type", [PermissionError, OSError])
def test_export_write_error_omits_exception_details(tmp_path, monkeypatch, capsys, error_type):
    root, _, _ = _closed_run(tmp_path, signing_key=None)
    before = _snapshot(root)
    output = tmp_path / "export.json"
    output.write_bytes(b"existing export")
    write_text = Path.write_text

    def denied(path, *args, **kwargs):
        if path == output:
            raise error_type("synthetic-private-exception-detail")
        return write_text(path, *args, **kwargs)

    # Inject write failure: chmod is not a reliable denial when running as root.
    monkeypatch.setattr(Path, "write_text", denied)
    assert main(["export", str(root), "-o", str(output)]) == 1

    captured = capsys.readouterr()
    assert captured.out == DIAGNOSTIC
    assert captured.err == ""
    assert output.read_bytes() == b"existing export"
    assert _snapshot(root) == before


def test_export_checks_evidence_before_opening_output(tmp_path):
    root, _, _ = _closed_run(tmp_path, signing_key=None)
    ledger = root / "ledger.jsonl"
    ledger.write_bytes(ledger.read_bytes().replace(b'"exit_code":0', b'"exit_code":1'))
    before = _snapshot(root)
    output = tmp_path / "export.json"
    output.write_bytes(b"existing export")

    result = tl("export", str(root), "-o", str(output))

    assert result.returncode == 1
    assert "hash mismatch" in result.stdout
    assert result.stderr == ""
    assert output.read_bytes() == b"existing export"
    assert _snapshot(root) == before


def test_export_file_and_stdout_keep_the_same_hash_only_document(tmp_path):
    root, _, _ = _closed_run(tmp_path, signing_key=None)
    before = _snapshot(root)
    output = tmp_path / "export.json"

    file_result = tl("export", str(root), "-o", str(output))
    stdout_result = tl("export", str(root))

    assert file_result.returncode == stdout_result.returncode == 0
    assert file_result.stdout == file_result.stderr == stdout_result.stderr == ""
    assert output.read_bytes() == stdout_result.stdout.encode("utf-8")
    document = json.loads(output.read_bytes())
    assert document["integrity"] == "hash-only"
    assert document["verified"] is False
    assert _snapshot(root) == before
