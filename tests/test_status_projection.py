"""Phase F: real synthetic audit bytes, no host service or human acceptance."""

import copy
import json
import socket
import subprocess

import pytest

from tests.audit_support import RUN_ID, TEST_KEY, digest_tree, make_run
from truthlens.audit import audit_run
from truthlens.cli import main


@pytest.fixture
def report(tmp_path):
    return audit_run(make_run(tmp_path / "run"), hmac_key=TEST_KEY)


def project(report, **kwargs):
    from truthlens.status_projection import project_status

    return project_status(report, **kwargs)


def test_sources_rules_and_evidence_correlate(report):
    assert project(report) == {"status": "passed", "reason_code": "checks_passed"}
    assert project(report, run_id="foreign", ledger_last_hash=report["ledger_last_hash"]) == {
        "status": "not_checkable", "reason_code": "identity_mismatch"
    }
    missing_rule = copy.deepcopy(report)
    missing_rule["checks"] = [c for c in report["checks"] if c["rule_id"] != "TL-AUD-002"]
    assert project(missing_rule)["status"] == "not_checkable"
    missing_evidence = copy.deepcopy(report)
    missing_evidence["criteria"][0]["evidence"] = ["evt_missing"]
    assert project(missing_evidence)["status"] == "not_checkable"


def test_interruption_and_unavailable_source_clear_a_previous_pass(report):
    assert project(report, available=False) == {
        "status": "not_checkable", "reason_code": "source_unavailable"
    }
    assert project(report, state="interrupted") == {
        "status": "not_checkable", "reason_code": "interrupted"
    }
    assert project(None)["status"] == "not_checkable"


@pytest.mark.parametrize("state", ["queued", "running", "error", "failed", "unknown"])
def test_noncompleted_lifecycle_is_never_passed(report, state):
    assert project(report, state=state)["status"] == "not_checkable"


@pytest.mark.parametrize("field,value", [
    ("conclusion", "not_checkable"), ("conclusion", "running"),
    ("authentication", "not_checkable"), ("integrity", "hash-only"),
])
def test_incomplete_results_never_pass(report, field, value):
    report[field] = value
    assert project(report)["status"] == "not_checkable"


def test_contradictory_checks_override_a_passed_headline(report):
    report["checks"][0]["outcome"] = "contradictory"
    assert project(report) == {"status": "failed", "reason_code": "checks_failed"}


def test_status_contains_only_a_closed_status_and_safe_reason(report):
    # Deliberately inert fake material must never be reflected in the DTO.
    report["extra"] = {"path": "/synthetic/private", "payload": "fixture evidence"}
    report["checks"][0]["message"] = "synthetic-private-marker"
    result = project(report)
    assert result == {"status": "passed", "reason_code": "checks_passed"}
    assert "synthetic" not in json.dumps(result)
    report["checks"][0]["outcome"] = "/synthetic/private"
    assert project(report) == {"status": "not_checkable", "reason_code": "invalid_report"}


def test_local_audit_status_cli_is_read_only_and_uses_shared_projection(tmp_path, capsys, monkeypatch):
    root = make_run(tmp_path / "run")
    monkeypatch.setenv("TL_SYNTHETIC_STATUS_KEY", TEST_KEY.decode())
    before = digest_tree(root)

    def forbidden(*args, **kwargs):
        pytest.fail("local CLI attempted network or subprocess")

    monkeypatch.setattr(socket, "socket", forbidden)
    monkeypatch.setattr(subprocess, "Popen", forbidden)
    assert main(["audit", "status", str(root), "--json", "--hmac-key-env", "TL_SYNTHETIC_STATUS_KEY"]) == 0
    assert json.loads(capsys.readouterr().out) == {"status": "passed", "reason_code": "checks_passed"}
    assert digest_tree(root) == before
    assert main(["audit", "status", str(root), "--json"]) == 2
    assert json.loads(capsys.readouterr().out)["status"] == "not_checkable"
    assert main(["audit", "status", str(root / "missing"), "--json"]) == 2
    output = capsys.readouterr()
    assert str(root) not in output.out + output.err
    assert json.loads(output.out)["status"] == "not_checkable"


def test_local_cli_interruption_has_fixed_status_output(tmp_path, monkeypatch, capsys):
    from truthlens import audit

    def interrupted(*args, **kwargs):
        raise KeyboardInterrupt

    monkeypatch.setattr(audit, "audit_run", interrupted)
    assert main(["audit", "status", str(tmp_path), "--json"]) == 2
    assert json.loads(capsys.readouterr().out) == {"status": "not_checkable", "reason_code": "interrupted"}


def test_registered_human_response_uses_same_projection(published):
    from tests.test_phase_b_reader import reader

    # Phase B fixture deliberately lacks a complete report: never synthesize green.
    result = reader(published).audits(RUN_ID)
    assert result["status"] == project(result["audit"])
    assert result["status"]["status"] == "not_checkable"


pytest_plugins = ("tests.test_phase_b_reader",)
