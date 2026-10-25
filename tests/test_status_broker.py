"""G1: synthetic protected registry plus real temporary Unix sockets, no host isolation claim."""

import copy
import json
import os
import socket
import struct
import threading
from dataclasses import replace

import pytest

from truthlens import pipeline

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
@pytest.mark.parametrize(
    "attack",
    [
        "hash_only",
        "unsigned",
        "verified_false",
        "verified_int",
        "wrong_run",
        "wrong_anchor",
        "wrong_digest",
        "verifier",
        "ruleset",
        "open",
        "missing_digest",
    ],
)
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
    store.append(
        "completed",
        {
            **job,
            "report": json.loads(
                __import__("truthlens.audit", fromlist=["serialize_report"]).serialize_report(report)
            ),
        },
    )
    assert query(completed) == UNKNOWN


@pytest.fixture
def unix_broker(tmp_path, monkeypatch):
    broker, client, wire = modules()
    # Host ownership checks alone are simulated; actual kernel credentials are exercised.
    monkeypatch.setattr(wire, "trusted_parent", lambda path: None)
    monkeypatch.setattr(wire, "BROKER_UID", os.getuid())
    monkeypatch.setattr(broker, "require_root", lambda: None)
    config = broker.BrokerConfig(tmp_path / "status.sock", frozenset({os.getuid()}), os.getgid())
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
    assert instance.config.socket_path.stat().st_mode & 0o777 == 0o660


def test_wrong_or_unverifiable_peer_denied_before_source(unix_broker, monkeypatch):
    instance, seen, client, wire = unix_broker
    instance.config = replace(instance.config, allowed_uids=frozenset({os.getuid() + 1}))
    assert client.check_status(instance.config.socket_path, "allowed") == UNKNOWN
    instance.config = replace(instance.config, allowed_uids=frozenset({os.getuid()}))
    monkeypatch.setattr(wire, "peer_uid", lambda sock: None)
    assert client.check_status(instance.config.socket_path, "allowed") == UNKNOWN
    assert seen == []


@pytest.mark.parametrize(
    "raw",
    [
        b"{}",
        b"[]",
        b"null",
        b'{"version":true,"run_id":"allowed"}',
        b'{"version":1,"run_id":"allowed","uid":0}',
        b'{"version":1,"run_id":"allowed","run_id":"foreign"}',
        b'{"version":1,"run_id":"../key"}',
        b"\xff",
        b"{",
    ],
)
def test_malformed_broker_requests_never_query_source(unix_broker, raw):
    instance, seen, _, wire = unix_broker
    with socket.socket(socket.AF_UNIX) as sock:
        sock.settimeout(2)
        sock.connect(str(instance.config.socket_path))
        sock.sendall(struct.pack("!I", len(raw)) + raw)
        assert wire.receive(sock, 256) == UNKNOWN
    assert seen == []


@pytest.mark.parametrize(
    "operation", ["audit", "register", "approve", "run", "repair", "events", "evidence", "raw", "explain"]
)
def test_privileged_requests_denied(unix_broker, operation):
    instance, seen, _, wire = unix_broker
    with socket.socket(socket.AF_UNIX) as sock:
        sock.settimeout(2)
        sock.connect(str(instance.config.socket_path))
        wire.send(sock, {"version": 1, "run_id": "allowed", "command": operation})
        assert wire.receive(sock, 256) == UNKNOWN
    assert seen == []


def test_explain_flag_has_identical_fixed_denial_frame(unix_broker, capsys, monkeypatch):
    import sys

    monkeypatch.setitem(sys.modules, "truthlens.pipeline_explain", None)
    instance, seen, _, wire = unix_broker
    raw = b'{"status":"not_checkable"}'
    expected = struct.pack("!I", len(raw)) + raw
    with socket.socket(socket.AF_UNIX) as sock:
        sock.settimeout(2)
        sock.connect(str(instance.config.socket_path))
        wire.send(sock, {"version": 1, "run_id": "allowed", "explain": True})
        response = bytearray()
        while chunk := sock.recv(256):
            response.extend(chunk)
        assert bytes(response) == expected
    assert seen == []
    assert capsys.readouterr() == ("", "")


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
        instance.source = lambda *args, response=response: response
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


def test_client_checks_kernel_server_uid_after_connect(unix_broker, monkeypatch):
    instance, _, client, wire = unix_broker
    monkeypatch.setattr(wire, "peer_uid", lambda sock: os.getuid() + 1)
    assert client.check_status(instance.config.socket_path, "allowed") == UNKNOWN


def test_root_peer_is_not_an_eligible_agent(tmp_path, monkeypatch):
    broker, _, wire = modules()
    monkeypatch.setattr(broker, "require_root", lambda: None)
    monkeypatch.setattr(wire, "trusted_parent", lambda path: None)
    for uids, gid in [
        (frozenset({0}), os.getgid()),
        (frozenset({True}), os.getgid()),
        (frozenset(), os.getgid()),
        (frozenset({1234}), 0),
    ]:
        with pytest.raises(ValueError):
            broker.BrokerConfig(tmp_path / "s", uids, gid).validate()


def test_slow_drip_has_total_deadline(unix_broker, monkeypatch):
    import time

    instance, seen, _, wire = unix_broker
    monkeypatch.setattr(wire, "TIMEOUT", 0.12)
    with socket.socket(socket.AF_UNIX) as sock:
        sock.settimeout(1)
        sock.connect(str(instance.config.socket_path))
        start = time.monotonic()
        for byte in b"\x00\x00\x00":
            try:
                sock.send(bytes([byte]))
            except BrokenPipeError:
                break
            time.sleep(0.07)
        assert sock.recv(256) == b""
        assert time.monotonic() - start < 0.8
    assert seen == []


def test_worker_capacity_is_bounded_and_busy_clients_fail_closed(unix_broker):
    instance, seen, client, _ = unix_broker
    entered = threading.Barrier(3)
    release = threading.Event()
    results = []

    def blocked(*args):
        entered.wait(timeout=2)
        release.wait(timeout=2)
        return {"status": "passed"}

    instance.source = blocked
    workers = [
        threading.Thread(
            target=lambda: results.append(client.check_status(instance.config.socket_path, "allowed"))
        )
        for _ in range(2)
    ]
    for worker in workers:
        worker.start()
    try:
        entered.wait(timeout=2)
        assert client.check_status(instance.config.socket_path, "allowed") == UNKNOWN
    finally:
        release.set()
        for worker in workers:
            worker.join(timeout=3)
    assert len(results) == 2
    assert seen == []


def test_query_rate_is_bounded_per_allowed_uid(unix_broker):
    instance, seen, client, _ = unix_broker
    results = [client.check_status(instance.config.socket_path, "allowed") for _ in range(20)]
    assert UNKNOWN in results
    assert len(seen) < 20


@pytest.mark.parametrize("contradictory", [False, True])
def test_signed_fixture_registry_broker_stdio_roundtrip(
    store, tmp_path, monkeypatch, unix_broker, contradictory
):
    import subprocess
    import sys

    from tests.audit_support import TEST_KEY, digest_tree, make_run
    from tests.test_mcp_status import handshake, message, tool_status

    broker, _, _ = modules()
    monkeypatch.setattr(pipeline, "trusted", lambda *a, **kw: None)
    key = tmp_path / "synthetic-key"
    key.write_bytes(TEST_KEY)
    key.chmod(0o600)
    monkeypatch.setattr(pipeline, "KEY_FILE", key)
    dispatch = store.dispatch("agent-zero", os.getuid(), "Shu", [os.getuid()], "a" * 64)
    tests = (
        [{"passed": 0, "failed": 1, "skipped": 0, "exit_code": 1, "criterion_ids": ["c1"]}]
        if contradictory
        else None
    )
    make_run(store.root / "runs" / dispatch["dispatch_id"], tests=tests)
    capture = pipeline.finalize(store, dispatch)
    job = store.queue(capture["run_id"], os.getuid())
    report = pipeline.check_snapshot(store, {**dispatch, **capture})
    store.append("completed", {**job, **store.save_report(job["audit_id"], report)})
    before = digest_tree(store.root)
    instance, _, _, _ = unix_broker
    instance.source = lambda run_id, uid: broker.registered_status(store, run_id, uid)
    # Child has only the status client. Synthetic ownership override matches the
    # fixture; this is not a proof of separate-UID host protection.
    bootstrap = "import os; from truthlens import status_wire as w; w.BROKER_UID=os.getuid(); w.trusted_parent=lambda p:None; from truthlens.cli import main; raise SystemExit(main())"
    requests = handshake() + [
        message(
            "tools/call",
            {"name": "truthlens_check_status", "arguments": {"run_id": capture["run_id"]}},
            mid=2,
        )
    ]
    result = subprocess.run(
        [sys.executable, "-c", bootstrap, "mcp-status", "--socket", str(instance.config.socket_path)],
        input=b"".join(json.dumps(m).encode() + b"\n" for m in requests),
        check=False,
        capture_output=True,
        timeout=10,
    )
    assert result.returncode == 0 and result.stderr == b""
    replies = [json.loads(line) for line in result.stdout.splitlines()]
    assert tool_status(replies[-1]) == {"status": "failed" if contradictory else "passed"}
    assert capture["run_id"].encode() not in result.stdout + result.stderr
    assert TEST_KEY not in result.stdout + result.stderr
    assert str(store.root).encode() not in result.stdout + result.stderr
    assert digest_tree(store.root) == before


@pytest.mark.parametrize("flag", [None, False, 1, "true"])
def test_trusted_status_context_requires_verified_true(completed, monkeypatch, flag):
    from truthlens import pipeline_jobs

    context = {"state": "completed"}
    if flag is not None:
        context["verified"] = flag
    monkeypatch.setattr(pipeline_jobs, "status", lambda *a, **kw: context)
    assert query(completed) == UNKNOWN


def test_final_projection_observes_an_atomic_journal(completed, monkeypatch):
    from truthlens import status_projection

    store = completed[0]
    attempted, done = threading.Event(), threading.Event()
    original = status_projection.project_status
    writers = []

    def append():
        attempted.set()
        store.append("running", completed[4])
        done.set()

    def project(*a, **kw):
        writer = threading.Thread(target=append)
        writers.append(writer)
        writer.start()
        assert attempted.wait(timeout=1)
        assert not done.wait(timeout=0.03), "journal changed during final projection"
        return original(*a, **kw)

    monkeypatch.setattr(status_projection, "project_status", project)
    result = query(completed)
    for writer in writers:
        writer.join(timeout=2)
    assert result == {"status": "passed"}
    assert done.is_set()
    assert query(completed) == UNKNOWN
