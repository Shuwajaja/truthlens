"""D34 fixture boundary: no host users, real registry, keys or activation."""

import hashlib
import json
import os
import socket
import threading
from dataclasses import replace

import pytest

from tests.audit_support import RUN_ID, digest_tree, make_run
from truthlens import read_projection, read_service, registry


@pytest.fixture
def published(tmp_path, monkeypatch):
    root = tmp_path / "published"
    snapshot = make_run(root / "snapshots" / ("a" * 32), key=None)
    report = b'{"authentication":"supported","conclusion":"supported_within_scope"}'
    sha = hashlib.sha256(report).hexdigest()
    (root / "audits").mkdir()
    (root / "audits" / f"{sha}.json").write_bytes(report)
    row = {
        "view_id": "shu", "run_id": RUN_ID, "dispatch_id": "a" * 32,
        "snapshot_id": "a" * 32, "session_id": "c" * 32, "registration_id": "b" * 32,
        "ledger_last_hash": json.loads((snapshot / "manifest.json").read_bytes())["ledger_last_hash"],
        "capture_closed_at": "2026-10-25T00:00:00Z", "input_digests": digest_tree(snapshot),
        "audit": {"sha256": sha},
    }
    (root / "read-index.json").write_text(json.dumps({"version": 1, "runs": [row]}))
    monkeypatch.setattr(read_projection, "published_trusted", lambda *a, **kw: None, raising=False)
    return root, snapshot, row


def reader(published):
    return read_projection.PublishedReadProjection(published[0], view_id="shu")


def test_unprivileged_published_reads_never_touch_root_registry_or_keys(published, monkeypatch):
    from truthlens import audit_inputs, pipeline

    def forbidden(*a, **kw):
        pytest.fail("privileged operation during read")

    monkeypatch.setattr(registry, "require_root", forbidden)
    monkeypatch.setattr(registry.Registry, "__init__", forbidden)
    monkeypatch.setattr(pipeline, "check_snapshot", forbidden)
    monkeypatch.setattr(audit_inputs, "read_audit_key", forbidden)
    before = digest_tree(published[0])
    p = reader(published)
    assert p.catalog()["runs"][0]["run_id"] == RUN_ID
    assert p.document(RUN_ID)["document"]["integrity"] == "hash-only"
    assert len(p.events(RUN_ID)["events"]) == 6
    assert p.artifacts(RUN_ID)["artifacts"] == []
    sha = next(iter(p.blobs(RUN_ID)["blobs"]))
    assert p.blob(RUN_ID, sha)
    assert p.audits(RUN_ID)["audit"]["conclusion"] == "supported_within_scope"
    assert digest_tree(published[0]) == before


def test_fixed_view_and_unregistered_run_are_indistinguishable(published):
    root, _, row = published
    row["view_id"] = "foreign"
    (root / "read-index.json").write_text(json.dumps({"version": 1, "runs": [row]}))
    p = reader(published)
    assert p.catalog()["runs"] == []
    for run_id in (RUN_ID, "missing"):
        for method in (p.document, p.events, p.artifacts, p.blobs, p.audits):
            with pytest.raises(registry.RegistryError, match="Pipeline unavailable or access denied"):
                method(run_id)


@pytest.mark.parametrize("attack", ["traversal", "symlink", "digest", "oversize", "hardlink"])
def test_published_blob_reads_fail_closed(published, monkeypatch, attack):
    _, snapshot, row = published
    p = reader(published)
    sha = next(iter(p.blobs(RUN_ID)["blobs"]))
    path = snapshot / "blobs" / sha
    if attack == "traversal":
        sha = "../ledger.jsonl"
    elif attack == "symlink":
        path.unlink()
        path.symlink_to(snapshot / "ledger.jsonl")
    elif attack == "digest":
        path.write_bytes(b"tampered")
    elif attack == "oversize":
        monkeypatch.setattr(read_projection, "MAX_BLOB_BYTES", 1)
    else:
        os.link(path, snapshot / "second-link")
    with pytest.raises(registry.RegistryError):
        p.blob(RUN_ID, sha)
    assert row["run_id"] == RUN_ID


@pytest.mark.parametrize("name", ["ledger.jsonl", "manifest.json", "read-index.json", "audit"])
def test_published_tampered_inputs_are_denied(published, name):
    root, snapshot, row = published
    path = root / "read-index.json" if name == "read-index.json" else snapshot / name
    if name == "audit":
        path = root / "audits" / (row["audit"]["sha256"] + ".json")
    path.write_bytes(b"{}")
    with pytest.raises(registry.RegistryError):
        reader(published).audits(RUN_ID)


def test_loopback_config_rejects_other_hosts_ports_and_request_views(tmp_path, monkeypatch):
    monkeypatch.setattr(read_service, "validate_loopback_paths", lambda c: None, raising=False)
    config = read_service.LoopbackConfig(tmp_path, tmp_path, "shu")
    config.validate()
    for origin in ("http://0.0.0.0:8765", "http://localhost:8765", "http://127.0.0.1:8766"):
        with pytest.raises(ValueError):
            replace(config, origin=origin).validate()


@pytest.fixture
def loopback(published, tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("Not connected")
    monkeypatch.setattr(read_service, "validate_loopback_paths", lambda c: None, raising=False)
    config = read_service.LoopbackConfig(published[0], dist, "shu")
    server = read_service.LoopbackReadServer(config, reader(published))
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01})
    thread.start()
    yield server
    server.shutdown()
    thread.join(2)
    server.server_close()


def request(server, target, method="GET", headers=None):
    with socket.create_connection(server.server_address, timeout=2) as client:
        fields = {"Host": "127.0.0.1:8765", **(headers or {})}
        client.sendall((f"{method} {target} HTTP/1.1\r\n" + "".join(
            f"{k}: {v}\r\n" for k, v in fields.items()) + "\r\n").encode())
        result = b""
        while block := client.recv(65536):
            result += block
    head, body = result.split(b"\r\n\r\n", 1)
    return int(head.split()[1]), head, body


def test_loopback_routes_headers_and_fixed_identity(loopback):
    assert loopback.server_address == ("127.0.0.1", 8765)
    for suffix in ("document", "events", "artifacts", "blobs", "audits"):
        path = f"/v1/runs/{RUN_ID}/{suffix}"
        status, head, body = request(loopback, path, headers={"X-View-Id": "foreign", "X-Uid": "0"})
        assert status == 200, body
        assert b"Cache-Control: no-store" in head
        assert b"X-Content-Type-Options: nosniff" in head
        assert b"Content-Security-Policy:" in head
        assert request(loopback, path, method="HEAD")[2] == b""
        assert request(loopback, path.replace(RUN_ID, "foreign"))[2] == b'{"error":"unavailable"}'
    assert request(loopback, "/v1/runs?limit=51")[0] == 400
    assert request(loopback, f"/v1/runs/{RUN_ID}/events?limit=101")[0] == 400
    assert request(loopback, "/v1/runs?view_id=foreign")[0] == 400


@pytest.mark.parametrize("method", ["POST", "PUT", "DELETE", "PATCH", "OPTIONS", "TRACE", "CONNECT"])
def test_loopback_rejects_writes(loopback, method):
    assert request(loopback, "/v1/health", method=method)[0] == 405


@pytest.mark.parametrize("headers", [{"Host": "evil"}, {"Origin": "null"}, {"Origin": "https://evil"}])
def test_loopback_rejects_foreign_context(loopback, headers):
    assert request(loopback, "/v1/health", headers=headers)[0] == 403
