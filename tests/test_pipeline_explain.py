"""Operator diagnosis uses simulated root/policy checks; no live host qualification."""

import json
import os
from pathlib import Path
from types import SimpleNamespace

import pytest

from truthlens import pipeline, pipeline_jobs, profile_check, registry
from truthlens.cli import main


@pytest.fixture
def checks(tmp_path, monkeypatch):
    monkeypatch.setattr(os, "getuid", lambda: 0)
    monkeypatch.setattr(os, "geteuid", lambda: 0)
    monkeypatch.setattr(registry, "kernel_login_uid", lambda: 1234)
    monkeypatch.delenv("SUDO_UID", raising=False)
    value = {
        "enabled": True,
        "agent": "agent-zero",
        "command": ["/opt/synthetic/task"],
        "repo": str(tmp_path),
        "callers": [{"uid": 1234, "name": "Codex", "on_behalf_of": "Shu"}],
        "tests": [],
    }
    monkeypatch.setattr(pipeline, "load_profile", lambda name: (value, "a" * 64))
    monkeypatch.setattr(pipeline, "trusted", lambda *a, **kw: None)
    monkeypatch.setattr(pipeline, "agent_account", lambda: 1234)
    monkeypatch.setattr(pipeline, "check_repo", lambda *a: None, raising=False)
    monkeypatch.setattr(profile_check, "_has_head", lambda repo: True)
    monkeypatch.setattr(pipeline, "read_audit_key", lambda *a: b"sk-test-synthetic")
    store = SimpleNamespace(root=tmp_path, run=lambda *a: {}, records=lambda: [])
    monkeypatch.setattr(registry, "Registry", lambda: store)
    monkeypatch.setattr(pipeline_jobs, "status", lambda *a: {})
    for name in ("run_profile", "finalize", "recover_captures"):
        monkeypatch.setattr(pipeline, name, lambda *a: pytest.fail("diagnosis must not execute"))
    monkeypatch.setattr(pipeline_jobs, "drain", lambda *a: pytest.fail("must not drain"))
    return value, store


def explain(capsys, *args, code, rc=2):
    assert main(["pipeline", "explain", *args]) == rc
    assert capsys.readouterr() == ("", code + "\n")


@pytest.mark.parametrize("uid,euid", [(1234, 1234), (0, 1234), (1234, 0)])
def test_root_guard_precedes_parsing_and_reads(monkeypatch, capsys, uid, euid):
    monkeypatch.setattr(os, "getuid", lambda: uid)
    monkeypatch.setattr(os, "geteuid", lambda: euid)
    monkeypatch.setattr(os, "open", lambda *a: pytest.fail("must not read"))
    monkeypatch.setattr(Path, "read_text", lambda *a, **kw: pytest.fail("must not read"))
    monkeypatch.setattr(registry, "caller_uid", lambda: pytest.fail("must not inspect caller"))
    explain(capsys, "PRIVATE_INVALID_ARGUMENT", code="ROOT_REQUIRED")


def test_run_preflight_is_quiet_except_fixed_code(checks, capsys, tmp_path):
    before = list(tmp_path.iterdir())
    explain(capsys, "run", "--profile", "demo", code="PREFLIGHT_OK", rc=0)
    assert list(tmp_path.iterdir()) == before


@pytest.mark.parametrize("args", [[], ["PRIVATE"], ["run"], ["status"], ["status", "r", "--uid", "PRIVATE"]])
def test_argument_errors_never_reflect_input(checks, capsys, args):
    explain(capsys, *args, code="ARGUMENTS_INVALID")


def test_loginuid_unset_and_sudo_mismatch(checks, monkeypatch, capsys):
    monkeypatch.setattr(registry, "kernel_login_uid", lambda: 4294967295)
    monkeypatch.setattr(os, "getppid", lambda: 999)
    explain(capsys, "run", "--profile", "demo", code="CALLER_IDENTITY_UNAVAILABLE")
    monkeypatch.setattr(registry, "kernel_login_uid", lambda: 1234)
    monkeypatch.setenv("SUDO_UID", "5678")
    explain(capsys, "run", "--profile", "demo", code="CALLER_IDENTITY_UNAVAILABLE")


@pytest.mark.parametrize(
    "module,name,reason",
    [
        (pipeline, "trusted", "INSTALLATION_UNTRUSTED"),
        (pipeline, "load_profile", "PROFILE_UNTRUSTED"),
        (pipeline, "agent_account", "AGENT_ACCOUNT_UNSAFE"),
        (pipeline, "check_repo", "REPO_UNTRUSTED"),
        (registry, "Registry", "REGISTRY_UNAVAILABLE"),
        (pipeline, "read_audit_key", "KEY_UNREADABLE"),
    ],
)
def test_fixed_stage_codes(checks, monkeypatch, capsys, module, name, reason):
    def denied(*a, **kw):
        raise RuntimeError("PRIVATE_CONTENT /private/path sk-test-synthetic")

    monkeypatch.setattr(module, name, denied)
    explain(capsys, "run", "--profile", "demo", code=reason)


@pytest.mark.parametrize(
    "change,reason",
    [
        ({"callers": [{"uid": 5678, "name": "Codex", "on_behalf_of": "Shu"}]}, "DELEGATION_DENIED"),
        ({"enabled": False}, "DELEGATION_DENIED"),
        ({"command": ["relative"]}, "COMMAND_UNTRUSTED"),
        ({"tests": [{}, {}]}, "TESTS_INVALID"),
        ({"tests": "PRIVATE"}, "TESTS_INVALID"),
    ],
)
def test_existing_profile_denials(checks, capsys, change, reason):
    checks[0].update(change)
    explain(capsys, "run", "--profile", "demo", code=reason)


def test_command_metadata_and_repo_head_codes(checks, monkeypatch, capsys):
    def trust(path, **kw):
        if path == Path(checks[0]["command"][0]):
            registry.deny()

    monkeypatch.setattr(pipeline, "trusted", trust)
    explain(capsys, "run", "--profile", "demo", code="COMMAND_UNTRUSTED")
    monkeypatch.setattr(pipeline, "trusted", lambda *a, **kw: None)
    monkeypatch.setattr(profile_check, "_has_head", lambda repo: False)
    explain(capsys, "run", "--profile", "demo", code="REPO_HEAD_MISSING")


def test_status_reuses_authorization_and_never_reads_key(checks, monkeypatch, capsys):
    calls = []
    checks[1].run = lambda *a: calls.append(a) or {}
    monkeypatch.setattr(pipeline, "read_audit_key", lambda *a: pytest.fail("status must not read key"))
    explain(capsys, "status", "synthetic-run", "--uid", "5678", code="PREFLIGHT_OK", rc=0)
    assert calls == [("synthetic-run", 5678)]
    checks[1].run = lambda *a: registry.deny()
    explain(capsys, "status", "synthetic-run", code="RUN_ACCESS_DENIED")
    checks[1].run = lambda *a: {}
    monkeypatch.setattr(pipeline_jobs, "status", lambda *a: registry.deny())
    explain(capsys, "status", "synthetic-run", code="STATUS_UNAVAILABLE")


def test_existing_outputs_remain_identical_and_do_not_import_diagnosis(monkeypatch, capsys, tmp_path):
    from truthlens import mcp_status, status_broker, status_client

    monkeypatch.setattr(registry, "caller_uid", registry.deny)
    expected = (
        '{"connection": "not connected", "message": "Pipeline unavailable or access denied.", '
        '"state": "unavailable"}\n'
    )
    for args in (["pipeline", "run", "--profile", "PRIVATE"], ["status", "PRIVATE"]):
        assert main(args) == 2
        assert capsys.readouterr() == (expected, "")
    for status, rc in (("passed", 0), ("failed", 1), ("not_checkable", 2)):
        monkeypatch.setattr(status_client, "check_status", lambda *a: {"status": status})
        assert main(["agent-status", "--socket", str(tmp_path / "s"), "r", "--json"]) == rc
        assert capsys.readouterr() == (json.dumps({"status": status}, separators=(",", ":")) + "\n", "")
        monkeypatch.setattr(mcp_status, "check_status", lambda *a: {"status": status})
        assert mcp_status.call_status(tmp_path / "s", "truthlens_check_status", {"run_id": "r"}) == {
            "status": status
        }
        assert capsys.readouterr() == ("", "")
    assert mcp_status.call_status(tmp_path / "s", "explain", {"run_id": "r"}) == {"status": "not_checkable"}
    assert status_broker.registered_status(None, "r", 1234) == {"status": "not_checkable"}
    assert capsys.readouterr() == ("", "")
