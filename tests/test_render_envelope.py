"""Presentation identities cannot replace recorded evidence or bypass isolation."""

import pytest

pytest.importorskip("pydantic")
from pydantic import ValidationError

from truthlens.render_envelope import RenderEnvelope, artifact_view


def recorded_run():
    return {
        "id": "r",
        "project_id": "p",
        "workspace_id": None,
        "source_id": "s",
        "source_run_id": "original",
        "origin": "NATIVE",
        "integrity": "hash-only",
        "verification": "UNKNOWN",
        "review": "REQUIRED",
        "acceptance": "UNKNOWN",
        "events": [{"id": "e"}],
        "artifacts": [{"id": "a", "kind": "patch", "content": "+recorded", "evidence_ref": "e"}],
    }


def test_envelope_identity_trust_and_renderer_are_closed():
    run = recorded_run()
    envelope, payload = artifact_view(run, "a")
    assert payload == "+recorded"
    assert envelope.kind == "diff"
    assert envelope.provenance.event_refs == ["e"]
    for change in (
        {"payload_ref": "/etc/passwd"},
        {"trust_score": 100},
        {"presentation": {"preferred_renderer": "script", "supported_renderers": ["script"]}},
    ):
        with pytest.raises(ValidationError):
            RenderEnvelope.model_validate({**envelope.model_dump(), **change})
    with pytest.raises(ValueError):
        artifact_view(run, "../a")
    with pytest.raises(ValueError):
        artifact_view(run, "a", "html")
    forged = envelope.model_dump()
    forged["trust"].update(origin="IMPORTED", integrity="hmac", verification="VERIFIED")
    with pytest.raises(ValidationError):
        RenderEnvelope.model_validate(forged)


def test_failed_missing_oversized_malformed_fall_back_without_execution():
    run = recorded_run()
    run["integrity"] = "failed"
    envelope, payload = artifact_view(run, "a")
    assert payload is None and envelope.data_status == "isolated"
    assert envelope.presentation.supported_renderers == ["plain"]
    run["integrity"] = "hash-only"
    run["artifacts"][0]["kind"] = "story"
    envelope, _ = artifact_view(run, "a")
    assert envelope.kind == "plain"  # Story is a run projection, not an artifact renderer.
    for content, status in ((None, "missing"), ("x" * 262145, "malformed"), ("{bad", "malformed")):
        run["artifacts"][0].update(kind="json", content=content)
        envelope, payload = artifact_view(run, "a")
        assert envelope.data_status == status
        assert envelope.presentation.supported_renderers == ["plain"]
        if content != "{bad":
            assert payload is None
