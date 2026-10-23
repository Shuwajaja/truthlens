"""Real synthetic snapshot bytes; these tests do not establish host/SSH isolation."""

import hashlib

import pytest

from tests.audit_support import RUN_ID, digest_tree, make_run
from truthlens import registry

pytest_plugins = ("tests.test_registry",)


@pytest.fixture
def registered(store):
    dispatch = store.dispatch("agent-zero", 1234, "Shu", [1234], "a" * 64)
    root = make_run(store.root / "snapshots" / dispatch["dispatch_id"], key=None)
    import json

    anchor = json.loads((root / "manifest.json").read_bytes())["ledger_last_hash"]
    capture = {
        "dispatch_id": dispatch["dispatch_id"],
        "snapshot_id": dispatch["dispatch_id"],
        "run_id": RUN_ID,
        "registration_id": "b" * 32,
        "ledger_last_hash": anchor,
        "capture_closed_at": "2026-10-23T00:00:00+00:00",
        "input_digests": digest_tree(root),
    }
    store.append("captured", capture)
    return store, dispatch, capture, root


def projection(store, *, uid=1234, view_id="shu-private"):
    from truthlens.read_projection import ReadProjection

    return ReadProjection(store, uid=uid, view_id=view_id)


def test_registered_snapshot_document_and_event_pages_are_hash_only_and_unchanged(registered):
    store, _, capture, root = registered
    before = digest_tree(store.root)
    reader = projection(store)
    catalog = reader.catalog(limit=1)
    assert catalog["runs"][0]["run_id"] == RUN_ID
    assert catalog["next_offset"] is None
    response = reader.document(RUN_ID)
    doc = response["document"]
    assert response["source_id"] == catalog["runs"][0]["source_id"]
    assert doc["verified"] is False and doc["integrity"] == "hash-only"
    assert doc["run"]["ledger_last_hash"] == capture["ledger_last_hash"]
    assert doc["criteria"][0]["status"] == "met"
    assert "blobs" not in doc
    first = reader.events(RUN_ID, limit=2)
    assert [e["seq"] for e in first["events"]] == [1, 2]
    assert first["next_seq"] == 2 and first["has_more"] is True
    rest = reader.events(RUN_ID, after_seq=2, limit=100)
    assert [e["seq"] for e in rest["events"]] == [3, 4, 5, 6]
    assert rest["events"][-1]["type"] == "run.finished"
    assert rest["has_more"] is False
    assert first["total"] == 6
    assert digest_tree(store.root) == before
    assert str(root) not in str(response)


def test_unregistered_foreign_uid_and_bad_pagination_are_denied(registered):
    store, _, _, _ = registered
    reader = projection(store)
    assert projection(store, uid=5678).catalog()["runs"] == []
    for action in (
        lambda: reader.document("run_unknown"),
        lambda: reader.document("../ledger.jsonl"),
        lambda: projection(store, uid=5678).document(RUN_ID),
        lambda: reader.catalog(limit=51),
        lambda: reader.catalog(offset=True),
        lambda: reader.events(RUN_ID, after_seq=7),
        lambda: reader.events(RUN_ID, limit=101),
    ):
        with pytest.raises(registry.RegistryError):
            action()


def test_source_identity_changes_with_protected_view_and_registration(registered):
    store, _, _, _ = registered
    first = projection(store).document(RUN_ID)["source_id"]
    other = projection(store, view_id="other-private").document(RUN_ID)["source_id"]
    assert len(first) == 64 and first != other
    assert first != projection(store).source_id


@pytest.mark.parametrize("name", ["ledger.jsonl", "manifest.json"])
def test_changed_registered_bytes_and_symlink_inputs_are_denied(registered, name):
    store, _, _, root = registered
    path = root / name
    original = path.read_bytes()
    path.write_bytes(original + b" ")
    with pytest.raises(registry.RegistryError):
        projection(store).document(RUN_ID)
    path.write_bytes(original)
    target = root / (name + ".original")
    path.rename(target)
    path.symlink_to(target)
    with pytest.raises(registry.RegistryError):
        projection(store).events(RUN_ID)


def test_snapshot_path_from_registry_cannot_escape(registered):
    store, _, capture, _ = registered
    store.append("captured", {**capture, "run_id": "run_evil", "dispatch_id": "../escape"})
    with pytest.raises(registry.RegistryError):
        projection(store).document("run_evil")


def test_limits_reject_oversize_documents_and_journals(registered, monkeypatch):
    from truthlens import read_projection

    store, _, _, _ = registered
    monkeypatch.setattr(read_projection, "MAX_DOCUMENT_BYTES", 100)
    with pytest.raises(registry.RegistryError):
        projection(store).document(RUN_ID)
    assert projection(store).events(RUN_ID, limit=1)["events"][0]["seq"] == 1
    monkeypatch.setattr(read_projection, "MAX_REGISTRY_BYTES", 100)
    with pytest.raises(registry.RegistryError):
        projection(store).catalog()


def test_registry_digest_tampering_is_denied(registered):
    store, _, _, _ = registered
    path = store.root / "registry.jsonl"
    original = path.read_bytes()
    path.write_bytes(original.replace(b"Shu", b"Eve", 1))
    assert hashlib.sha256(path.read_bytes()).digest() != hashlib.sha256(original).digest()
    with pytest.raises(registry.RegistryError):
        projection(store).catalog()


def test_request_reads_never_open_writers_or_call_privileged_jobs(registered, monkeypatch):
    import os
    import subprocess

    from truthlens import audit, audit_inputs, pipeline, pipeline_jobs

    store, _, _, _ = registered
    before = digest_tree(store.root)

    def forbidden(*args, **kwargs):
        pytest.fail("reader invoked a forbidden key, audit, job or process operation")

    actual_open = os.open

    def readonly_open(path, flags, *args, **kwargs):
        assert not flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND)
        return actual_open(path, flags, *args, **kwargs)

    monkeypatch.setattr(os, "open", readonly_open)
    for module, name in (
        (audit, "audit_run"),
        (audit_inputs, "read_audit_key"),
        (pipeline, "check_snapshot"),
        (pipeline, "read_audit_key"),
        (pipeline_jobs, "drain"),
        (subprocess, "Popen"),
        (store, "append"),
        (store, "queue"),
        (store, "save_report"),
        (store, "read_report"),
        (store, "records"),
    ):
        monkeypatch.setattr(module, name, forbidden)
    reader = projection(store)
    assert reader.catalog()["runs"]
    assert reader.document(RUN_ID)["document"]["verified"] is False
    assert reader.events(RUN_ID)["events"]
    assert digest_tree(store.root) == before


def test_hardlinked_snapshot_input_is_denied(registered):
    import os

    store, _, _, root = registered
    os.link(root / "ledger.jsonl", root / "ledger-copy")
    with pytest.raises(registry.RegistryError):
        projection(store).events(RUN_ID)


def test_document_ledger_cap_does_not_prevent_bounded_event_pages(registered, monkeypatch):
    from truthlens import read_projection

    store, _, _, _ = registered
    monkeypatch.setattr(read_projection, "MAX_DOCUMENT_LEDGER_BYTES", 100)
    with pytest.raises(registry.RegistryError):
        projection(store).document(RUN_ID)
    assert projection(store).events(RUN_ID, limit=1)["next_seq"] == 1
