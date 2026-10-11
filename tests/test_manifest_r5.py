"""CodexChat round-5 #27.4/#27.5 (manifest)."""
import pytest

from tests.test_manifest import AG, W, demo_events, ev
from truthlens.manifest import build_manifest, check_manifest, claims


def test_27_4_claim_on_proposed_or_non_completion_is_not_supported():
    e = demo_events()[:-2]
    e += [ev(20, W, "test.reported", {"suite": "s", "passed": 1, "failed": 0, "criterion_ids": ["c2"]}),
          ev(21, AG, "agent.claim", {"claim_id": "k3", "text": "c2 done", "criterion_ids": ["c2"]}),
          ev(22, AG, "agent.claim", {"claim_id": "k4", "kind": "opinion", "text": "c1", "criterion_ids": ["c1"]})]
    f = {c["claim_id"]: c["finding"] for c in claims(e)}
    assert f["k3"] == "claim_unwitnessed" and f["k4"] == "claim_unwitnessed"


def test_27_5_no_run_finished_and_agent_mismatch():
    e = demo_events()[:-1] + [ev(30, W, "ledger.repaired", {})]
    with pytest.raises(ValueError):
        build_manifest(e, {"name": "a"})
    e = [ev(0, W, "run.started", {"agent": "opencode"}), *demo_events()]
    assert "agent differs from run.started" in check_manifest(build_manifest(e, {"name": "evil"}), e)
