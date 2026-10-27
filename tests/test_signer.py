"""Local temporary-fixture boundary; no live key, account, service or container.

The test-only key location override keeps ALL writes in the repository's ignored
pytest basetemp. Production still uses the existing repository-rejecting reader.
"""

import io
import json
import os
import socket
import threading
from contextlib import contextmanager

import pytest

from truthlens import keys, signer
from truthlens.cli import main
from truthlens.ledger import Ledger, verify
from truthlens.signer_client import Client, SigningServer

CHECK_ANCESTRY = signer._check_ancestry


@pytest.fixture
def configured(tmp_path_factory, monkeypatch):
    tmp_path = tmp_path_factory.mktemp("s")
    monkeypatch.setattr(keys, "_check_location", lambda path: None)
    # This checkout has group-writable ancestors. No host chmod is authorized.
    monkeypatch.setattr(signer, "_check_ancestry", lambda path: None)
    private = tmp_path / "private"
    private.mkdir(mode=0o700)
    key = private / "hmac.key"
    # Fake test material only. Never show values in assertion failure output.
    key.write_bytes(b"sk-test-signer-hmac-material-only-123456789\n")
    key.chmod(0o600)
    token = private / "caller.token"
    token.write_bytes(b"sk-test-caller-token-material-only-123456789\n")
    token.chmod(0o600)
    doc = {
        "version": 1,
        "socket": str(tmp_path / "sock" / "s"),
        "socket_gid": os.getgid(),
        "run_root": str(tmp_path / "runs"),
        "key_file": str(key),
        "callers": {
            "agent-zero": {
                "harnesses": ["agent-zero"],
                "token_file": str(token),
                "runs_per_hour": 3,
                "events_per_run": 2,
                "bytes_per_run": 8192,
                "bytes_per_hour": 65536,
            }
        },
    }
    path = private / "config.json"

    def load():
        path.write_text(json.dumps(doc))
        path.chmod(0o600)
        return signer.Config.load(path)

    return doc, path, key, token, load


@contextmanager
def running(config):
    service = signer.Signer(config)
    stop, ready = threading.Event(), threading.Event()
    log = io.StringIO()
    thread = threading.Thread(
        target=signer.serve, args=(service,), kwargs={"stop": stop, "ready": ready, "audit": log}
    )
    thread.start()
    try:
        assert ready.wait(3), "temporary signer did not become ready"
        yield service, log
    finally:
        stop.set()
        thread.join(4)
        assert not thread.is_alive()
        service.close()


def wire(config, request):
    raw = request if isinstance(request, bytes) else json.dumps(request).encode() + b"\n"
    with socket.socket(socket.AF_UNIX) as conn:
        conn.settimeout(3)
        conn.connect(str(config.socket))
        conn.sendall(raw)
        with conn.makefile("rb") as stream:
            return json.loads(stream.readline(signer.MAX_MESSAGE + 1))


def test_socket_roundtrip_audit_and_tamper(configured, capsys):
    _doc, _, key, token, load = configured
    config = load()
    with running(config) as (service, log):
        client = Client(str(config.socket), str(token))
        start = client.call(
            "start_signed_run", {"harness": "agent-zero", "task": "test task", "criteria": ["c1"]}
        )
        ref = {"run_id": start["run_id"], "token": start["token"]}
        result = client.call(
            "append_signed_event",
            {
                **ref,
                "event": {
                    "type": "test.reported",
                    "actor": {"kind": "system"},
                    "passed": 42,
                    "failed": 0,
                },
            },
        )
        assert result["seq"] == 2
        assert client.call("signed_run_status", ref)["state"] == "open"
        assert (
            client.call("finish_signed_run", {**ref, "summary": "Agent claims success"})["state"]
            == "finished"
        )
        assert client.call("signed_run_status", ref)["state"] == "finished"
        run = config.run_root / start["run_id"]
        # Signed record verifies; agent-only completion is deliberately not_checkable.
        assert main(["audit", str(run), "--hmac-key-file", str(key), "--json"]) == 2
        report = json.loads(capsys.readouterr().out)
        assert report["authentication"] == "supported"
        assert report["integrity"] == "hmac"
        assert report["conclusion"] == "not_checkable"
        assert report["criteria"] == []  # supplied criteria do not become human criteria
        events = Ledger(run / "ledger.jsonl").read()
        assert [e["type"] for e in events] == ["run.started", "agent.note", "run.finished"]
        assert events[1]["actor"] == {"kind": "agent", "id": "agent-zero"}
        assert events[1]["payload"]["provenance"] == "agent-reported"
        assert events[1]["payload"]["harness"] == "agent-zero"
        assert verify(run / "ledger.jsonl", service.key).anchored
        with pytest.raises(ValueError, match="unavailable or rejected"):
            client.call("append_signed_event", {**ref, "event": {"note": "after close"}})
        raw = (run / "ledger.jsonl").read_bytes()
        (run / "ledger.jsonl").write_bytes(raw.replace(b"test task", b"evil task"))
        assert main(["audit", str(run), "--hmac-key-file", str(key), "--json"]) != 0
        bad = json.loads(capsys.readouterr().out)
        assert bad["authentication"] != "supported"
        assert bad["integrity"] == "failed"
        captured = capsys.readouterr()
        public = json.dumps([start, result, report, bad]) + log.getvalue() + captured.out + captured.err
        assert bool(key.read_bytes().strip().decode() not in public)
        assert bool(token.read_bytes().strip().decode() not in log.getvalue())
        assert bool(start["token"] not in log.getvalue())


def test_auth_scope_limits_and_bad_wire(configured):
    _, _, _, token, load = configured
    config = load()
    with running(config) as (_, log):
        req = {"op": "start_signed_run", "harness": "agent-zero", "task": "x"}
        assert wire(config, req)["error"] == "unauthorized"
        assert wire(config, {**req, "caller_token": "wrong"})["error"] == "unauthorized"
        req["caller_token"] = token.read_text().strip()
        assert wire(config, {**req, "harness": "mausbot"})["error"] == "invalid_request"
        start = wire(config, req)["result"]
        ref = {"run_id": start["run_id"], "token": start["token"], "caller_token": req["caller_token"]}
        assert wire(config, {**ref, "op": "status", "token": "wrong"})["error"] == "unauthorized"
        assert wire(config, {**ref, "op": "status", "run_id": "../../etc"})["error"] == "unauthorized"
        for kind in ["approval.granted", "criteria.confirmed"]:
            assert wire(config, {**ref, "op": "append_event", "event": {"type": kind}})["ok"]
        assert wire(config, {**ref, "op": "append_event", "event": {}})["error"] == "rate_limited"
        assert (
            wire(config, {**ref, "op": "finish_signed_run", "summary": "x" * 8192})["error"] == "rate_limited"
        )
        assert wire(config, req)["ok"]
        assert wire(config, req)["ok"]
        assert wire(config, req)["error"] == "rate_limited"
        assert wire(config, b"x" * (signer.MAX_MESSAGE + 1))["error"] == "message_too_large"
        for raw in [
            b'{"op":1,"op":2}\n',
            b"[]\n",
            b'{"n":NaN}\n',
            b'{"n":1.5}\n',
            b'{"x":' + b"[" * 1500 + b"0" + b"]" * 1500 + b"}\n",
        ]:
            assert wire(config, raw)["ok"] is False
        assert bool(req["caller_token"] not in log.getvalue())


def test_peer_credentials_and_caller_binding(configured):
    doc, _, _, token, load = configured
    entry = doc["callers"]["agent-zero"]
    entry["uid"], entry["gid"] = os.getuid(), os.getgid()
    config = load()
    service = signer.Signer(config)
    try:
        req = {"caller_token": token.read_text().strip()}
        assert service.authenticate(req, (os.getuid(), os.getgid())).name == "agent-zero"
        with pytest.raises(signer.SignerError, match="unauthorized"):
            service.authenticate(req, (os.getuid() + 1, os.getgid()))
        with pytest.raises(signer.SignerError, match="unauthorized"):
            service.authenticate(req, (os.getuid(), os.getgid() + 1))
        # Distinct caller sharing uid still cannot access the other's run.
        other = signer.Caller("mausbot", ["mausbot"], os.getuid(), None, None, 3, 2, 8192, 65536)
        config.callers.append(other)
        start = service.dispatch(
            {**req, "op": "start_signed_run", "harness": "agent-zero", "task": "x"},
            (os.getuid(), os.getgid()),
            100,
        )
        with pytest.raises(signer.SignerError, match="unauthorized"):
            service.dispatch({**start, "op": "status"}, (os.getuid(), os.getgid()), 100)
    finally:
        service.close()


@pytest.mark.parametrize(
    "mutation",
    [
        "unknown",
        "no_auth",
        "bad_limit",
        "bool_uid",
        "duplicate_token",
        "unsafe_config",
        "symlink_token",
        "bad_version",
        "relative",
    ],
)
def test_bad_configuration_fails_closed(configured, mutation):
    doc, path, _, token, load = configured
    entry = doc["callers"]["agent-zero"]
    if mutation == "unknown":
        doc["tcp"] = "0.0.0.0"
    elif mutation == "no_auth":
        del entry["token_file"]
    elif mutation == "bad_limit":
        entry["runs_per_hour"] = 0
    elif mutation == "bool_uid":
        entry["uid"] = True
    elif mutation == "duplicate_token":
        doc["callers"]["mausbot"] = dict(entry)
    elif mutation == "unsafe_config":
        load()
        path.chmod(0o644)
        with pytest.raises(ValueError):
            signer.Config.load(path)
        return
    elif mutation == "symlink_token":
        link = token.parent / "link"
        link.symlink_to(token)
        entry["token_file"] = str(link)
    elif mutation == "bad_version":
        doc["version"] = True
    elif mutation == "relative":
        doc["run_root"] = "relative"
    with pytest.raises((ValueError, RuntimeError)):
        load()


def test_hourly_bytes_lock_restart_and_safe_dirs(configured):
    doc, _, _, token, load = configured
    doc["callers"]["agent-zero"]["bytes_per_hour"] = 1024
    config = load()
    service = signer.Signer(config)
    peer = (os.getuid(), os.getgid())
    req = {
        "op": "start_signed_run",
        "harness": "agent-zero",
        "task": "x",
        "caller_token": token.read_text().strip(),
    }
    try:
        start = service.dispatch(req, peer, 100)
        with pytest.raises((OSError, ValueError)):
            signer.Signer(config)
        with pytest.raises(signer.SignerError, match="rate_limited"):
            service.dispatch(req, peer, 1025)
        config.callers[0].traffic.clear()
        config.callers[0].starts.clear()
    finally:
        service.close()
    service = signer.Signer(config)
    try:
        with pytest.raises(signer.SignerError, match="unauthorized"):
            service.dispatch({**start, "op": "status", "caller_token": req["caller_token"]}, peer, 100)
    finally:
        service.close()
    config.run_root.chmod(0o755)
    with pytest.raises(signer.SignerError, match="unsafe_directory"):
        signer.Signer(config)


def test_cli_error_never_reflects_key_or_exception(configured, monkeypatch, capsys):
    _, path, key, _, load = configured
    load()
    secret = key.read_bytes().strip().decode()

    def fail(*args):
        raise RuntimeError(secret)

    monkeypatch.setattr(signer, "read_key_file", fail)
    assert main(["signer", "serve", "--config", str(path)]) == 2
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == "error: signer unavailable\n"
    assert bool(secret not in captured.err)


def test_mcp_fake_socket_and_cli_opt_in(configured, monkeypatch):
    from truthlens.mcp import Server
    from truthlens.signer_client import TOOLS

    config = configured[-1]()
    token = configured[3]
    received = []
    ready = threading.Event()

    def fake():
        config.socket.parent.mkdir(mode=0o750)
        with socket.socket(socket.AF_UNIX) as listener:
            listener.bind(str(config.socket))
            listener.listen()
            ready.set()
            for index in range(5):
                conn, _ = listener.accept()
                with conn, conn.makefile("rb") as stream:
                    received.append(json.loads(stream.readline()))
                    response = {"ok": True, "result": {"fake": index}}
                    conn.sendall(json.dumps(response).encode() + b"\n")

    thread = threading.Thread(target=fake)
    thread.start()
    assert ready.wait(3)
    try:
        adapter = SigningServer(Server(str(config.run_root)), Client(str(config.socket), str(token)))
        listed = adapter.handle({"id": 1, "method": "tools/list"})["result"]["tools"]
        assert {t["name"] for t in listed} == {"list_runs", "run_report", "run_events"} | {
            t["name"] for t in TOOLS
        }
        inputs = {
            "start_signed_run": {"harness": "agent-zero", "task": "x"},
            "append_signed_event": {"run_id": "r", "token": "t", "event": {}},
            "finish_signed_run": {"run_id": "r", "token": "t", "summary": "x"},
            "signed_run_status": {"run_id": "r", "token": "t"},
        }
        for name, args in inputs.items():
            response = adapter.handle(
                {"id": 2, "method": "tools/call", "params": {"name": name, "arguments": args}}
            )
            assert response["result"]["isError"] is False
        monkeypatch.setenv("TRUTHLENS_SIGNER_SOCKET", str(config.socket))
        monkeypatch.setenv("TRUTHLENS_SIGNER_TOKEN_FILE", str(token))
        monkeypatch.setenv("TRUTHLENS_HMAC_KEY_FILE", "/must/not/be/read")
        monkeypatch.delenv("TRUTHLENS_ROOT", raising=False)
        inp, out = (
            io.StringIO(
                json.dumps(
                    {
                        "id": 3,
                        "method": "tools/call",
                        "params": {"name": "start_signed_run", "arguments": inputs["start_signed_run"]},
                    }
                )
                + "\n"
            ),
            io.StringIO(),
        )
        monkeypatch.setattr("sys.stdin", inp)
        monkeypatch.setattr("sys.stdout", out)
        assert main(["mcp"]) == 0
        assert json.loads(out.getvalue())["result"]["isError"] is False
    finally:
        thread.join(4)
    assert not thread.is_alive()
    assert [req["op"] for req in received] == [
        "start_signed_run",
        "append_event",
        "finish_signed_run",
        "status",
        "start_signed_run",
    ]
    assert bool(all(req["caller_token"] == token.read_text().strip() for req in received))


def test_client_unavailable_fixed_error(configured):
    config = configured[-1]()
    with pytest.raises(ValueError, match="^signer request unavailable or rejected$"):
        Client(str(config.socket)).call("start_signed_run", {"harness": "agent-zero", "task": "x"})


@pytest.mark.parametrize(
    "owner,mode,denied",
    [
        (0, 0o755, False),
        (os.geteuid(), 0o700, False),
        (os.geteuid() + 1, 0o755, True),
        (os.geteuid(), 0o775, True),
        (0, 0o1777, False),
    ],
)
def test_ancestry_policy(owner, mode, denied, monkeypatch):
    from pathlib import Path
    from types import SimpleNamespace

    monkeypatch.setattr(Path, "stat", lambda path: SimpleNamespace(st_uid=owner, st_mode=mode))
    if denied:
        with pytest.raises(signer.SignerError, match="unsafe_directory"):
            CHECK_ANCESTRY(Path("/protected/run"))
    else:
        CHECK_ANCESTRY(Path("/protected/run"))


def test_uid_only_over_real_socket(configured):
    doc, _, _, _, load = configured
    entry = doc["callers"]["agent-zero"]
    del entry["token_file"]
    entry["uid"] = os.getuid()
    config = load()
    with running(config):
        assert wire(config, {"op": "start_signed_run", "harness": "agent-zero", "task": "x"})["ok"]
        config.callers[0].uid += 1
        assert (
            wire(config, {"op": "start_signed_run", "harness": "agent-zero", "task": "x"})["error"]
            == "unauthorized"
        )


def test_failed_write_closes_run_without_exception_leak(configured, monkeypatch):
    _, _, key, token, load = configured
    config = load()
    with running(config) as (service, log):
        client = Client(str(config.socket), str(token))
        start = client.call("start_signed_run", {"harness": "agent-zero", "task": "x"})
        ref = {"run_id": start["run_id"], "token": start["token"]}
        secret = key.read_bytes().strip().decode()

        def fail(*args, **kwargs):
            raise OSError(secret)

        monkeypatch.setattr(service.runs[start["run_id"]].ledger, "append", fail)
        raw = wire(
            config, {**ref, "op": "append_event", "event": {}, "caller_token": token.read_text().strip()}
        )
        assert raw == {"ok": False, "error": "request_failed"}
        assert client.call("signed_run_status", ref)["state"] == "failed"
        assert bool(secret not in log.getvalue())


def test_relative_private_path_gets_full_ancestry_check(configured, monkeypatch):
    _, path, _, _, load = configured
    load()
    seen = []
    monkeypatch.chdir(path.parent)
    monkeypatch.setattr(signer, "_check_ancestry", seen.append)
    signer.private_file(path.__class__(path.name), signer.MAX_MESSAGE)
    assert seen == [path]


def test_authenticated_invalid_operations_consume_quota(configured):
    _, _, _, token, load = configured
    config = load()
    service = signer.Signer(config)
    try:
        peer = (os.getuid(), os.getgid())
        req = {"caller_token": token.read_text().strip(), "op": "unknown"}
        with pytest.raises(signer.SignerError, match="invalid_request"):
            service.dispatch(req, peer, 100)
        assert sum(size for _, size in config.callers[0].traffic) == 100
    finally:
        service.close()


def test_directory_rejects_symlink_before_creating_child(configured):
    _, path, _, _, _ = configured
    root = path.parent
    link = root / "link"
    link.symlink_to(root, target_is_directory=True)
    with pytest.raises(RuntimeError):
        signer.directory(link / "unwanted", 0o700)
    assert not (root / "unwanted").exists()
