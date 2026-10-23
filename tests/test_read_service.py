"""Synthetic Unix transport tests; no live service or separate-UID claim."""

from __future__ import annotations

import json
import os
import socket
import threading
from dataclasses import replace
from pathlib import Path

import pytest

from truthlens import read_service
from truthlens.registry import RegistryError


class Projection:
    source_id = "fixed-source"

    def catalog(self, *, offset=0, limit=50):
        return {"source_id": self.source_id, "runs": [], "next_offset": None}

    def document(self, run_id):
        if run_id != "allowed":
            raise RegistryError("private host path must never escape")
        return {"source_id": self.source_id, "document": {"run_id": run_id}}

    def events(self, run_id, *, after_seq=0, limit=100):
        if run_id != "allowed":
            raise RegistryError("private host path must never escape")
        return {"source_id": self.source_id, "events": [{"seq": after_seq + 1}], "total": 3}


@pytest.fixture
def config(tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text('<script src="/assets/app.js"></script>')
    (dist / "assets").mkdir()
    (dist / "assets" / "app.js").write_text("console.log('local');")
    return read_service.ReaderConfig(
        state_root=tmp_path / "state",
        socket_path=tmp_path / "reader.sock",
        viewer_dist=dist,
        origin="http://127.0.0.1:8765",
        forwarder_uid=os.getuid(),
        view_id="shu",
    )


@pytest.fixture
def server(config, monkeypatch):
    # Only host ownership validation is replaced: temp fixtures are not a deployment.
    monkeypatch.setattr(read_service, "validate_paths", lambda config: None)
    monkeypatch.setattr(read_service, "ROOT_UID", os.getuid())
    instance = read_service.ReadServer(config, Projection())
    worker = threading.Thread(target=instance.serve_forever, kwargs={"poll_interval": 0.01})
    worker.start()
    yield instance
    instance.shutdown()
    worker.join(timeout=2)
    instance.server_close()


def request(server, target="/v1/health", *, method="GET", headers=None, raw=None):
    with socket.socket(socket.AF_UNIX) as client:
        client.settimeout(2)
        client.connect(str(server.config.socket_path))
        if raw is None:
            fields = {"Host": "127.0.0.1:8765", **(headers or {})}
            raw = (
                f"{method} {target} HTTP/1.1\r\n".encode()
                + b"".join(f"{key}: {value}\r\n".encode() for key, value in fields.items())
                + b"\r\n"
            )
        try:
            client.sendall(raw)
        except (BrokenPipeError, ConnectionResetError):
            return None, {}, b""
        result = bytearray()
        while True:
            try:
                block = client.recv(65536)
            except ConnectionResetError:
                break
            if not block:
                break
            result.extend(block)
    if not result:
        return None, {}, b""
    head, body = bytes(result).split(b"\r\n\r\n", 1)
    lines = head.decode().split("\r\n")
    return int(lines[0].split()[1]), dict(line.split(": ", 1) for line in lines[1:]), body


def test_same_origin_health_and_head_have_privacy_headers(server):
    status, headers, body = request(server)
    assert status == 200
    assert json.loads(body) == {"source_id": "fixed-source", "service": "available"}
    assert headers["Cache-Control"] == "no-store"
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["Referrer-Policy"] == "no-referrer"
    assert "script-src 'self'" in headers["Content-Security-Policy"]
    assert not any(key.lower().startswith("access-control-") for key in headers)
    assert request(server, method="HEAD")[2] == b""


@pytest.mark.parametrize(
    "headers",
    [
        {"Host": "localhost:8765"},
        {"Host": "evil.example"},
        {"Origin": "http://evil.example"},
        {"Origin": "null"},
        {"Sec-Fetch-Site": "cross-site"},
        {"Sec-Fetch-Site": "same-site"},
        {"Sec-Fetch-Mode": "no-cors"},
    ],
)
def test_foreign_browser_context_is_denied(server, headers):
    assert request(server, headers=headers)[0] == 403


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "CONNECT", "TRACE"])
def test_all_non_read_methods_are_denied(server, method):
    assert request(server, method=method)[0] == 405


@pytest.mark.parametrize(
    "target",
    [
        "http://127.0.0.1:8765/v1/health",
        "/../secret",
        "/assets/../index.html",
        "/assets/%2e%2e/secret",
        "//v1/health",
        "/v1/runs?uid=0",
        "/v1/runs?limit=51",
        "/v1/runs?limit=0",
        "/v1/runs?offset=-1",
        "/v1/runs?limit=1&limit=2",
        "/v1/runs/allowed/events?limit=101",
        "/v1/runs/allowed/events?after_seq=-1",
    ],
)
def test_invalid_paths_and_parameters_fail_closed(server, target):
    assert request(server, target)[0] == 400


def test_routes_preserve_projection_and_generic_authorization_error(server):
    assert json.loads(request(server, "/v1/runs")[2])["runs"] == []
    assert json.loads(request(server, "/v1/runs/allowed/document")[2])["document"] == {"run_id": "allowed"}
    assert json.loads(request(server, "/v1/runs/allowed/events?after_seq=2&limit=1")[2])["events"] == [
        {"seq": 3}
    ]
    assert request(server, "/v1/runs/foreign/document") == (
        403,
        request(server, "/v1/runs/foreign/document")[1],
        b'{"error":"unavailable"}',
    )


def test_request_limits_and_duplicate_host(server):
    assert (
        request(server, raw=b"GET /v1/health HTTP/1.1\r\nHost: 127.0.0.1:8765\r\nHost: evil\r\n\r\n")[0]
        == 400
    )
    assert request(server, raw=b"GET /v1/health HTTP/1.1\r\nX: " + b"x" * 17000 + b"\r\n\r\n")[0] == 431
    assert request(server, headers={"Content-Length": "1"})[0] == 400
    assert request(server, headers={"Transfer-Encoding": "chunked"})[0] == 400


def test_exact_peer_uid_rejects_connection_before_http_parsing(server):
    # Change the server's protected identity in this synthetic fixture only;
    # the real kernel still reports this process's actual uid on the connection.
    server.config = replace(server.config, forwarder_uid=os.getuid() + 1)
    assert request(server, raw=b"not even an HTTP request")[0] is None
    server.config = replace(server.config, forwarder_uid=0)
    assert request(server, raw=b"not even an HTTP request")[0] is None


def test_static_serves_only_production_files_and_rejects_symlinks(server, config):
    assert request(server, "/")[0] == 200
    assert request(server, "/assets/app.js")[2] == b"console.log('local');"
    (config.viewer_dist / "assets" / "leak.js").symlink_to(config.viewer_dist / "index.html")
    (config.viewer_dist / "assets" / "private.json").write_text('{"private":true}')
    assert request(server, "/assets/leak.js")[0] == 404
    assert request(server, "/assets/private.json")[0] == 404


def test_stale_socket_is_never_unlinked(config, monkeypatch):
    monkeypatch.setattr(read_service, "validate_paths", lambda config: None)
    config.socket_path.write_bytes(b"existing file")
    with pytest.raises((OSError, ValueError)):
        read_service.ReadServer(config, Projection())
    assert config.socket_path.read_bytes() == b"existing file"


def test_config_rejects_unsafe_origin_ids_and_unknown_fields(config, tmp_path, monkeypatch):
    monkeypatch.setattr(read_service, "validate_paths", lambda config: None)
    for change in (
        {"origin": "http://0.0.0.0:8765"},
        {"origin": "http://127.0.0.1:8765/"},
        {"forwarder_uid": True},
        {"view_id": "../foreign"},
        {"socket_path": Path("relative")},
    ):
        with pytest.raises(ValueError):
            replace(config, **change).validate()
    path = tmp_path / "config.json"
    path.write_text('{"unknown":true}')
    monkeypatch.setattr(read_service, "trusted", lambda *a, **kw: None)
    with pytest.raises(ValueError):
        read_service.load_config(path)


def test_production_paths_reject_untrusted_temp_ancestry(config):
    with pytest.raises((RegistryError, OSError, ValueError)):
        read_service.validate_paths(config)


def test_response_limit_never_returns_partial_success(server, monkeypatch):
    monkeypatch.setattr(read_service, "MAX_RESPONSE", 128)
    server.projection.document = lambda run_id: {"document": "x" * 256}
    status, _, body = request(server, "/v1/runs/allowed/document")
    assert status == 413
    assert json.loads(body) == {"error": "response_too_large"}


def test_socket_lifecycle_is_private_and_preserves_replacement(server):
    path = server.config.socket_path
    assert path.stat().st_mode & 0o777 == 0o600
    path.unlink()
    path.write_bytes(b"replacement")
    server.server_close()
    assert path.read_bytes() == b"replacement"


def test_static_browser_loads_allow_only_same_origin_no_cors(server):
    headers = {"Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "no-cors"}
    assert request(server, "/assets/app.js", headers=headers)[0] == 200
    assert request(server, "/v1/health", headers=headers)[0] == 403
    assert request(server, "/assets/app.js", headers={"Sec-Fetch-Mode": "no-cors"})[0] == 403


def test_slow_drip_has_total_header_deadline(server, monkeypatch):
    import time

    monkeypatch.setattr(read_service, "REQUEST_TIMEOUT", 0.06)
    with socket.socket(socket.AF_UNIX) as client:
        client.settimeout(1)
        client.connect(str(server.config.socket_path))
        started = time.monotonic()
        for _ in range(30):
            try:
                client.sendall(b"G")
            except (BrokenPipeError, ConnectionResetError):
                break
            time.sleep(0.01)
        elapsed = time.monotonic() - started
        assert elapsed < 0.25


def test_public_brand_asset_works_without_arbitrary_root_file_access(server, config):
    (config.viewer_dist / "logo-icon.svg").write_bytes(b"<svg></svg>")
    (config.viewer_dist / "secret.js").write_bytes(b"private")
    assert request(server, "/logo-icon.svg")[2] == b"<svg></svg>"
    assert request(server, "/secret.js")[0] == 404


def test_static_size_limit_and_directory_link_fail_closed(server, config, tmp_path, monkeypatch):
    monkeypatch.setattr(read_service, "MAX_RESPONSE", 64)
    (config.viewer_dist / "assets" / "big.js").write_bytes(b"x" * 65)
    assert request(server, "/assets/big.js")[0] == 413
    (config.viewer_dist / "assets" / "app.js").unlink()
    (config.viewer_dist / "assets" / "big.js").unlink()
    (config.viewer_dist / "assets").rmdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "app.js").write_bytes(b"outside")
    (config.viewer_dist / "assets").symlink_to(outside, target_is_directory=True)
    assert request(server, "/assets/app.js")[0] == 404


def test_config_file_symlink_and_duplicate_keys_are_denied(config, tmp_path, monkeypatch):
    monkeypatch.setattr(read_service, "trusted", lambda *a, **kw: None)
    monkeypatch.setattr(read_service, "validate_paths", lambda config: None)
    values = {key: str(value) if isinstance(value, Path) else value for key, value in vars(config).items()}
    path = tmp_path / "config.json"
    path.write_text(json.dumps(values))
    assert read_service.load_config(path) == config
    link = tmp_path / "link.json"
    link.symlink_to(path)
    with pytest.raises(OSError):
        read_service.load_config(link)
    path.write_text('{"view_id":"one","view_id":"two"}')
    with pytest.raises(ValueError):
        read_service.load_config(path)


def test_spa_navigation_query_serves_same_index_without_selecting_server_paths(server):
    index = request(server, "/")[2]
    for target in (
        "/?source=" + "a" * 64 + "&run=run_registered&view=overview",
        "/?view=timeline",
        "/?source=local%3Aold&run=run_old&view=overview&tab=old",
    ):
        status, _, body = request(server, target)
        assert status == 200 and body == index
    for target in (
        "/?path=/etc/passwd",
        "/?source=a&source=b",
        "/?run=%00",
        "/assets/app.js?run=run_registered",
    ):
        assert request(server, target)[0] == 400


def test_real_registered_projection_crosses_http_without_mutating_state(server, tmp_path, monkeypatch):
    from tests.audit_support import RUN_ID, digest_tree, make_run
    from truthlens import registry
    from truthlens.read_projection import ReadProjection

    # Root ownership is synthetic here; actual snapshot, journal, digests and
    # projection logic run against real fixture bytes, under this single uid.
    monkeypatch.setattr(registry, "require_root", lambda: None)
    monkeypatch.setattr(registry, "trusted", lambda *a, **kw: None)
    state = tmp_path / "state"
    state.mkdir()
    store = registry.Registry(state)
    dispatch = store.dispatch("agent-zero", os.getuid(), "Shu", [os.getuid()], "a" * 64)
    root = make_run(state / "snapshots" / dispatch["dispatch_id"], key=None)
    manifest = json.loads((root / "manifest.json").read_bytes())
    store.append(
        "captured",
        {
            "dispatch_id": dispatch["dispatch_id"],
            "snapshot_id": dispatch["dispatch_id"],
            "run_id": RUN_ID,
            "registration_id": "b" * 32,
            "ledger_last_hash": manifest["ledger_last_hash"],
            "capture_closed_at": "2026-10-23T00:00:00+00:00",
            "input_digests": digest_tree(root),
        },
    )
    server.config = replace(server.config, state_root=state)
    server.projection = ReadProjection(store, uid=server.config.forwarder_uid, view_id=server.config.view_id)
    before = digest_tree(state)
    catalog = json.loads(request(server, "/v1/runs")[2])
    assert catalog["runs"][0]["run_id"] == RUN_ID
    status, _, raw = request(server, f"/v1/runs/{RUN_ID}/document")
    document = json.loads(raw)
    assert status == 200
    assert document["source_id"] == catalog["runs"][0]["source_id"]
    assert document["document"]["verified"] is False
    assert document["document"]["integrity"] == "hash-only"
    page = json.loads(request(server, f"/v1/runs/{RUN_ID}/events?after_seq=2&limit=1")[2])
    assert [event["seq"] for event in page["events"]] == [3]
    assert digest_tree(state) == before


def test_request_workers_allow_two_active_reads_and_never_exceed_two(server):
    from concurrent.futures import ThreadPoolExecutor

    lock = threading.Lock()
    entered = threading.Event()
    release = threading.Event()
    active = 0
    peak = 0

    def document(run_id):
        nonlocal active, peak
        with lock:
            active += 1
            peak = max(peak, active)
            if active == 2:
                entered.set()
        try:
            assert release.wait(2)
            return {"document": run_id}
        finally:
            with lock:
                active -= 1

    server.projection.document = document
    with ThreadPoolExecutor(max_workers=6) as clients:
        futures = [clients.submit(request, server, "/v1/runs/allowed/document") for _ in range(6)]
        try:
            assert entered.wait(0.5), "two independent reads must progress concurrently"
        finally:
            release.set()
        assert [future.result()[0] for future in futures] == [200] * 6
    assert peak == 2


def test_parallel_asset_connections_queue_while_two_workers_are_busy(server):
    from concurrent.futures import ThreadPoolExecutor

    entered = threading.Barrier(3)
    release = threading.Event()

    def document(run_id):
        entered.wait(timeout=1)
        assert release.wait(2)
        return {"document": run_id}

    server.projection.document = document
    pending = []
    with ThreadPoolExecutor(max_workers=2) as clients:
        futures = [clients.submit(request, server, "/v1/runs/allowed/document") for _ in range(2)]
        try:
            entered.wait(timeout=0.5)
            for _ in range(8):
                client = socket.socket(socket.AF_UNIX)
                pending.append(client)
                client.settimeout(0.5)
                client.connect(str(server.config.socket_path))
                client.sendall(b"GET /assets/app.js HTTP/1.1\r\nHost: 127.0.0.1:8765\r\n\r\n")
        finally:
            release.set()
        try:
            assert [future.result()[0] for future in futures] == [200, 200]
            for client in pending:
                client.settimeout(2)
                response = bytearray()
                while block := client.recv(65536):
                    response.extend(block)
                assert bytes(response).startswith(b"HTTP/1.1 200 ")
                assert bytes(response).endswith(b"console.log('local');")
        finally:
            for client in pending:
                client.close()


def test_cli_sigterm_closes_its_own_temporary_socket(config):
    import subprocess
    import sys
    import time

    config.state_root.mkdir()
    script = """
import os, sys
from pathlib import Path
from truthlens import registry, read_service
registry.require_root = lambda: None
registry.trusted = lambda *args, **kwargs: None
read_service.validate_paths = lambda config: None
read_service.ROOT_UID = os.getuid()
config = read_service.ReaderConfig(
    state_root=Path(sys.argv[1]), socket_path=Path(sys.argv[2]),
    viewer_dist=Path(sys.argv[3]), origin='http://127.0.0.1:8765',
    forwarder_uid=os.getuid(), view_id='synthetic-signal-test',
)
read_service.load_config = lambda path: config
raise SystemExit(read_service.main(['--config', 'synthetic-only']))
"""
    process = subprocess.Popen(
        [
            sys.executable,
            "-c",
            script,
            str(config.state_root),
            str(config.socket_path),
            str(config.viewer_dist),
        ],
        env={**os.environ, "PYTHONPATH": str(Path(__file__).resolve().parents[1] / "src")},
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        deadline = time.monotonic() + 2
        while not config.socket_path.exists() and process.poll() is None and time.monotonic() < deadline:
            time.sleep(0.01)
        assert config.socket_path.exists(), "synthetic child failed to create its temporary socket"
        process.terminate()
        _, stderr = process.communicate(timeout=5)
        assert process.returncode == 0, stderr.decode()
        assert not config.socket_path.exists()
    finally:
        if process.poll() is None:
            process.kill()
            process.communicate(timeout=2)
