"""Setup writer, config prompt, and read-only harness doctor."""

import stat
from pathlib import Path

from truthlens.cli import main

SECRET = "sk-test-setup-secret-value"


def _isolate(monkeypatch, home: Path, path: Path) -> None:
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("PATH", str(path))
    for name in (
        "CODEX_HOME",
        "GEMINI_CLI_HOME",
        "CLAUDE_CONFIG_DIR",
        "TRUTHLENS_ROOT",
        "TRUTHLENS_HMAC_KEY",
        "TRUTHLENS_AGENT_ZERO_SETTINGS",
        "TRUTHLENS_MAUSBOT_CONFIG",
    ):
        monkeypatch.delenv(name, raising=False)


def _exe(directory: Path, name: str) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    binary = directory / name
    binary.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
    binary.chmod(binary.stat().st_mode | stat.S_IXUSR)


def test_print_formats_store_the_name_only(capsys, monkeypatch):
    monkeypatch.setenv("TRUTHLENS_HMAC_KEY", SECRET)
    root = "/path/to/local/runs"
    cases = {
        "codex": "[mcp_servers.truthlens]",
        "claude-code": '"mcpServers"',
        "gemini": '"mcpServers"',
        "cursor": '"mcpServers"',
        "mausbot": '"mcpServers"',
        "agent-zero": '"mcp_servers"',
    }
    for agent, marker in cases.items():
        assert main([
            "setup", "--agent", agent, "--root", root, "--key-env", "TRUTHLENS_HMAC_KEY", "--print",
        ]) == 0
        text = capsys.readouterr().out
        assert marker in text
        assert "TRUTHLENS_HMAC_KEY" in text
        assert root in text
        assert SECRET not in text
        assert "--hmac-key-env" in text


def test_write_makes_bak_and_preserves_other_entries(tmp_path, capsys, monkeypatch):
    monkeypatch.setenv("TRUTHLENS_HMAC_KEY", SECRET)
    destination = tmp_path / "config.toml"
    destination.write_text(
        '# keep sk-test-existing-token\n[mcp_servers.other]\ncommand = "other"\n',
        encoding="utf-8",
    )
    before = destination.read_bytes()
    first_root = str(tmp_path / "runs")
    args = [
        "setup", "--agent", "codex", "--root", first_root,
        "--key-env", "TRUTHLENS_HMAC_KEY", "--config", str(destination), "--write",
    ]
    assert main(args) == 0
    assert "config written" in capsys.readouterr().err
    assert Path(str(destination) + ".bak").read_bytes() == before
    written = destination.read_text(encoding="utf-8")
    assert "sk-test-existing-token" in written
    assert "[mcp_servers.other]" in written
    assert "TRUTHLENS_HMAC_KEY" in written
    assert SECRET not in written
    capsys.readouterr()
    assert main([
        "setup", "--agent", "codex", "--root", str(tmp_path / "other"),
        "--key-env", "TRUTHLENS_HMAC_KEY", "--config", str(destination), "--write",
    ]) == 0
    backup = Path(str(destination) + ".bak").read_text(encoding="utf-8")
    assert first_root in backup
    assert str(tmp_path / "other") in destination.read_text(encoding="utf-8")
    assert SECRET not in destination.read_text(encoding="utf-8")
    assert SECRET not in backup


def test_second_write_backs_up_the_previous_file(tmp_path, capsys):
    destination = tmp_path / "mcp.json"
    base = ["setup", "--agent", "cursor", "--key-env", "TRUTHLENS_HMAC_KEY", "--config", str(destination), "--write"]
    assert main([*base, "--root", str(tmp_path / "one")]) == 0
    capsys.readouterr()
    first = destination.read_text(encoding="utf-8")
    assert main([*base, "--root", str(tmp_path / "two")]) == 0
    assert Path(str(destination) + ".bak").read_text(encoding="utf-8") == first
    assert str(tmp_path / "two") in destination.read_text(encoding="utf-8")
    assert '"other"' not in first


def test_json_merge_keeps_unrelated_keys(tmp_path, capsys):
    destination = tmp_path / "settings.json"
    destination.write_text(
        '{"ui": true, "mcpServers": {"other": {"command": "other"}, "note": "sk-test-existing-token"}}',
        encoding="utf-8",
    )
    assert main([
        "setup", "--agent", "gemini", "--root", str(tmp_path / "runs"),
        "--key-env", "MY_KEY_NAME", "--config", str(destination), "--write",
    ]) == 0
    capsys.readouterr()
    text = destination.read_text(encoding="utf-8")
    assert '"ui": true' in text
    assert '"other"' in text
    assert "sk-test-existing-token" in text
    assert "MY_KEY_NAME" in text
    assert "sk-test-setup" not in text


def test_refuses_a_pasted_key_and_a_symlink(tmp_path, capsys, monkeypatch):
    monkeypatch.setenv("TRUTHLENS_HMAC_KEY", SECRET)
    assert main([
        "setup", "--agent", "codex", "--root", str(tmp_path), "--key-env", SECRET, "--print",
    ]) == 2
    captured = capsys.readouterr()
    assert SECRET not in captured.out + captured.err
    link = tmp_path / "link.toml"
    link.symlink_to(tmp_path / "missing.toml")
    assert main([
        "setup", "--agent", "codex", "--root", str(tmp_path / "runs"),
        "--key-env", "TRUTHLENS_HMAC_KEY", "--config", str(link), "--write",
    ]) == 2
    assert not (tmp_path / "missing.toml").exists()


def test_prompt_contains_no_secret(capsys, monkeypatch, tmp_path):
    monkeypatch.setenv("TRUTHLENS_HMAC_KEY", SECRET)
    monkeypatch.setenv("HOME", str(tmp_path / "home"))
    assert main(["setup", "--prompt"]) == 0
    text = capsys.readouterr().out
    assert SECRET not in text
    assert "sk-" not in text
    assert str(tmp_path) not in text
    assert "<path>" in text
    assert "Ask the user before writing any config file." in text
    assert ".bak" in text
    assert "truthlens doctor" in text
    assert "unklar" in text
    for agent in ("codex", "claude-code", "gemini", "cursor", "agent-zero"):
        assert f"--agent {agent} --root <path> --key-env TRUTHLENS_HMAC_KEY --write" in text
    assert "mausbot" not in text
    assert main(["setup", "--prompt", "--agent", "claude-code"]) == 0
    one = capsys.readouterr().out
    assert "--agent claude-code" in one
    assert SECRET not in one
    assert "--agent codex" not in one


def test_noninteractive_usage_and_interactive_print(capsys, monkeypatch):
    monkeypatch.setattr("sys.stdin", __import__("io").StringIO(""))
    assert main(["setup"]) == 2
    assert SECRET not in capsys.readouterr().out + capsys.readouterr().err
    stdin = __import__("io").StringIO(
        "cursor\n/path/to/local/runs\nTRUTHLENS_HMAC_KEY\nprint\n"
    )
    stdin.isatty = lambda: True  # type: ignore[method-assign]
    monkeypatch.setattr("sys.stdin", stdin)
    monkeypatch.setenv("TRUTHLENS_HMAC_KEY", SECRET)
    assert main(["setup"]) == 0
    text = capsys.readouterr().out
    assert '"mcpServers"' in text
    assert SECRET not in text


def test_doctor_uses_fake_home_and_path(tmp_path, capsys, monkeypatch):
    home = tmp_path / "home"
    binaries = tmp_path / "bin"
    runs = tmp_path / "runs"
    runs.mkdir()
    _exe(binaries, "codex")
    _exe(binaries, "agy")
    _isolate(monkeypatch, home, binaries)
    secret_file = home / ".codex" / "config.toml"
    secret_file.parent.mkdir(parents=True)
    secret_file.write_text(
        "\n".join([
            f"# {SECRET}",
            "[mcp_servers.truthlens]",
            'command = "truthlens"',
            'args = ["mcp", "--hmac-key-env", "TRUTHLENS_HMAC_KEY"]',
            "",
            "[mcp_servers.truthlens.env]",
            f'TRUTHLENS_ROOT = "{runs}"',
            "",
        ]),
        encoding="utf-8",
    )
    monkeypatch.setenv("TRUTHLENS_HMAC_KEY", SECRET)
    before = secret_file.read_bytes()
    assert main(["doctor"]) == 0
    report = capsys.readouterr()
    assert SECRET not in report.out + report.err
    assert str(runs) not in report.out
    assert report.out.splitlines()[0] == "RESULT root=ok key=present entries=1"
    assert "codex | ja | ja | vorhanden" in report.out
    assert "gemini | ja | nein | truthlens setup --agent gemini" in report.out
    assert "claude-code | nein | nein | truthlens setup --agent claude-code" in report.out
    assert "cursor | nein | nein | truthlens setup --agent cursor" in report.out
    assert "agent-zero | nein | nein | truthlens setup --agent agent-zero" in report.out
    assert "mausbot | nein | nein | truthlens setup --agent mausbot" in report.out
    assert secret_file.read_bytes() == before

    _exe(binaries, "cursor-agent")
    capsys.readouterr()
    assert main(["doctor"]) == 0
    second = capsys.readouterr().out
    assert "cursor | ja | nein | truthlens setup --agent cursor" in second
    assert SECRET not in second


def test_doctor_agent_zero_and_mausbot_need_a_path(tmp_path, capsys, monkeypatch):
    home = tmp_path / "home"
    home.mkdir()
    runs = tmp_path / "runs"
    runs.mkdir()
    _isolate(monkeypatch, home, tmp_path / "empty-path")
    settings = tmp_path / "settings.json"
    settings.write_text(
        '{"mcp_servers": {"truthlens": {"command": "truthlens", "args": '
        '["mcp", "--hmac-key-env", "TRUTHLENS_HMAC_KEY"], "env": {"TRUTHLENS_ROOT": "'
        + str(runs)
        + '"}}}, "token": "'
        + SECRET
        + '"}',
        encoding="utf-8",
    )
    mausbot = tmp_path / "mausbot.json"
    mausbot.write_text('{"mcpServers": {"other": {"command": "other"}}, "token": "' + SECRET + '"}', encoding="utf-8")
    monkeypatch.setenv("TRUTHLENS_HMAC_KEY", SECRET)
    assert main([
        "doctor",
        "--agent-zero-settings",
        str(settings),
        "--mausbot-config",
        str(mausbot),
    ]) == 0
    report = capsys.readouterr()
    assert "agent-zero | ja | ja | vorhanden" in report.out
    assert "mausbot | ja | nein | truthlens setup --agent mausbot" in report.out
    assert SECRET not in report.out + report.err
    assert str(settings) not in report.out
    assert str(mausbot) not in report.out


def test_doctor_reports_missing_root_and_key_without_values(tmp_path, capsys, monkeypatch):
    home = tmp_path / "home"
    home.mkdir()
    _isolate(monkeypatch, home, tmp_path / "bin")
    _exe(tmp_path / "bin", "claude")
    assert main(["doctor", "--root", str(tmp_path / "missing")]) == 1
    report = capsys.readouterr()
    assert "RESULT root=missing key=missing entries=0" in report.out
    assert "claude-code | ja | nein | truthlens setup --agent claude-code" in report.out
    assert "ROOT_MISSING" in report.out
    assert "KEY_ENV_MISSING" in report.out
    assert main(["doctor", "--root", str(home), "--key-env", "TRUTHLENS_HMAC_KEY"]) == 1
    assert "RESULT root=ok key=missing entries=0" in capsys.readouterr().out


def test_socket_doctor_is_unchanged(capsys):
    assert main(["doctor", "--socket", "/run/truthlens/status.sock"]) == 2
    assert "ISOLATION_UNVERIFIED" in capsys.readouterr().out


def test_setup_doc_has_both_languages_and_the_prompt():
    text = (Path(__file__).parents[1] / "docs" / "setup-mcp.md").read_text(encoding="utf-8")
    assert "## Deutsch" in text
    assert "## English" in text
    assert "unklar" in text
    assert "UNKNOWN" in text
    assert "TRUTHLENS_HMAC_KEY" in text
    assert ".bak" in text
    assert "Ask the user before writing any config file." in text
    assert "Frage die Nutzerin oder den Nutzer, bevor eine Konfigurationsdatei geschrieben wird." in text
    for agent in ("codex", "claude-code", "gemini", "cursor", "agent-zero", "mausbot"):
        assert f"--agent {agent}" in text
    assert SECRET not in text
    assert "sk-" not in text
