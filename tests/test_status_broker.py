"""G1: synthetic protected registry plus real temporary Unix sockets, no host isolation claim."""

import copy
import os
import socket
import struct
import threading
from dataclasses import replace

import pytest

from truthlens import pipeline, registry

pytest_plugins = ("tests.test_registry",)
UNKNOWN = {"status": "not_checkable"}


def modules():
    from truthlens import status_broker, status_client, status_wire

    return status_broker, status_client, status_wire


@pytest.fixture
def completed(captured):
    store, dispatch, capture = captured
    job = store.queue(capture["run_id"], 1234)
    report = pipeline.check_snapshot(store, {**dispatch, **capture})
    reference = store.save_report(job["audit_id"], report)
    store.append("completed", {**job, **reference})
    return store, dispatch, capture, report, job


def query(completed, uid=1234, run_id=None):
    broker, _, _ = modules()
    store, _, capture, _, _ = completed
    return broker.registered_status(store, run_id or capture["run_id"], uid)


def store_report(completed, report):
    store, _, _, _, job = completed
    reference = store.save_report(job["audit_id"], report)
    store.append("completed", {**job, **reference})


def test_registered_signed_closed_audit_reuses_projection_without_writes(completed, monkeypatch):
    from truthlens import status_projection

    calls = []
    original = status_projection.project_status

    def project(*args, **kw):
        calls.append(kw)
        return original(*args, **kw)

    monkeypatch.setattr(status_projection, "project_status", project)
    store, _, capture, _, _ = completed
    before = store.records()

    def forbidden(*args, **kwargs):
        pytest.fail("status query attempted verification, key access or mutation")

    for name in ("check_snapshot", "audit_run", "read_audit_key"):
        monkeypatch.setattr(pipeline, name, forbidden)
    for name in ("queue", "append", "save_report", "dispatch"):
        monkeypatch.setattr(store, name, forbidden)
    assert query(completed) == {"status": "passed"}
    assert calls and calls[0]["run_id"] == capture["run_id"]
    assert store.records() == before


@pytest.mark.parametrize("conclusion", ["supported_within_scope", "contradictory"])
@pytest.mark.parametrize("attack", ["hash_only", "unsigned", "verified_false", "verified_int", "wrong_run", "wrong_anchor", "wrong_digest", "verifier", "ruleset", "open", "missing_digest"])
def test_untrusted_or_misbound_audit_never_passes_or_fails(completed, attack, conclusion):
    report = copy.deepcopy(completed[3])
    report["conclusion"] = conclusion
    if conclusion == "contradictory":
        report["checks"][0]["outcome"] = "contradictory"
    if attack == "hash_only":
        report["integrity"] = "hash-only"
    elif attack == "unsigned":
        report["authentication"] = "not_checkable"
    elif attack == "verified_false":
        report["verified"] = False
    elif attack == "verified_int":
        report["verified"] = 1
    elif attack == "wrong_run":
        report["run_id"] = "foreign"
    elif attack == "wrong_anchor":
        report["ledger_last_hash"] = "0" * 64
    elif attack == "wrong_digest":
        report["input_digests"]["run"]["manifest.json"] = "0" * 64
    elif attack == "missing_digest":
        del report["input_digests"]["run"]["manifest.json"]
    elif attack == "verifier":
        report["input_digests"]["verifier"] = {}
    elif attack == "ruleset":
        report["ruleset_version"] = "foreign"
    else:
        report["state"] = "running"
    store_report(completed, report)
    assert query(completed) == UNKNOWN


def test_authenticated_contradiction_is_failed(completed):
    report = copy.deepcopy(completed[3])
    report["checks"][0]["outcome"] = "contradictory"
    report["conclusion"] = "contradictory"
    store_report(completed, report)
    assert query(completed) == {"status": "failed"}


@pytest.mark.parametrize("state", ["queued", "running", "failed", "interrupted"])
def test_noncompleted_latest_job_invalidates_previous_green(completed, state):
    completed[0].append(state, completed[4])
    assert query(completed) == UNKNOWN


def test_foreign_unknown_and_unregistered_runs_are_indistinguishable(completed):
    assert query(completed, uid=5678) == UNKNOWN
    assert query(completed, run_id="unknown") == UNKNOWN
    assert query(completed, run_id="../../key") == UNKNOWN


def test_missing_audit_is_unknown(captured):
    broker, _, _ = modules()
    store, _, capture = captured
    assert broker.registered_status(store, capture["run_id"], 1234) == UNKNOWN


@pytest.mark.parametrize("attack", ["manifest", "blob", "report", "removed", "writable", "symlink"])
def test_changed_or_missing_snapshot_or_stored_report_fails_closed(completed, attack):
    store, dispatch, _, _, _ = completed
    root = store.root / "snapshots" / dispatch["dispatch_id"]
    if attack == "report":
        ref = store.records()[-1]["data"]
        path = store.root / ref["report_path"]
    elif attack == "blob":
        path = next((root / "blobs").rglob("*"))
        while path.is_dir():
            path = next(path.iterdir())
    else:
        path = root / "manifest.json"
    if attack == "symlink":
        root.chmod(0o700)
        original = path.read_bytes()
        path.unlink()
        other = store.root / "replacement"
        other.write_bytes(original)
        path.symlink_to(other)
        root.chmod(0o500)
    elif attack == "removed":
        root.chmod(0o700)
        path.unlink()
        root.chmod(0o500)
    else:
        path.chmod(0o600)
        if attack != "writable":
            path.write_bytes(path.read_bytes() + b" ")
            path.chmod(0o400)
    assert query(completed) == UNKNOWN


def test_legacy_inline_result_is_not_promoted(completed):
    store, _, _, report, job = completed
    store.append("completed", {**job, "report": report})
    assert query(completed) == UNKNOWN


@pytest.fixture
def unix_broker(tmp_path, monkeypatch):
    broker, client, wire = modules()
    # Host ownership checks alone are simulated; actual kernel credentials are exercised.
    monkeypatch.setattr(wire, "trusted_parent", lambda path: None)
    monkeypatch.setattr(wire, "BROKER_UID", os.getuid())
    monkeypatch.setattr(broker, "require_root", lambda: None)
    config = broker.BrokerConfig(tmp_path / "status.sock", frozenset({os.getuid()}))
    seen = []

    def source(run_id, uid):
        seen.append((run_id, uid))
        return {"status": "passed"}

    instance = broker.StatusBroker(config, source)
    worker = threading.Thread(target=instance.serve_forever, kwargs={"poll_interval": 0.01})
    worker.start()
    yield instance, seen, client, wire
    instance.shutdown()
    worker.join(timeout=3)
    instance.server_close()
    assert not worker.is_alive()


def test_real_temp_socket_peer_check_and_client_roundtrip(unix_broker):
    instance, seen, client, _ = unix_broker
    assert client.check_status(instance.config.socket_path, "allowed") == {"status": "passed"}
    assert seen == [("allowed", os.getuid())]
    assert instance.config.socket_path.stat().st_mode & 0o777 == 0o666


def test_wrong_or_unverifiable_peer_denied_before_source(unix_broker, monkeypatch):
    instance, seen, client, wire = unix_broker
    instance.config = replace(instance.config, allowed_uids=frozenset({os.getuid() + 1}))
    assert client.check_status(instance.config.socket_path, "allowed") == UNKNOWN
    instance.config = replace(instance.config, allowed_uids=frozenset({os.getuid()}))
    monkeypatch.setattr(wire, "peer_uid", lambda sock: None)
    assert client.check_status(instance.config.socket_path, "allowed") == UNKNOWN
    assert seen == []


@pytest.mark.parametrize("raw", [b"{}", b"[]", b'null', b'{"version":true,"run_id":"allowed"}', b'{"version":1,"run_id":"allowed","uid":0}', b'{"version":1,"run_id":"allowed","run_id":"foreign"}', b'{"version":1,"run_id":"../key"}', b'\xff', b'{' ])
def test_malformed_broker_requests_never_query_source(unix_broker, raw):
    instance, seen, _, wire = unix_broker
    with socket.socket(socket.AF_UNIX) as sock:
        sock.settimeout(2)
        sock.connect(str(instance.config.socket_path))
        sock.sendall(struct.pack("!I", len(raw)) + raw)
        assert wire.receive(sock, 256) == UNKNOWN
    assert seen == []


@pytest.mark.parametrize("operation", ["audit", "register", "approve", "run", "repair", "events", "evidence", "raw"])
def test_privileged_requests_denied(unix_broker, operation):
    instance, seen, _, wire = unix_broker
    with socket.socket(socket.AF_UNIX) as sock:
        sock.settimeout(2)
        sock.connect(str(instance.config.socket_path))
        wire.send(sock, {"version": 1, "run_id": "allowed", "command": operation})
        assert wire.receive(sock, 256) == UNKNOWN
    assert seen == []


def test_oversize_frame_rejected_before_payload(unix_broker):
    instance, seen, _, wire = unix_broker
    with socket.socket(socket.AF_UNIX) as sock:
        sock.settimeout(2)
        sock.connect(str(instance.config.socket_path))
        sock.sendall(struct.pack("!I", 2049))
        assert wire.receive(sock, 256) == UNKNOWN
    assert seen == []


def test_broker_down_and_unsafe_socket_path_are_unknown(tmp_path):
    _, client, _ = modules()
    assert client.check_status(tmp_path / "absent.sock", "allowed") == UNKNOWN
    target = tmp_path / "file"
    target.write_text("synthetic-private-marker")
    link = tmp_path / "link.sock"
    link.symlink_to(target)
    assert client.check_status(link, "allowed") == UNKNOWN
    assert target.read_text() == "synthetic-private-marker"


def test_client_rejects_wrong_server_identity(unix_broker, monkeypatch):
    instance, _, client, wire = unix_broker
    monkeypatch.setattr(wire, "BROKER_UID", os.getuid() + 1)
    assert client.check_status(instance.config.socket_path, "allowed") == UNKNOWN


def test_source_exception_or_extra_fields_cannot_leak(unix_broker, capsys):
    instance, _, client, _ = unix_broker
    marker = "/synthetic/private/key event evidence run_id URL"
    for response in [{"status": "passed", "details": marker}, {"status": marker}, None]:
        instance.source = lambda *args: response
        assert client.check_status(instance.config.socket_path, "allowed") == UNKNOWN

    def broken(*args):
        raise RuntimeError(marker)

    instance.source = broken
    assert client.check_status(instance.config.socket_path, "allowed") == UNKNOWN
    assert marker not in str(capsys.readouterr())


def test_socket_startup_refuses_existing_path_without_unlink(unix_broker):
    instance, _, _, _ = unix_broker
    broker, _, _ = modules()
    before = instance.config.socket_path.stat().st_ino
    with pytest.raises((OSError, ValueError)):
        broker.StatusBroker(instance.config, lambda *args: UNKNOWN)
    assert instance.config.socket_path.stat().st_ino == before


def test_unprotected_ancestry_is_rejected(tmp_path):
    _, _, wire = modules()
    with pytest.raises((OSError, ValueError)):
        wire.trusted_parent(tmp_path / "status.sock")
