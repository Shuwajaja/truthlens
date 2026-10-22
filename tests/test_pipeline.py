"""Launcher acceptance tests; privileged account/paths are simulated explicitly."""

import pytest

from truthlens import pipeline, registry


def test_agent_argv_is_fixed_profile_only():
    assert pipeline.agent_argv(["/opt/agent-zero/bin/task", "--once"]) == [
        "/usr/bin/sudo",
        "-n",
        "-u",
        "tl-agent",
        "--",
        "/usr/bin/env",
        "-i",
        "PATH=/usr/bin:/bin",
        "LANG=C.UTF-8",
        "HOME=/var/lib/tl-agent",
        "/opt/agent-zero/bin/task",
        "--once",
    ]
    with pytest.raises(registry.RegistryError):
        pipeline.agent_argv(["relative-command"])


def test_profile_name_cannot_escape_config_directory():
    for value in ("../external", "/tmp/upload", "agent;sh", "agent zero"):
        with pytest.raises(registry.RegistryError):
            pipeline.load_profile(value)


def test_profile_does_not_accept_unapproved_delegation():
    profile = {
        "enabled": True,
        "agent": "agent-zero",
        "command": ["/opt/a0/task"],
        "repo": "/srv/work",
        "callers": [{"uid": 1234, "name": "Codex", "on_behalf_of": "Other"}],
    }
    with pytest.raises(registry.RegistryError):
        pipeline.delegation(profile, 1234)
    profile["callers"][0]["on_behalf_of"] = "Shu"
    assert pipeline.delegation(profile, 1234)["name"] == "Codex"
    with pytest.raises(registry.RegistryError):
        pipeline.delegation(profile, 5678)


def test_agent_account_cannot_have_privileged_group(monkeypatch):
    from types import SimpleNamespace

    monkeypatch.setattr("pwd.getpwnam", lambda name: SimpleNamespace(pw_uid=1234, pw_gid=1234))
    monkeypatch.setattr("os.getgrouplist", lambda name, gid: [gid, 999])
    monkeypatch.setattr(
        "grp.getgrgid", lambda gid: SimpleNamespace(gr_name="docker" if gid == 999 else "tl-agent")
    )
    with pytest.raises(registry.RegistryError):
        pipeline.agent_account()


def test_pipeline_cli_never_accepts_command_or_initiator_override(capsys):
    from truthlens.cli import main

    with pytest.raises(SystemExit) as error:
        main(["pipeline", "run", "--profile", "agent-zero", "--command", "sh"])
    assert error.value.code == 2
    with pytest.raises(SystemExit):
        main(["admit", "run_external", "--uid", "0"])
    capsys.readouterr()


def test_status_cli_fails_closed_without_host_setup(capsys, monkeypatch):
    from truthlens.cli import main

    monkeypatch.setattr("truthlens.registry.caller_uid", lambda: registry.deny())
    assert main(["status", "run_external"]) == 2
    output = capsys.readouterr()
    assert "not connected" in output.out and not output.err
    assert "/var/lib" not in output.out


def test_multiple_wrapper_copy_phases_are_refused_before_launch(monkeypatch):
    profile = {
        "enabled": True,
        "agent": "agent-zero",
        "command": ["/opt/a0/task"],
        "callers": [{"uid": 1234, "name": "Codex", "on_behalf_of": "Shu"}],
        "tests": [{"command": "first"}, {"command": "second"}],
    }
    monkeypatch.setattr(registry, "caller_uid", lambda: 1234)
    monkeypatch.setattr(pipeline, "trusted", lambda *args, **kwargs: None)
    monkeypatch.setattr(pipeline, "load_profile", lambda name: (profile, "a" * 64))
    monkeypatch.setattr(pipeline, "agent_account", lambda: 1234)
    with pytest.raises(registry.RegistryError):
        pipeline.run_profile("agent-zero")
