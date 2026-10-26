"""Standalone MCP vNext gates that this checkout can actually run.

Projection and snippet checks are local. They do not qualify a separate-UID
broker, a real agent handshake, or a production ``passed`` result.
"""

import copy
import json

from tests.audit_support import TEST_KEY, make_run
from truthlens.agent_setup import CLIENTS, render_config, valid_config
from truthlens.audit import audit_run
from truthlens.cli import main
from truthlens.display_labels import audit_label, criterion_label
from truthlens.status_projection import project_status
from truthlens.status_wire import status_only


def test_display_words_follow_authentication_and_leave_stored_words_alone():
    assert criterion_label("met", authenticated=False) == "UNKNOWN"
    assert criterion_label("unmet", authenticated=False) == "UNKNOWN"
    assert criterion_label("met", authenticated=True) == "TRUE"
    assert criterion_label("unmet", authenticated=True) == "FALSE"
    assert criterion_label("unverified", authenticated=True) == "UNKNOWN"
    assert criterion_label("proposed", authenticated=True) == "UNKNOWN"
    assert audit_label("passed") == "TRUE"
    assert audit_label("failed") == "FALSE"
    assert audit_label("not_checkable") == "UNKNOWN"
    assert audit_label("met") == "UNKNOWN"


def test_fake_pass_file_empty_checker_and_skipped_rules_never_pass(tmp_path):
    report = audit_run(make_run(tmp_path / "run"), hmac_key=TEST_KEY)
    assert project_status(report)["status"] == "passed"

    fake = {"status": "passed"}
    projected = project_status(fake)
    assert projected == {"status": "not_checkable", "reason_code": "invalid_report"}
    assert status_only({"status": projected["status"]}) == {"status": "not_checkable"}
    assert status_only({"status": "passed", "evidence": "secret", "path": "/tmp/x"}) == {
        "status": "not_checkable"
    }

    always_green = {
        "audit_version": 1,
        "state": "completed",
        "conclusion": "supported_within_scope",
        "authentication": "supported",
        "integrity": "hmac",
        "run_id": report["run_id"],
        "ledger_last_hash": report["ledger_last_hash"],
        "checks": [
            {
                "rule_id": "ALWAYS-GREEN",
                "required": True,
                "outcome": "supported",
                "event_ids": [],
                "criterion_ids": [],
            }
        ],
        "criteria": [{"criterion_id": "c1", "status": "met", "evidence": []}],
    }
    assert project_status(always_green)["status"] == "not_checkable"

    skipped = copy.deepcopy(report)
    required = next(check for check in skipped["checks"] if check["required"])
    required["outcome"] = "not_checkable"
    assert project_status(skipped) == {"status": "not_checkable", "reason_code": "incomplete_checks"}

    empty = copy.deepcopy(report)
    empty["criteria"] = []
    assert project_status(empty)["status"] == "not_checkable"
    zero = copy.deepcopy(report)
    zero["criteria"][0]["evidence"] = []
    assert project_status(zero)["status"] == "not_checkable"


def test_foreign_digest_and_unchecked_integrity_never_pass(tmp_path):
    report = audit_run(make_run(tmp_path / "run"), hmac_key=TEST_KEY)
    foreign = dict(report["input_digests"]["run"])
    foreign["ledger.jsonl"] = "f" * 64
    assert project_status(report, input_digests=foreign) == {
        "status": "not_checkable",
        "reason_code": "identity_mismatch",
    }
    damaged = copy.deepcopy(report)
    damaged["integrity"] = "hash-only"
    damaged["authentication"] = "not_checkable"
    assert project_status(damaged) == {
        "status": "not_checkable",
        "reason_code": "authentication_unchecked",
    }
    contradicted = copy.deepcopy(report)
    contradicted["checks"][0]["outcome"] = "contradictory"
    assert project_status(contradicted) == {"status": "failed", "reason_code": "checks_failed"}
    unsigned = copy.deepcopy(contradicted)
    unsigned["authentication"] = "not_checkable"
    unsigned["integrity"] = "hash-only"
    assert project_status(unsigned) == {
        "status": "not_checkable",
        "reason_code": "authentication_unchecked",
    }


def test_agent_profiles_reject_the_legacy_evidence_mcp():
    socket_path = "/run/truthlens/status.sock"
    for client in CLIENTS:
        rendered = render_config(client, socket_path)
        assert "mcp-status" in rendered
        assert "--root" not in rendered
        assert '"mcp"' not in rendered
        if client == "codex":
            legacy = (
                '[mcp_servers.truthlens]\ncommand = "truthlens"\nargs = ["mcp", "--root", "/tmp/evidence"]\n'
            )
        else:
            legacy = json.dumps(
                {
                    "mcpServers": {
                        "truthlens": {
                            "command": "truthlens",
                            "args": ["mcp", "--root", "/tmp/evidence"],
                        }
                    }
                }
            )
        assert valid_config(legacy, client, socket_path) is False
        assert valid_config(rendered, client, socket_path) is True


def test_human_report_keeps_stored_status_and_marks_hash_only_unknown(capsys):
    assert main(["report", "demo/runs/demo-2"]) == 0
    text = capsys.readouterr().out
    assert " UNKNOWN " in text
    assert " TRUE " not in text
    assert " FALSE " not in text
    assert "Integrity is not approval." in text
    assert "Hash only" in text
    assert main(["report", "demo/runs/demo-2", "--json"]) == 0
    document = json.loads(capsys.readouterr().out)
    assert document["criteria"]
    assert all(row["status"] in {"met", "unmet", "unverified", "proposed"} for row in document["criteria"])
    assert "TRUE" not in json.dumps(document)


def test_human_audit_text_adds_a_display_line_without_changing_json(capsys):
    assert main(["audit", "status", "demo/runs/demo-2"]) == 2
    text = capsys.readouterr().out
    assert text.splitlines()[0].startswith("not_checkable")
    assert "Display: UNKNOWN" in text
    assert not text.splitlines()[0].startswith("passed")
    assert "FALSE" not in text
    assert main(["audit", "status", "demo/runs/demo-2", "--json"]) == 2
    assert json.loads(capsys.readouterr().out)["status"] == "not_checkable"
    assert "TRUE" not in capsys.readouterr().out
