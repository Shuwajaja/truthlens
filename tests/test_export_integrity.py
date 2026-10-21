import copy
import json
import shutil
from pathlib import Path

import pytest

from truthlens.cli import main
from truthlens.export import build
from truthlens.ledger import Ledger
from truthlens.manifest import build_manifest
from truthlens.mcp import Server

TEST_KEY = b"sk-test-export-hmac"
WRONG_KEY = b"sk-test-wrong-hmac"


def _closed_run(tmp_path, signing_key=TEST_KEY):
    root = tmp_path / "run"
    root.mkdir()
    ledger = Ledger(root / "ledger.jsonl", signing_key, "test-key" if signing_key is not None else None)
    actor = {"kind": "wrapper", "id": "test"}
    first = ledger.append("run_test", actor, "run.started",
                          {"repo": "test", "ref": "", "command": "true", "agent": "test"})
    ledger.append("run_test", actor, "run.finished", {"exit_code": 0, "status": "ok", "last_hash": first["hash"]})
    events = ledger.read()
    manifest = build_manifest(events, {"name": "test"})
    (root / "manifest.json").write_text(json.dumps(manifest))
    return root, events, manifest


@pytest.mark.parametrize("key", [None, TEST_KEY])
def test_cli_export_and_mcp_agree_on_integrity(tmp_path, monkeypatch, capsys, key):
    root, _, _ = _closed_run(tmp_path)
    args = ["export", str(root)]
    if key is not None:
        monkeypatch.setenv("TRUTHLENS_TEST_EXPORT_KEY", key.decode())
        args += ["--hmac-key-env", "TRUTHLENS_TEST_EXPORT_KEY"]
    assert main(args) == 0
    doc = json.loads(capsys.readouterr().out)
    report = Server(str(tmp_path), key).call("run_report", {"run": "run"})
    expected = {"verified": key is not None, "integrity": "hmac" if key is not None else "hash-only"}
    assert {field: doc[field] for field in expected} == expected
    assert {field: report[field] for field in expected} == expected
    assert ("integrity_verified" in doc["trust"]) is (key is not None)


@pytest.mark.parametrize("key, integrity", [(None, "hash-only"), (TEST_KEY, "hmac"), (WRONG_KEY, "failed")])
def test_builder_checks_hmac_instead_of_trusting_key_presence(tmp_path, key, integrity):
    _, events, manifest = _closed_run(tmp_path)
    doc = build(events, manifest, hmac_key=key)
    assert doc["integrity"] == integrity
    assert doc["verified"] is (integrity == "hmac")
    assert ("integrity_verified" in doc.get("trust", [])) is (integrity == "hmac")
    if integrity == "failed":
        assert doc["errors"]


def test_unsigned_run_cannot_become_verified_by_supplying_a_key(tmp_path):
    _, events, manifest = _closed_run(tmp_path, signing_key=None)
    doc = build(events, manifest, hmac_key=TEST_KEY)
    assert doc["verified"] is False and doc["integrity"] == "failed"


@pytest.mark.parametrize("tamper", ["events", "manifest"])
def test_builder_fails_closed_on_tampered_input(tmp_path, tamper):
    _, events, manifest = _closed_run(tmp_path)
    if tamper == "events":
        events = copy.deepcopy(events)
        events[0]["payload"]["command"] = "changed"
    else:
        manifest["ledger_last_hash"] = "0" * 64
    doc = build(events, manifest, hmac_key=TEST_KEY)
    assert doc["verified"] is False and doc["integrity"] == "failed"
    assert doc["errors"] and "integrity_verified" not in doc.get("trust", [])


def test_cli_wrong_key_preserves_existing_output(tmp_path, monkeypatch, capsys):
    root, _, _ = _closed_run(tmp_path)
    output = tmp_path / "export.json"
    output.write_text("existing output")
    monkeypatch.setenv("TRUTHLENS_TEST_EXPORT_KEY", WRONG_KEY.decode())
    assert main(["export", str(root), "--hmac-key-env", "TRUTHLENS_TEST_EXPORT_KEY", "-o", str(output)]) == 1
    assert output.read_text() == "existing output"
    assert "FAIL" in capsys.readouterr().out


def test_keyless_demo_export_matches_mcp(tmp_path, capsys):
    root = tmp_path / "demo"
    shutil.copytree(Path(__file__).parents[1] / "demo" / "runs" / "demo-2", root)
    assert main(["export", str(root)]) == 0
    doc = json.loads(capsys.readouterr().out)
    report = Server(str(tmp_path)).call("run_report", {"run": "demo"})
    assert doc["verified"] is report["verified"] is False
    assert doc["integrity"] == report["integrity"] == "hash-only"
    assert "integrity_verified" not in doc["trust"]
