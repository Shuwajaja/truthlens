"""Human-local CLI reads of real UTF-8 manifests in a non-UTF-8 locale."""

import json
import os
import sqlite3
import subprocess
import sys
from contextlib import closing
from pathlib import Path

import pytest

from truthlens.canonical import canonical_bytes
from truthlens.ledger import Ledger
from truthlens.manifest import build_manifest

TEXT = "Grüße aus 東京"


@pytest.mark.parametrize("command", ["report", "export", "project"])
@pytest.mark.parametrize("tampered", [False, True], ids=["valid", "inconsistent"])
def test_cli_utf8_manifest_in_ascii_locale(tmp_path, command, tampered):
    root = tmp_path / "run"
    root.mkdir()
    ledger_path = root / "ledger.jsonl"
    ledger = Ledger(ledger_path)
    wrapper = {"kind": "wrapper", "id": "synthetic-test-wrapper"}
    ledger.append("run_utf8", wrapper, "run.started", {"agent": "test"})
    criterion = ledger.append(
        "run_utf8",
        {"kind": "agent", "id": "synthetic-test-agent"},
        "criterion.recorded",
        {"criterion_id": "c1", "text": TEXT, "source": "agent"},
    )
    ledger.append("run_utf8", wrapper, "run.finished", {"last_hash": criterion["hash"], "exit_code": 0})
    manifest = build_manifest(ledger.read(), {"name": "test"})
    if tampered:
        manifest["acceptance"][0]["text"] = TEXT + " changed"
    manifest_path = root / "manifest.json"
    manifest_path.write_bytes(canonical_bytes(manifest))
    original = (ledger_path.read_bytes(), manifest_path.read_bytes())

    env = {
        **os.environ,
        "PYTHONPATH": str(Path(__file__).resolve().parents[1] / "src"),
        "LC_ALL": "C",
        "PYTHONCOERCECLOCALE": "0",
        "PYTHONUTF8": "0",
    }
    probe = subprocess.run(
        [sys.executable, "-c", "import locale; print(locale.getpreferredencoding(False))"],
        env=env,
        capture_output=True,
        check=True,
    )
    assert probe.stdout.strip().lower() in (b"ascii", b"ansi_x3.4-1968"), "requires an ASCII locale"
    output = tmp_path / "export.json"
    args = {"report": ["--json"], "export": ["-o", str(output)], "project": []}[command]
    result = subprocess.run(
        [sys.executable, "-m", "truthlens", command, str(root), *args],
        env=env,
        capture_output=True,
        check=False,
    )

    assert result.returncode == (1 if tampered else 0), result.stderr.decode("utf-8", errors="replace")
    assert result.stderr == b""
    assert (ledger_path.read_bytes(), manifest_path.read_bytes()) == original
    if tampered:
        assert b"FAIL acceptance differs from ledger" in result.stdout
        assert not output.exists()
        assert not (root / "projection.sqlite").exists()
    elif command == "project":
        with closing(sqlite3.connect(root / "projection.sqlite")) as connection:
            assert connection.execute("SELECT text, status FROM criteria").fetchall() == [(TEXT, "proposed")]
    else:
        doc = json.loads(output.read_bytes() if command == "export" else result.stdout)
        assert doc["criteria"][0]["text"] == TEXT
        assert doc["criteria"][0]["status"] == "proposed"
        if command == "export":
            assert doc["integrity"] == "hash-only"
            assert doc["verified"] is False
