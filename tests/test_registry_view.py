"""Read projections are exercised with signed local fixtures, not a live gateway."""

import pytest

from truthlens import registry, registry_view

pytest_plugins = ("tests.test_registry",)


def test_event_page_is_authorized_bounded_and_contains_real_sequences(captured):
    store, dispatch, capture = captured
    page = registry_view.events(store, capture["run_id"], 1234, dispatch["session_id"], 0)
    assert 0 < len(page["events"]) <= 5
    assert [e["seq"] for e in page["events"]] == list(
        range(page["events"][0]["seq"], page["events"][0]["seq"] + len(page["events"]))
    )
    assert page["events"][-1]["type"] == "run.finished"
    assert all(e["run_id"] == capture["run_id"] and len(e["hash"]) == 64 for e in page["events"])
    assert str(store.root) not in str(page)
    with pytest.raises(registry.RegistryError):
        registry_view.events(store, capture["run_id"], 5678, dispatch["session_id"], 0)
    with pytest.raises(registry.RegistryError):
        registry_view.events(store, capture["run_id"], 1234, "foreign", 0)


def test_view_does_not_mutate_registry_or_queue(captured):
    store, dispatch, capture = captured
    before = store.records()
    registry_view.summary(store, capture["run_id"], 1234, dispatch["session_id"])
    registry_view.events(store, capture["run_id"], 1234, dispatch["session_id"], 0)
    assert store.records() == before


def test_gateway_read_port_requires_bound_server_session(captured):
    store, _, capture = captured
    with pytest.raises(registry.RegistryError):
        registry_view.summary(store, capture["run_id"], 1234, None)
