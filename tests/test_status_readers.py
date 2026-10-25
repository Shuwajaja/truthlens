"""Status-reader boundaries with synthetic captures; no live UID/isolation claim."""

import copy
import json
import os
import socket
import struct

import pytest

from tests.audit_support import TEST_KEY, digest_tree, make_run
from truthlens import pipeline, pipeline_jobs, registry, registry_view
from truthlens.cli import main
from truthlens.read_projection import ReadProjection

pytest_plugins = ("tests.test_status_broker",)
READER = 5678
DENIAL = (
    '{"connection": "not connected", "message": "Pipeline unavailable or access denied.", '
    '"state": "unavailable"}\n'
)


def broker():
    from truthlens import status_broker

    return status_broker


def profile():
    return {
        "enabled": True,
        "agent": "agent-zero",
        "callers": [{"uid": 1234, "name": "Codex", "on_behalf_of": "Shu"}],
        "status_readers": [{"uid": READER, "name": "agent-zero"}],
    }


@pytest.fixture
def reader_completed(store, tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline, "trusted", lambda *a, **kw: None)
    key = tmp_path / "synthetic-key"
    key.write_bytes(TEST_KEY)
    key.chmod(0o600)
    monkeypatch.setattr(pipeline, "KEY_FILE", key)
    dispatch = store.dispatch(
        "agent-zero", 1234, "Shu", [1234], "a" * 64, "Codex", status_reader_uids=[READER]
    )
    make_run(store.root / "runs" / dispatch["dispatch_id"])
    capture = pipeline.finalize(store, dispatch)
    job = store.queue(capture["run_id"], 1234)
    report = pipeline.check_snapshot(store, {**dispatch, **capture})
    store.append("completed", {**job, **store.save_report(job["audit_id"], report)})
    return store, dispatch, capture, report, job


@pytest.mark.parametrize(
    "state,status,exit_code",
    [("passed", "passed", 0), ("failed", "failed", 1), ("running", "not_checkable", 2)],
)
def test_reader_gets_only_status_broker_and_local_cli(
    reader_completed, monkeypatch, capsys, state, status, exit_code
):
    store, dispatch, capture, report, job = reader_completed
    if state == "failed":
        report = copy.deepcopy(report)
        report["checks"][0]["outcome"] = "contradictory"
        report["conclusion"] = "contradictory"
        store.append("completed", {**job, **store.save_report(job["audit_id"], report)})
    elif state == "running":
        store.append("running", job)
    before = digest_tree(store.root)
    monkeypatch.setattr(registry, "caller_uid", lambda: READER)
    monkeypatch.setattr(registry, "Registry", lambda: store)
    monkeypatch.setattr(pipeline, "load_profile", lambda *a: pytest.fail("status must not reload config"))
    assert broker().registered_status(store, capture["run_id"], READER) == {"status": status}
    for suffix in ([], ["--session", dispatch["session_id"]]):
        assert main(["status", capture["run_id"], *suffix]) == exit_code
        assert capsys.readouterr() == (f'{{"status":"{status}"}}\n', "")
    assert dispatch["authorized_uids"] == [1234]
    assert dispatch["status_reader_uids"] == [READER]
    assert digest_tree(store.root) == before


def test_reader_denied_caller_details_admission_and_phase_b(reader_completed, monkeypatch, capsys):
    store, dispatch, capture, _, _ = reader_completed
    run_id, session = capture["run_id"], dispatch["session_id"]
    before = digest_tree(store.root)
    for uid in (READER, 9999):
        for action in (
            lambda: store.run(run_id, uid),
            lambda: store.queue(run_id, uid),
            lambda: pipeline_jobs.status(store, run_id, uid),
            lambda: registry_view.summary(store, run_id, uid, session),
            lambda: registry_view.events(store, run_id, uid, session, 0),
            lambda: ReadProjection(store, uid=uid, view_id="shu").document(run_id),
        ):
            with pytest.raises(registry.RegistryError, match=r"^Pipeline unavailable or access denied\.$"):
                action()
        assert ReadProjection(store, uid=uid, view_id="shu").catalog()["runs"] == []
        monkeypatch.setattr(registry, "caller_uid", lambda: uid)
        monkeypatch.setattr(registry, "Registry", lambda: store)
        assert main(["admit", run_id]) == 2
        assert capsys.readouterr() == (DENIAL, "")
    assert store.run(run_id, 1234)["dispatch_id"] == dispatch["dispatch_id"]
    expected = json.dumps(pipeline_jobs.status(store, run_id, 1234), sort_keys=True) + "\n"
    monkeypatch.setattr(registry, "caller_uid", lambda: 1234)
    assert main(["status", run_id]) == 0
    assert capsys.readouterr() == (expected, "")
    assert digest_tree(store.root) == before


def test_reader_cannot_launch_or_dispatch_as_caller(monkeypatch, capsys):
    monkeypatch.setattr(registry, "caller_uid", lambda: READER)
    monkeypatch.setattr(pipeline, "trusted", lambda *a, **kw: None)
    monkeypatch.setattr(pipeline, "load_profile", lambda *a: (profile(), "a" * 64))
    monkeypatch.setattr(pipeline, "agent_account", lambda: pytest.fail("must deny before launch"))
    assert main(["pipeline", "run", "--profile", "agent-zero"]) == 2
    assert capsys.readouterr() == (DENIAL, "")


def test_launcher_captures_readers_separately_from_callers(store, monkeypatch):
    value = {**profile(), "repo": str(store.root), "command": ["/opt/synthetic/task"]}
    monkeypatch.setattr(registry, "caller_uid", lambda: 1234)
    monkeypatch.setattr(registry, "Registry", lambda: store)
    monkeypatch.setattr(pipeline, "trusted", lambda *a, **kw: None)
    monkeypatch.setattr(pipeline, "load_profile", lambda *a: (value, "a" * 64))
    monkeypatch.setattr(pipeline, "agent_account", lambda: 1234)
    monkeypatch.setattr(pipeline, "check_repo", lambda *a: None)
    seen = []

    def dispatch(*args, **kwargs):
        seen.append((args[3], kwargs.get("status_reader_uids")))
        registry.deny()  # Stop before wrapper/key/account access.

    monkeypatch.setattr(store, "dispatch", dispatch)
    with pytest.raises(registry.RegistryError):
        pipeline.run_profile("agent-zero")
    assert seen == [([1234], [READER])]


@pytest.mark.parametrize("args", [["pending"], ["run", "--profile", "agent-zero"], ["status", "run_known"]])
def test_reader_cannot_explain(monkeypatch, capsys, args):
    monkeypatch.setattr(os, "getuid", lambda: READER)
    monkeypatch.setattr(os, "geteuid", lambda: READER)
    assert main(["pipeline", "explain", *args]) == 2
    assert capsys.readouterr() == ("", "ROOT_REQUIRED\n")


def test_unknown_run_uid_and_wrong_session_keep_existing_denial_bytes(reader_completed, monkeypatch, capsys):
    store, _, capture, _, _ = reader_completed
    monkeypatch.setattr(registry, "Registry", lambda: store)
    for uid, run_id, suffix in (
        (9999, capture["run_id"], []),
        (READER, "unknown", []),
        (READER, capture["run_id"], ["--session", "wrong"]),
    ):
        monkeypatch.setattr(registry, "caller_uid", lambda: uid)
        assert main(["status", run_id, *suffix]) == 2
        assert capsys.readouterr() == (DENIAL, "")
    assert broker().registered_status(store, capture["run_id"], 9999) == {"status": "not_checkable"}
    assert broker().registered_status(store, "unknown", READER) == {"status": "not_checkable"}


def test_legacy_dispatch_has_no_retroactive_readers(completed):
    store, _, capture, _, _ = completed
    assert broker().registered_status(store, capture["run_id"], 1234) == {"status": "passed"}
    assert broker().registered_status(store, capture["run_id"], READER) == {"status": "not_checkable"}


@pytest.mark.parametrize("command", [None, "approve", "run", "dispatch", "explain", "events", "evidence"])
def test_reader_real_socket_status_and_fixed_privileged_denial(reader_completed, unix_broker, command):
    store, _, capture, _, _ = reader_completed
    instance, _, client, wire = unix_broker
    # Peer identity is real; its mapping to the configured synthetic reader is simulated.
    instance.source = lambda run_id, uid: broker().registered_status(store, run_id, READER)
    payload = {"version": 1, "run_id": capture["run_id"]}
    if command is not None:
        payload["command"] = command
    raw = b'{"status":"passed"}' if command is None else b'{"status":"not_checkable"}'
    before = digest_tree(store.root)
    with socket.socket(socket.AF_UNIX) as sock:
        sock.settimeout(2)
        sock.connect(str(instance.config.socket_path))
        wire.send(sock, payload)
        response = bytearray()
        while chunk := sock.recv(256):
            response.extend(chunk)
    assert bytes(response) == struct.pack("!I", len(raw)) + raw
    assert digest_tree(store.root) == before


@pytest.mark.parametrize(
    "readers",
    [
        None,
        {},
        "agent-zero",
        [None],
        [{}],
        [{"uid": True, "name": "agent-zero"}],
        [{"uid": "5678", "name": "agent-zero"}],
        [{"uid": -1, "name": "agent-zero"}],
        [{"uid": 0, "name": "agent-zero"}],
        [{"uid": 4294967295, "name": "agent-zero"}],
        [{"uid": READER, "name": "a" * 49}],
        [{"uid": READER, "name": "../reader"}],
        [{"uid": READER, "name": "Agent Zero"}],
        [{"uid": READER, "name": "ägent"}],
        [{"uid": READER, "name": ""}],
        [{"uid": 1234, "name": "agent-zero"}],
        [{"uid": READER, "name": "Codex"}],
        [{"uid": READER, "name": "agent-zero", "on_behalf_of": "Shu"}],
        [{"uid": READER, "name": "agent-zero"}] * 2,
        [{"uid": READER, "name": "agent-zero"}, {"uid": 5679, "name": "agent-zero"}],
        [{"uid": 2000 + n, "name": f"reader-{n}"} for n in range(65)],
    ],
)
def test_malformed_reader_config_denies_even_existing_caller(readers):
    value = profile()
    value["status_readers"] = readers
    with pytest.raises(registry.RegistryError, match=r"^Pipeline unavailable or access denied\.$"):
        pipeline.delegation(value, 1234)


def test_reader_config_accepts_bounded_names_and_keeps_legacy_callers():
    value = profile()
    for readers in ([], [{"uid": 4294967294, "name": "A" * 48}]):
        value["status_readers"] = readers
        assert pipeline.delegation(value, 1234) == value["callers"][0]
    del value["status_readers"]
    assert pipeline.delegation(value, 1234) == value["callers"][0]
    with pytest.raises(registry.RegistryError):
        pipeline.delegation(profile(), READER)


def test_profile_load_enforces_existing_protected_config_policy(tmp_path, monkeypatch):
    path = tmp_path / "agent-zero.json"
    path.write_text(json.dumps(profile()))
    monkeypatch.setattr(pipeline, "PROFILE_ROOT", tmp_path)
    seen = []

    def protected(candidate, **kwargs):
        seen.append((candidate, kwargs))
        registry.deny()

    monkeypatch.setattr(pipeline, "trusted", protected)
    with pytest.raises(registry.RegistryError):
        pipeline.load_profile("agent-zero")
    assert seen == [(path, {"private": True})]


@pytest.mark.parametrize("readers", [[1234], [True], [0], [-1], [4294967295], [READER, READER], "5678"])
def test_dispatch_rejects_invalid_or_overlapping_reader_uids_without_writes(store, readers):
    with pytest.raises(registry.RegistryError):
        store.dispatch("agent-zero", 1234, "Shu", [1234], "a" * 64, status_reader_uids=readers)
    assert store.records() == []
