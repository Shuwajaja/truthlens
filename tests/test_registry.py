"""Privilege-dependent cases simulate the root boundary; no host setup is performed."""

import os

import pytest

from truthlens import registry


@pytest.fixture
def store(tmp_path, monkeypatch):
    monkeypatch.setattr(registry, "require_root", lambda: None)
    monkeypatch.setattr(registry, "trusted", lambda *args, **kwargs: None)
    root = tmp_path / "state"
    root.mkdir(mode=0o700)
    return registry.Registry(root)


def test_registry_is_append_only_persistent_and_detects_torn_tail(store):
    first = store.dispatch("agent-zero", 1234, "Shu", [1234], "profile-digest")
    assert store.records()[0]["data"]["session_id"] == first["session_id"]
    again = registry.Registry(store.root)
    assert again.records() == store.records()
    with (store.root / "registry.jsonl").open("ab") as stream:
        stream.write(b'{"unfinished":')
    with pytest.raises(registry.RegistryError):
        again.records()


def test_unknown_or_forged_registration_cannot_be_queued(store):
    with pytest.raises(registry.RegistryError):
        store.queue("run_external", 1234)
    assert store.records() == []


def test_dispatch_uses_server_session_and_bound_initiator(store):
    first = store.dispatch("agent-zero", 1234, "Shu", [1234], "a" * 64)
    second = store.dispatch("agent-zero", 1234, "Shu", [1234], "a" * 64)
    assert first["session_id"] != second["session_id"]
    assert first["initiator_uid"] == 1234 and first["on_behalf_of"] == "Shu"
    assert first["origin"] == "server_pipeline"


def test_nonroot_fails_closed(monkeypatch):
    monkeypatch.setattr(os, "geteuid", lambda: 1234)
    with pytest.raises(registry.RegistryError):
        registry.require_root()


def test_sudo_uid_needs_kernel_corroboration(monkeypatch):
    monkeypatch.setattr(registry, "require_root", lambda: None)
    monkeypatch.setattr(registry, "kernel_login_uid", lambda: 1234)
    monkeypatch.setenv("SUDO_UID", "5678")
    with pytest.raises(registry.RegistryError):
        registry.caller_uid()
    monkeypatch.setenv("SUDO_UID", "1234")
    assert registry.caller_uid() == 1234


@pytest.fixture
def captured(store, tmp_path, monkeypatch):
    from tests.audit_support import TEST_KEY, make_run
    from truthlens import pipeline

    monkeypatch.setattr(pipeline, "trusted", lambda *args, **kwargs: None)
    key = tmp_path / "key"
    key.write_bytes(TEST_KEY)
    key.chmod(0o600)
    monkeypatch.setattr(pipeline, "KEY_FILE", key)
    dispatch = store.dispatch("agent-zero", 1234, "Shu", [1234], "a" * 64)
    make_run(store.root / "runs" / dispatch["dispatch_id"])
    capture = pipeline.finalize(store, dispatch)
    return store, dispatch, capture


def test_own_server_capture_admits_once_and_foreign_session_denied(captured):
    store, dispatch, capture = captured
    first = store.queue(capture["run_id"], 1234, dispatch["session_id"])
    assert store.queue(capture["run_id"], 1234, dispatch["session_id"]) == first
    assert len([r for r in store.records() if r["event"] == "queued"]) == 1
    for uid, session in ((5678, dispatch["session_id"]), (1234, "foreign-session")):
        with pytest.raises(registry.RegistryError):
            store.queue(capture["run_id"], uid, session)


def test_changed_snapshot_is_not_admitted(captured):
    store, dispatch, capture = captured
    path = store.root / "snapshots" / dispatch["dispatch_id"] / "manifest.json"
    path.chmod(0o600)
    path.write_bytes(path.read_bytes() + b" ")
    path.chmod(0o400)
    with pytest.raises(registry.RegistryError):
        store.queue(capture["run_id"], 1234)


def test_unsigned_server_run_is_not_registered(store, tmp_path, monkeypatch):
    from tests.audit_support import TEST_KEY, make_run
    from truthlens import pipeline

    monkeypatch.setattr(pipeline, "trusted", lambda *args, **kwargs: None)
    key = tmp_path / "key"
    key.write_bytes(TEST_KEY)
    key.chmod(0o600)
    monkeypatch.setattr(pipeline, "KEY_FILE", key)
    dispatch = store.dispatch("agent-zero", 1234, "Shu", [1234], "a" * 64)
    make_run(store.root / "runs" / dispatch["dispatch_id"], key=None)
    with pytest.raises(registry.RegistryError):
        pipeline.finalize(store, dispatch)
    assert not any(r["event"] == "captured" for r in store.records())


def test_snapshot_directories_are_fsynced_before_registration(store, tmp_path, monkeypatch):
    import stat

    from tests.audit_support import TEST_KEY, make_run
    from truthlens import pipeline

    monkeypatch.setattr(pipeline, "trusted", lambda *args, **kwargs: None)
    key = tmp_path / "key"
    key.write_bytes(TEST_KEY)
    key.chmod(0o600)
    monkeypatch.setattr(pipeline, "KEY_FILE", key)
    dispatch = store.dispatch("agent-zero", 1234, "Shu", [1234], "a" * 64)
    make_run(store.root / "runs" / dispatch["dispatch_id"])
    order = []
    actual_sync = os.fsync
    actual_append = store.append

    def sync(fd):
        if stat.S_ISDIR(os.fstat(fd).st_mode):
            order.append(os.readlink(f"/proc/self/fd/{fd}"))
        actual_sync(fd)

    def append(event, data):
        order.append(event)
        actual_append(event, data)

    monkeypatch.setattr(os, "fsync", sync)
    monkeypatch.setattr(store, "append", append)
    pipeline.finalize(store, dispatch)
    target = str(store.root / "snapshots" / dispatch["dispatch_id"])
    assert order.index(target) < order.index("captured")
    assert order.index(str(store.root / "snapshots")) < order.index("captured")
    assert order.index(str(store.root)) < order.index("captured")
