"""Key lifecycle acceptance; all secrets and runs stay in pytest temp directories."""

import io
import json
import os
import stat

import pytest

from truthlens.audit_inputs import AuditInputError
from truthlens.cli import main
from truthlens.keys import read_key_file


def test_init_private_and_exclusive(tmp_path, capsys):
    path = tmp_path / "private" / "hmac.key"
    assert main(["key", "init", "--out", str(path), "--key-id", "first"]) == 0
    before = path.read_bytes()
    assert len(before.strip()) == 64
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert stat.S_IMODE(path.parent.stat().st_mode) == 0o700
    assert main(["key", "init", "--out", str(path)]) == 2
    assert bool(path.read_bytes() == before)
    output = capsys.readouterr()
    # Boolean assertions keep pytest from displaying secret operands on failure.
    assert bool(before.strip().decode() not in output.out + output.err)
    assert "first" in output.out
    assert "--hmac-key-file" in output.out


def test_default_xdg_and_doctor_hint(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("HOME", str(tmp_path / "home"))
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "config"))
    monkeypatch.delenv("TRUTHLENS_HMAC_KEY", raising=False)
    monkeypatch.delenv("TRUTHLENS_HMAC_KEY_FILE", raising=False)
    assert main(["doctor"]) == 1
    assert "truthlens key init" in capsys.readouterr().out
    assert main(["key", "init"]) == 0
    assert (tmp_path / "config" / "truthlens" / "hmac.key").is_file()


def test_cli_run_rotation_roundtrip(tmp_path, capsys):
    from tests.test_wrapper import _repo
    from truthlens.ledger import Ledger

    key = tmp_path / "keys" / "hmac.key"
    repo, _ = _repo(tmp_path)
    assert main(["key", "init", "--out", str(key), "--key-id", "first"]) == 0
    secrets = [key.read_bytes().strip().decode()]

    def capture(name):
        out = tmp_path / name
        assert (
            main(["run", "--out", str(out), "--repo", str(repo), "--hmac-key-file", str(key), "--", "true"])
            == 0
        )
        capsys.readouterr()
        return out

    old = capture("old")
    assert Ledger(old / "ledger.jsonl").read()[0]["hmac_key_id"] == "first"

    def audit(out):
        main(["audit", str(out), "--hmac-key-file", str(key), "--json"])
        return json.loads(capsys.readouterr().out)

    assert audit(old)["authentication"] == "supported"
    assert main(["key", "rotate", "--key-file", str(key), "--key-id", "second"]) == 0
    secrets.append(key.read_bytes().strip().decode())
    output = capsys.readouterr()
    assert bool(all(value not in output.out + output.err for value in secrets))
    report = audit(old)
    assert report["authentication"] == "not_checkable"
    assert report["integrity"] == "hash-only"
    assert any(
        "signed with retired key first; key no longer available" in c["message"] for c in report["checks"]
    )
    assert audit(capture("new"))["authentication"] == "supported"


def test_force_retires_id_and_never_reuses_it(tmp_path, capsys):
    path = tmp_path / "hmac.key"
    assert main(["key", "init", "--out", str(path), "--key-id", "first"]) == 0
    old = path.read_bytes()
    assert main(["key", "init", "--out", str(path), "--key-id", "first", "--force"]) == 2
    assert bool(path.read_bytes() == old)
    # Losing the file preserves its sidecar and retirement history.
    path.unlink()
    assert main(["key", "init", "--out", str(path), "--force"]) == 0
    assert bool(path.read_bytes() != old)
    key = read_key_file(path)
    assert key.retired == ("first",)
    assert "[REDACTED]" in repr(key)
    metadata = path.with_name(path.name + ".keyring.json")
    assert stat.S_IMODE(metadata.stat().st_mode) == 0o600
    output = capsys.readouterr()
    assert bool(
        all(
            value.strip().decode() not in output.out + output.err + metadata.read_text()
            for value in (old, path.read_bytes())
        )
    )


@pytest.mark.parametrize("kind", ["file_link", "parent_link", "hardlink", "repo", "run", "agent"])
def test_unsafe_destinations_refused(tmp_path, capsys, kind):
    target = tmp_path / "target"
    target.mkdir()
    path = target / "hmac.key"
    if kind in {"file_link", "hardlink"}:
        other = tmp_path / "unchanged"
        other.write_bytes(b"sk-test-unchanged")
        other.chmod(0o600)
        if kind == "file_link":
            path.symlink_to(other)
        else:
            os.link(other, path)
    elif kind == "parent_link":
        (tmp_path / "alias").symlink_to(target, target_is_directory=True)
        path = tmp_path / "alias" / "hmac.key"
    elif kind == "repo":
        (target / ".git").mkdir()
    elif kind == "run":
        (target / "ledger.jsonl").touch()
    else:
        path = tmp_path / ".codex" / "hmac.key"
    assert main(["key", "init", "--out", str(path), "--force"]) == 2
    if kind in {"file_link", "hardlink"}:
        assert bool(other.read_bytes() == b"sk-test-unchanged")
    assert "error:" in capsys.readouterr().err


def test_pending_rotation_fails_closed(tmp_path, monkeypatch, capsys):
    from truthlens import keys

    path = tmp_path / "hmac.key"
    assert main(["key", "init", "--out", str(path)]) == 0
    original = keys._write

    def interrupted(fd, name, data, *, replace):
        if name == path.name:
            raise OSError("simulated failure")
        original(fd, name, data, replace=replace)

    with monkeypatch.context() as patch:
        patch.setattr(keys, "_write", interrupted)
        assert main(["key", "rotate", "--key-file", str(path)]) == 2
    with pytest.raises(AuditInputError):
        read_key_file(path)
    assert main(["key", "init", "--out", str(path), "--force"]) == 0
    assert read_key_file(path).key_id
    capsys.readouterr()


@pytest.mark.parametrize("location", ["repo", "run", ".codex", ".claude", ".cursor", ".gemini", ".agents"])
def test_loading_refuses_keys_in_agent_repo_and_run_folders(tmp_path, location):
    parent = tmp_path / location
    parent.mkdir()
    if location == "repo":
        (parent / ".git").mkdir()
    elif location == "run":
        (parent / "ledger.jsonl").touch()
    path = parent / "hmac.key"
    path.write_bytes(b"sk-test-location-only")
    path.chmod(0o600)
    with pytest.raises(AuditInputError):
        read_key_file(path)


def test_mcp_file_precedence_and_retired_run(tmp_path, monkeypatch, capsys):
    from tests.test_mcp_catalog import _signed

    path = tmp_path / "hmac.key"
    assert main(["key", "init", "--out", str(path), "--key-id", "test-key"]) == 0
    root = _signed(tmp_path, key=read_key_file(path))
    monkeypatch.setenv("TRUTHLENS_ROOT", str(root))
    monkeypatch.setenv("TRUTHLENS_HMAC_KEY_FILE", str(path))
    monkeypatch.setenv("TRUTHLENS_HMAC_KEY", "sk-test-wrong-environment")
    capsys.readouterr()

    def verify(*flags):
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": "verify_run", "arguments": {"path": "signed"}},
        }
        monkeypatch.setattr("sys.stdin", io.StringIO(json.dumps(request) + "\n"))
        assert main(["mcp", *flags]) == 0
        return json.loads(json.loads(capsys.readouterr().out)["result"]["content"][0]["text"])

    assert verify()["verified"] is True
    monkeypatch.setenv("TRUTHLENS_HMAC_KEY_FILE", str(tmp_path / "missing"))
    assert verify("--hmac-key-file", str(path), "--hmac-key-env", "MISSING_ENV")["verified"] is True
    assert main(["key", "rotate", "--key-file", str(path)]) == 0
    capsys.readouterr()
    retired = verify("--hmac-key-file", str(path))
    assert retired["verdict"] == "UNKNOWN"
    assert "signed with retired key test-key" in retired["reason"]
    assert main(["mcp"]) == 2  # No fallback to a valid env key for a bad file.
    capsys.readouterr()


@pytest.mark.parametrize("agent", ["codex", "cursor", "agent-zero"])
def test_setup_file_support_and_doctor(tmp_path, monkeypatch, capsys, agent):
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.delenv("TRUTHLENS_HMAC_KEY", raising=False)
    path = tmp_path / "keys" / "hmac.key"
    assert main(["key", "init", "--out", str(path)]) == 0
    monkeypatch.setenv("TRUTHLENS_HMAC_KEY_FILE", str(path))
    config = tmp_path / ("config.toml" if agent == "codex" else "mcp.json")
    root = tmp_path / "runs"
    root.mkdir()
    assert (
        main(
            [
                "setup",
                "--agent",
                agent,
                "--root",
                str(root),
                "--write",
                "--config",
                str(config),
                "--hmac-key-env",
                "UNSET_ENV",
            ]
        )
        == 0
    )
    text = config.read_text()
    assert "--hmac-key-file" in text and str(path) in text
    assert "UNSET_ENV" not in text
    assert bool(path.read_text().strip() not in text)
    from truthlens.setup_mcp import doctor_report

    code, report = doctor_report(home=tmp_path, environ={}, root=str(root), key_file=str(path))
    assert code == 1  # No installed harness entry in this fake home.
    assert "key=present" in report
    assert str(path) not in report
    capsys.readouterr()


def test_setup_without_key_suggests_init(tmp_path, monkeypatch, capsys):
    monkeypatch.delenv("TRUTHLENS_HMAC_KEY_FILE", raising=False)
    monkeypatch.delenv("TRUTHLENS_HMAC_KEY", raising=False)
    assert (
        main(
            [
                "setup",
                "--agent",
                "cursor",
                "--root",
                str(tmp_path / "runs"),
                "--config",
                str(tmp_path / "mcp.json"),
                "--write",
            ]
        )
        == 0
    )
    assert "truthlens key init" in capsys.readouterr().err


def test_current_key_bad_signature_still_fails(tmp_path, capsys):
    from tests.audit_support import make_run
    from truthlens.audit import audit_run

    path = tmp_path / "hmac.key"
    assert main(["key", "init", "--out", str(path), "--key-id", "test-key"]) == 0
    root = make_run(tmp_path / "run", key=read_key_file(path))
    ledger = root / "ledger.jsonl"
    lines = ledger.read_text().splitlines()
    event = json.loads(lines[0])
    event["hmac"] = "0" * 64
    from truthlens.canonical import canonical_bytes

    lines[0] = canonical_bytes(event).decode()
    ledger.write_text("\n".join(lines) + "\n")
    result = audit_run(root, hmac_key=read_key_file(path))
    assert result["authentication"] == "contradictory"
    assert result["conclusion"] == "contradictory"
    assert "keys.py" in result["input_digests"]["verifier"]
    capsys.readouterr()


def test_key_command_without_posix_locking_fails_closed(tmp_path, monkeypatch, capsys):
    import builtins

    original = builtins.__import__

    def importing(name, *args, **kwargs):
        if name == "fcntl":
            raise ImportError("simulated non-POSIX platform")
        return original(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", importing)
    path = tmp_path / "hmac.key"
    assert main(["key", "init", "--out", str(path)]) == 2
    assert not path.exists()
    assert "require POSIX file locking" in capsys.readouterr().err
