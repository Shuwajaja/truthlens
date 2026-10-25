"""G2 DX acceptance: synthetic data/temp sockets only, no live client qualification."""

import builtins
import importlib.util
import json
import os
import socket
import subprocess
import sys
import tomllib
from pathlib import Path

import pytest

from truthlens.cli import main

CLIENTS = ("claude-code", "codex", "cursor", "agent-zero")
SOCKET = '/run/truthlens/status "quoted".sock'
PRIVATE = "/synthetic/private EVENTS EVIDENCE https://private.invalid run-private sk-test-sentinel"


def setup_module_api():
    from truthlens import agent_setup

    return agent_setup


@pytest.mark.parametrize("status,code", [("passed", 0), ("failed", 1), ("not_checkable", 2)])
@pytest.mark.parametrize("as_json", [False, True])
def test_agent_status_uses_existing_client_and_emits_only_status(monkeypatch, capsys, status, code, as_json):
    from truthlens import status_client

    calls = []

    def query(path, run_id):
        calls.append((str(path), run_id))
        return {"status": status}

    monkeypatch.setattr(status_client, "check_status", query)
    args = ["agent-status", "known", "--socket", SOCKET] + (["--json"] if as_json else [])
    assert main(args) == code
    captured = capsys.readouterr()
    assert captured.out == (f'{{"status":"{status}"}}\n' if as_json else status + "\n")
    assert captured.err == ""
    assert calls == [(SOCKET, "known")]


@pytest.mark.parametrize("value", [None, {}, {"status": "passed", "events": PRIVATE}, {"status": PRIVATE}])
def test_agent_status_rejects_non_status_client_output(monkeypatch, capsys, value):
    from truthlens import status_client

    monkeypatch.setattr(status_client, "check_status", lambda *a: value)
    assert main(["agent-status", "known", "--socket", SOCKET, "--json"]) == 2
    captured = capsys.readouterr()
    assert captured.out == '{"status":"not_checkable"}\n'
    assert captured.err == ""


def test_agent_status_never_reflects_client_exceptions(monkeypatch, capsys):
    from truthlens import status_client

    def broken(*args):
        raise RuntimeError(PRIVATE)

    monkeypatch.setattr(status_client, "check_status", broken)
    assert main(["agent-status", "known", "--socket", SOCKET]) == 2
    assert capsys.readouterr() == ("not_checkable\n", "")


@pytest.mark.parametrize("args", [[], ["--json"], [PRIVATE], ["known", "--root", PRIVATE],
                                   ["../private", "--socket", SOCKET], ["known", "--sock", SOCKET]])
def test_agent_status_bad_arguments_have_no_reflection_or_io(monkeypatch, capsys, args):
    from truthlens import status_client

    monkeypatch.setattr(status_client, "check_status", lambda *a: pytest.fail("invalid arguments queried broker"))
    assert main(["agent-status", *args]) == 2
    captured = capsys.readouterr()
    assert captured.out == ('{"status":"not_checkable"}\n' if "--json" in args else "not_checkable\n")
    assert captured.err == ""


@pytest.mark.parametrize("client", CLIENTS)
def test_generated_config_roundtrips_and_only_invokes_status_adapter(client, capsys):
    assert main(["agent-config", client, "--socket", SOCKET]) == 0
    captured = capsys.readouterr()
    doc = tomllib.loads(captured.out) if client == "codex" else json.loads(captured.out)
    servers = doc["mcp_servers" if client == "codex" else "mcpServers"]
    assert doc == {"mcp_servers" if client == "codex" else "mcpServers": {
        "truthlens": {"command": "truthlens", "args": ["mcp-status", "--socket", SOCKET]}}}
    assert captured.err == ""
    assert setup_module_api().valid_config(captured.out, client, SOCKET)


def test_config_explicit_output_is_exclusive_and_no_follow(tmp_path, capsys):
    destination = tmp_path / "snippet.json"
    args = ["agent-config", "cursor", "--socket", SOCKET, "--output", str(destination)]
    assert main(args) == 0
    first = destination.read_bytes()
    assert destination.stat().st_mode & 0o777 == 0o600
    assert main(args) == 2
    assert destination.read_bytes() == first
    link = tmp_path / "link"
    link.symlink_to(destination)
    assert main([*args[:-1], str(link)]) == 2
    assert destination.read_bytes() == first
    assert PRIVATE not in str(capsys.readouterr())


@pytest.mark.parametrize("path", ["relative.sock", "../private", "/x/../private", "/x\nINJECT", "https://private", "/" + "x" * 101])
def test_config_rejects_unsafe_socket_without_reflecting(path, capsys):
    assert main(["agent-config", "cursor", "--socket", path]) == 2
    assert capsys.readouterr() == ("", "Client config unavailable.\n")


@pytest.mark.parametrize("client", CLIENTS)
def test_doctor_is_read_only_and_never_connects_or_opens_other_files(tmp_path, monkeypatch, capsys, client):
    api = setup_module_api()
    config = tmp_path / "client.conf"
    config.write_text(api.render_config(client, SOCKET))
    before = {p.name: (p.read_bytes(), p.stat().st_mode, p.stat().st_mtime_ns) for p in tmp_path.iterdir()}
    original_open = os.open

    def guarded_open(path, flags, *args, **kw):
        assert not flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC)
        assert Path(path) == config
        return original_open(path, flags, *args, **kw)

    monkeypatch.setattr(os, "open", guarded_open)
    monkeypatch.setattr(socket.socket, "connect", lambda *a: pytest.fail("doctor connected"))
    monkeypatch.setattr(builtins, "open", lambda *a, **kw: pytest.fail("unexpected file read/write"))
    assert main(["doctor", "--socket", SOCKET, "--client", client, "--config", str(config)]) == 2
    captured = capsys.readouterr()
    assert captured.err == ""
    assert captured.out == ("SOCKET_UNSAFE_OR_MISSING\nADAPTER_IMPORTABLE\nMCP_SDK_PRESENT\n"
                            "CLIENT_CONFIG_VALID\nISOLATION_UNVERIFIED\n")
    after = {p.name: (p.read_bytes(), p.stat().st_mode, p.stat().st_mtime_ns) for p in tmp_path.iterdir()}
    assert after == before


@pytest.mark.parametrize("content", [PRIVATE, '{"mcpServers":{},"mcpServers":{}}', '[]', '{"status":"passed"}'])
def test_doctor_invalid_config_never_reflects_contents(tmp_path, capsys, content):
    config = tmp_path / "client.json"
    config.write_text(content)
    assert main(["doctor", "--socket", SOCKET, "--config", str(config)]) == 2
    captured = capsys.readouterr()
    assert "CLIENT_CONFIG_INVALID\n" in captured.out
    assert PRIVATE not in captured.out + captured.err
    assert str(config) not in captured.out + captured.err


def test_doctor_refuses_symlinks_fifo_and_oversize_files(tmp_path, capsys):
    target = tmp_path / "target"
    target.write_text(" " * 16385)
    link = tmp_path / "link"
    link.symlink_to(target)
    fifo = tmp_path / "fifo"
    os.mkfifo(fifo)
    for path in (target, link, fifo, tmp_path / "absent"):
        assert main(["doctor", "--config", str(path)]) == 2
        assert "CLIENT_CONFIG_INVALID" in capsys.readouterr().out


def test_doctor_missing_sdk_and_adapter_errors_are_fixed(monkeypatch, capsys):
    api = setup_module_api()

    def broken(*a):
        raise ImportError(PRIVATE)

    monkeypatch.setattr(api.importlib, "import_module", broken)
    monkeypatch.setattr(api.importlib.util, "find_spec", lambda *a: None)
    assert main(["doctor"]) == 2
    assert capsys.readouterr() == ("SOCKET_UNSAFE_OR_MISSING\nADAPTER_UNAVAILABLE\nMCP_SDK_MISSING\n"
                                 "CLIENT_CONFIG_VALID\nISOLATION_UNVERIFIED\n", "")


@pytest.mark.parametrize("args,message", [(["doctor", "--unknown", PRIVATE], "Doctor unavailable."),
    (["agent-config", PRIVATE], "Client config unavailable."), (["demo-status", "--socket", PRIVATE], "Demo unavailable.")])
def test_human_command_invalid_options_never_reflect(args, message, capsys):
    assert main(args) == 2
    assert capsys.readouterr() == ("", message + "\n")


def test_demo_is_labelled_end_to_end_and_does_not_patch_real_client(tmp_path, monkeypatch, capsys):
    import tempfile
    from truthlens import status_client, status_wire

    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    original_query = status_client.check_status
    original_uid = status_wire.BROKER_UID
    assert main(["demo-status"]) == 0
    assert capsys.readouterr() == ("DEMO ONLY: synthetic fake broker; no audit or approval.\n"
        "Simulated: passed\nSimulated: failed\nSimulated: not_checkable\n"
        "Real client: not_checkable\n", "")
    assert list(tmp_path.iterdir()) == []
    assert status_client.check_status is original_query
    assert status_wire.BROKER_UID == original_uid


@pytest.mark.parametrize("command,args", [("agent-status", ["known", "--socket", "/absent"]),
    ("doctor", []), ("agent-config", ["cursor", "--socket", "/run/truthlens/status.sock"]),
    ("demo-status", ["--help"])])
def test_entrypoints_import_no_private_sources(command, args):
    script = """
import sys
from truthlens.cli import main
try:
    main(sys.argv[1:])
except SystemExit:
    pass
assert not any('truthlens.' + m in sys.modules for m in
 ['registry', 'registry_view', 'pipeline', 'pipeline_jobs', 'read_service',
  'read_projection', 'audit', 'ledger', 'manifest', 'wrapper'])
"""
    result = subprocess.run([sys.executable, "-B", "-c", script, command, *args], capture_output=True, timeout=10,
        env={**os.environ, "PYTHONPATH": "src"})
    assert result.returncode == 0, result.stderr


def test_g2_modules_always_select_dx_and_g1_regressions():
    script = Path(__file__).resolve().parents[1] / ".github/ci_scope.py"
    spec = importlib.util.spec_from_file_location("g2_scope", script)
    scope = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(scope)
    expected = {"tests/test_agent_setup.py", "tests/test_status_broker.py", "tests/test_mcp_status.py"}
    for name in ("cli", "agent_status", "agent_setup", "demo_status"):
        assert expected.issubset(scope.extra_tests([f"src/truthlens/{name}.py"]))


@pytest.mark.parametrize("status", ["passed", "failed", "not_checkable"])
def test_cli_and_mcp_share_real_temp_broker_status(tmp_path, monkeypatch, capsys, status):
    """Real Unix wire; only ownership checks simulated, no host-isolation claim."""
    import threading
    from truthlens import status_wire as wire
    from truthlens.mcp_status import call_status

    monkeypatch.setattr(wire, "trusted_parent", lambda p: None)
    monkeypatch.setattr(wire, "BROKER_UID", os.getuid())
    path = tmp_path / "s"
    requests = []
    errors = []
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as server:
        server.bind(str(path))
        server.listen(1)
        server.settimeout(2)

        def serve():
            try:
                for _ in range(2):
                    connection, _ = server.accept()
                    with connection:
                        requests.append(wire.receive(connection, wire.MAX_REQUEST))
                        wire.send(connection, {"status": status})
            except Exception as error:
                errors.append(type(error).__name__)

        worker = threading.Thread(target=serve, daemon=True)
        worker.start()
        try:
            assert main(["agent-status", "known", "--socket", str(path), "--json"]) == {
                "passed": 0, "failed": 1, "not_checkable": 2}[status]
            assert json.loads(capsys.readouterr().out) == call_status(
                path, "truthlens_check_status", {"run_id": "known"}) == {"status": status}
        finally:
            worker.join(3)
        assert not worker.is_alive() and not errors
    assert requests == [{"version": 1, "run_id": "known"}] * 2


@pytest.mark.parametrize("mode,owner,kind,expected", [
    (0o660, 0, "socket", True), (0o666, 0, "socket", False),
    (0o600, 0, "socket", False), (0o660, 1001, "socket", False),
    (0o660, 0, "file", False), (0o660, 0, "symlink", False),
])
def test_doctor_socket_metadata_checks_do_not_certify_isolation(monkeypatch, mode, owner, kind, expected):
    import stat
    from types import SimpleNamespace
    from truthlens import status_wire as wire

    api = setup_module_api()
    kinds = {"socket": stat.S_IFSOCK, "file": stat.S_IFREG, "symlink": stat.S_IFLNK}
    monkeypatch.setattr(wire, "trusted_parent", lambda p: None)
    monkeypatch.setattr(Path, "lstat", lambda p: SimpleNamespace(st_uid=owner, st_mode=kinds[kind] | mode))
    assert api._socket_safe("/synthetic/status.sock") is expected


def test_demo_failure_is_fixed_and_never_prints_partial_success(monkeypatch, capsys):
    from truthlens import demo_status

    def broken(*args, **kw):
        raise OSError(PRIVATE)

    monkeypatch.setattr(demo_status.socket.socket, "bind", broken)
    assert main(["demo-status"]) == 2
    assert capsys.readouterr() == ("", "Demo unavailable.\n")


@pytest.mark.parametrize("client", CLIENTS)
def test_client_config_unicode_and_escaping_are_data(client):
    api = setup_module_api()
    path = '/run/é😀/slash\\quote".sock'
    text = api.render_config(client, path)
    assert api.valid_config(text, client, path)
    assert not api.valid_config(text.replace("mcp-status", "mcp"), client, path)
    assert not api.valid_config(text.replace("truthlens\"", "sh\""), client, path)


def test_doctor_does_not_write_bytecode_and_restores_flag(monkeypatch):
    api = setup_module_api()
    original = sys.dont_write_bytecode

    def check_import(name):
        assert sys.dont_write_bytecode is True
        raise ImportError(PRIVATE)

    monkeypatch.setattr(api.importlib, "import_module", check_import)
    assert api._adapter_importable() is False
    assert sys.dont_write_bytecode is original


@pytest.mark.parametrize("args", [["--help"], ["known", "--help", "--json"]])
def test_agent_status_help_cannot_expand_agent_output_vocabulary(args, capsys):
    assert main(["agent-status", *args]) == 2
    assert capsys.readouterr() == (
        '{"status":"not_checkable"}\n' if "--json" in args else "not_checkable\n", "")
