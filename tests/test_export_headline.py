"""Derived export prose must never invent an agent's completion quote."""

import pytest

from truthlens.export import build
from truthlens.ledger import Ledger
from truthlens.manifest import build_manifest


@pytest.mark.parametrize("text", [None, "I could not finish.", "Only the documentation is done.", "Done."])
def test_export_headline_preserves_claims_without_inventing_a_quote(tmp_path, text):
    ledger = Ledger(tmp_path / "ledger.jsonl")
    wrapper = {"kind": "wrapper", "id": "synthetic"}
    last = ledger.append("run_synthetic", wrapper, "run.started", {"command": "", "agent": ""})
    if text is not None:
        last = ledger.append(
            "run_synthetic",
            {"kind": "agent", "id": "synthetic"},
            "agent.claim",
            {"claim_id": "claim_1", "kind": "completion", "text": text, "criterion_ids": []},
        )
    ledger.append("run_synthetic", wrapper, "run.finished", {"exit_code": 0, "last_hash": last["hash"]})
    events = ledger.read()
    original = ledger.path.read_bytes()

    doc = build(events, build_manifest(events, {}))

    assert doc["claims"] == (
        []
        if text is None
        else [{"claim_id": "claim_1", "text": text, "criterion_ids": [], "finding": "claim_unwitnessed"}]
    )
    assert doc["verified"] is False and doc["integrity"] == "hash-only"
    assert doc["review_required"] is True
    assert ledger.path.read_bytes() == original
    assert doc["headline"] == (
        ["Here's what this run actually proves."]
        if text is None
        else ["Your agent made recorded claims.", "Here's what's actually proven."]
    )
