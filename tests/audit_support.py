"""Small real signed ledgers; no fake hash chain or historical re-signing."""

import hashlib
import json
from pathlib import Path

from truthlens.ledger import GENESIS, Ledger
from truthlens.manifest import build_manifest
from truthlens.store import BlobStore

TEST_KEY = b"sk-test-audit-only"
HUMAN = {"kind": "human", "id": "test-human"}
WRAPPER = {"kind": "wrapper", "id": "test-wrapper"}
AGENT = {"kind": "agent", "id": "test-agent"}
RUN_ID = "run_" + "0" * 25 + "1"


def make_run(root: Path, *, key=TEST_KEY, tests=None, claims=None, criteria=None) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    ledger = Ledger(root / "ledger.jsonl", key, "test-key" if key is not None else None)
    store = BlobStore(root / "blobs")

    def append(actor, kind, p):
        return ledger.append(RUN_ID, actor, kind, p)

    append(WRAPPER, "run.started", {"agent": "test-agent"})
    append(HUMAN, "requirement.recorded", {"requirement_id": "r1", "text": "Fixture requirement"})
    for criterion in (
        [{"criterion_id": "c1", "text": "Fixture criterion", "source": "user"}]
        if criteria is None
        else criteria
    ):
        actor = HUMAN if criterion.get("source") == "user" else AGENT
        append(actor, "criterion.recorded", criterion)
    tests = (
        [{"passed": 1, "failed": 0, "skipped": 0, "exit_code": 0, "criterion_ids": ["c1"]}]
        if tests is None
        else tests
    )
    for entry in tests:
        p = dict(entry)
        suite = p.setdefault("suite", "fixture-test")
        report = p.pop(
            "_report", "$ " + suite + "\nexit " + str(p.get("exit_code", 0)) + "\nfixture output\n"
        )
        p["report_artifact_id"] = store.put(report.encode())
        append(WRAPPER, "test.reported", p)
    for entry in (
        [{"claim_id": "k1", "kind": "completion", "text": "Fixture claim", "criterion_ids": ["c1"]}]
        if claims is None
        else claims
    ):
        append(AGENT, "agent.claim", entry)
    previous = ledger.read()[-1]["hash"] if ledger.read() else GENESIS
    append(WRAPPER, "run.finished", {"last_hash": previous, "exit_code": 0})
    events = ledger.read()
    # Legacy projection cannot interpret malformed test counters; keep those attack
    # inputs signed, but use a structurally complete manifest for the auditor to reject.
    try:
        manifest = build_manifest(events, {"name": "test-agent"})
    except TypeError:
        manifest = {
            "manifest_version": 1,
            "run_id": RUN_ID,
            "ledger_last_hash": events[-1]["hash"],
            "agent": {"name": "test-agent"},
            "artifacts": [],
            "acceptance": [],
        }
    (root / "manifest.json").write_text(json.dumps(manifest))
    return root


def digest_tree(root: Path) -> dict:
    return {
        str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in root.rglob("*")
        if p.is_file()
    }
