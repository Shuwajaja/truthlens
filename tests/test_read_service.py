"""Snapshot fail-closed and read-only boundary acceptance."""

import json
from pathlib import Path

import pytest

from truthlens.read_service import read_bytes, read_native


def test_bounded_contained_reader(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    outside = tmp_path / "secret"
    outside.write_text("never export")
    (root / "link").symlink_to(outside)
    with pytest.raises((ValueError, OSError)):
        read_bytes(root / "link", root)
    (root / "large").write_bytes(b"1234")
    with pytest.raises(ValueError):
        read_bytes(root / "large", root, limit=3)


def test_native_demo_and_tamper(tmp_path):
    import shutil

    demos = list((Path(__file__).parents[1] / "demo" / "runs").glob("*/manifest.json"))
    assert demos
    run = tmp_path / "run"
    shutil.copytree(demos[0].parent, run)
    doc = read_native(run)
    assert doc["integrity"] == "hash-only", doc
    assert doc["events"]
    signed = read_native(run, b"sk-test-unrelated")
    assert signed["integrity"] == "failed"
    manifest = json.loads((run / "manifest.json").read_text())
    manifest["run_id"] = "forged"
    (run / "manifest.json").write_text(json.dumps(manifest))
    failed = read_native(run)
    assert failed["integrity"] == "failed" and "events" not in failed


def test_hmac_proves_integrity_independently_from_failed_criterion(tmp_path):
    from truthlens.ledger import Ledger
    from truthlens.manifest import build_manifest
    from truthlens.read_model import run_model

    # Synthetic actors and signing bytes exist only in this temporary fixture.
    ledger = Ledger(tmp_path / "ledger.jsonl", b"sk-test-snapshot-key", "test-key")
    wrapper = {"id": "test-wrapper", "kind": "wrapper"}
    ledger.append(
        "run_test",
        wrapper,
        "run.started",
        {"repo": "test", "ref": "main", "command": "synthetic", "agent": "test"},
    )
    ledger.append(
        "run_test",
        {"id": "synthetic-test-human", "kind": "human"},
        "criterion.recorded",
        {"criterion_id": "c1", "text": "synthetic check", "source": "user"},
    )
    evidence = ledger.append(
        "run_test",
        wrapper,
        "test.reported",
        {"suite": "synthetic", "passed": 0, "failed": 1, "criterion_ids": ["c1"]},
    )
    ledger.append(
        "run_test",
        wrapper,
        "run.finished",
        {"exit_code": 1, "status": "failed", "last_hash": evidence["hash"]},
    )
    (tmp_path / "manifest.json").write_text(json.dumps(build_manifest(ledger.read(), {"name": "test"})))
    snapshot = read_native(tmp_path, b"sk-test-snapshot-key")
    assert snapshot["integrity"] == "hmac", snapshot
    model = run_model({"id": "test-source"}, snapshot, "run_test", native=True)
    assert model["integrity"] == "hmac" and model["verification"] == "FAILED"
    assert model["acceptance"] == "UNKNOWN"
