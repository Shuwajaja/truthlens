"""CodexChat round-5 #27.4/#27.5 (manifest)."""
import pytest

from tests.test_manifest import AG, W, demo_events, ev
from truthlens.manifest import build_manifest, check_manifest, claims


def test_27_4_claim_on_proposed_or_non_completion_is_not_supported():
    e = demo_events()[:-2]
    e += [ev(20, W, "test.reported", {"suite": "s", "passed": 1, "failed": 0, "criterion_ids": ["c2"]}),
          ev(21, AG, "agent.claim", {"kind": "completion", "claim_id": "k3", "text": "c2 done", "criterion_ids": ["c2"]}),
          ev(22, AG, "agent.claim", {"claim_id": "k4", "kind": "opinion", "text": "c1", "criterion_ids": ["c1"]})]
    f = {c["claim_id"]: c["finding"] for c in claims(e)}
    assert f["k3"] == "claim_unwitnessed" and f["k4"] == "claim_unwitnessed"


def test_27_5_no_run_finished_and_agent_mismatch():
    e = demo_events()[:-1] + [ev(30, W, "ledger.repaired", {})]
    with pytest.raises(ValueError):
        build_manifest(e, {"name": "a"})
    e = [ev(0, W, "run.started", {"agent": "opencode"}), *demo_events()]
    assert "agent differs from run.started" in check_manifest(build_manifest(e, {"name": "evil"}), e)


def test_27_review_kindless_claim_empty_agent_and_bad_agent_type():
    e = demo_events()[:-2] + [ev(40, AG, "agent.claim", {"claim_id": "k5", "text": "c1", "criterion_ids": ["c1"]})]
    assert {c["claim_id"]: c["finding"] for c in claims(e)}["k5"] == "claim_unwitnessed"
    e = [ev(0, W, "run.started", {"agent": ""}), *demo_events()]
    assert "agent differs from run.started" in check_manifest(build_manifest(e, {"name": "evil"}), e)
    m = build_manifest(e, {"name": ""})
    m["agent"] = "evil"
    assert "manifest agent must be an object" in check_manifest(m, e)


def test_r6_swapped_blob_bytes_do_not_verify(tmp_path):
    import shutil
    from pathlib import Path

    from truthlens.cli import _verified_dir
    src = Path(__file__).parent.parent / "demo" / "runs" / "demo-2"
    shutil.copytree(src, tmp_path / "d")
    ok, errs = _verified_dir(str(tmp_path / "d"), None)
    assert ok is not None, errs
    for blob in [p for p in (tmp_path / "d" / "blobs").rglob("*") if p.is_file()]:
        orig = blob.read_bytes()
        blob.write_bytes(b"forged artifact")
        ok, errs = _verified_dir(str(tmp_path / "d"), None)
        assert ok is None and errs, blob.name
        blob.write_bytes(orig)
