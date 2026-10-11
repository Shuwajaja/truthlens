from truthlens.manifest import acceptance, build_manifest, check_manifest, claims

W, H, AG = {"kind": "wrapper", "id": "w"}, {"kind": "human", "id": "u"}, {"kind": "agent", "id": "a"}


def ev(i, actor, t, p):
    return {"id": f"evt_{i}", "run_id": "run_1", "actor": actor, "type": t, "payload": p, "hash": f"h{i}"}


def demo_events():
    return [
        ev(1, H, "criterion.recorded", {"criterion_id": "c1", "text": "page exists", "source": "user"}),
        ev(2, AG, "criterion.recorded", {"criterion_id": "c2", "text": "email validated", "text_sha256": "t2",
                                         "source": "derived", "derived_by": AG}),
        ev(3, AG, "criterion.recorded", {"criterion_id": "c3", "text": "mobile ok", "text_sha256": "t3",
                                         "source": "derived", "derived_by": AG}),
        ev(4, H, "criteria.confirmed", {"criteria": [{"criterion_id": "c3", "text_sha256": "t3"}]}),
        ev(5, W, "test.reported", {"suite": "s", "passed": 2, "failed": 0, "criterion_ids": ["c1"]}),
        ev(6, W, "test.reported", {"suite": "s", "passed": 0, "failed": 0, "skipped": 3, "criterion_ids": ["c3"]}),
        ev(7, AG, "test.reported", {"suite": "fake", "passed": 9, "failed": 0, "criterion_ids": ["c3"]}),
        ev(8, AG, "agent.claim", {"kind": "completion", "claim_id": "k1", "text": "all done", "criterion_ids": ["c1", "c3"]}),
        ev(9, AG, "agent.claim", {"kind": "completion", "claim_id": "k2", "text": "done", "criterion_ids": []}),
        ev(10, W, "artifact.recorded", {"artifact_id": "art_1", "path": "index.html", "sha256": "a" * 64}),
        ev(11, W, "run.finished", {"exit_code": 0, "status": "ok", "last_hash": "h10"}),
    ]


def test_acceptance_rules():
    st = {a["criterion_id"]: a["status"] for a in acceptance(demo_events())}
    # c2 derived+unconfirmed -> proposed; c3 skipped-only + agent self-report -> unverified
    assert st == {"c1": "met", "c2": "proposed", "c3": "unverified"}


def test_claims_need_witness_for_every_criterion():
    f = {c["claim_id"]: c["finding"] for c in claims(demo_events())}
    assert f == {"k1": "claim_unwitnessed", "k2": "claim_unwitnessed"}


def test_manifest_bound_to_ledger():
    evs = demo_events()
    m = build_manifest(evs, {"name": "opencode"})
    assert m["ledger_last_hash"] == "h11" and check_manifest(m, evs) == []
    m["artifacts"][0]["path"] = "evil.html"
    m["acceptance"][1]["status"] = "met"
    assert len(check_manifest(m, evs)) == 2
    assert check_manifest(build_manifest(evs, {}), evs[:-1])  # truncated ledger


def test_claim_judged_by_witness_after_it():
    evs = [ev(1, H, "criterion.recorded", {"criterion_id": "c1", "text": "x", "source": "user"}),
           ev(2, AG, "agent.claim", {"kind": "completion", "claim_id": "k1", "text": "done", "criterion_ids": ["c1"]}),
           ev(3, W, "test.reported", {"suite": "s", "passed": 1, "failed": 0, "criterion_ids": ["c1"]})]
    assert claims(evs)[0]["finding"] == "supported"
    evs.append(ev(4, W, "test.reported", {"suite": "s", "passed": 0, "failed": 1, "criterion_ids": ["c1"]}))
    assert claims(evs)[0]["finding"] == "claim_unwitnessed"
