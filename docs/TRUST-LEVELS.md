# Trust levels

| Label | Meaning |
|---|---|
| **Imported** | File was imported; its origin and execution are not independently evidenced. |
| **Integrity verified** | Hashes and existing evidence match the ledger; chain verifies. |
| **Review required** | Technical checks exist; human/domain acceptance is still open. Orthogonal to integrity: shown alongside "Integrity verified". Client Lens shows it by default (D7). |
| **Verification failed** | Hash, chain, HMAC or anchor check failed. Never shown as verified; the failing line and reason are displayed. |

Principles:
- **Scope of proof:** TruthLens proves the integrity and provenance of what it witnessed — not the quality, correctness or completeness of the work.
- **Claimed ≠ witnessed.** An `agent.claim` ("all tests green") is shown as a claim; only wrapper-produced `test.reported`/evidence counts. Unwitnessed claims are flagged.
- **A valid hash does not prove the agent told the truth.** It proves the record has not changed since it was written.
- **The wrapper only witnesses what passes through it** or is explicitly handed to it. It cannot attest internal agent actions.
- "Verified" is only shown for things TruthLens observed at runtime. GitHub imports are at most "Imported".
- **Approvals must actually block.** An `approval.granted` event alone proves nothing; the gate must have prevented execution beforehand.
- **A changed action invalidates the approval** (different action hash). Approvals are single-use.
- **Timeout = deny** (`approval.expired`).
- Execution ≠ Verification ≠ Approval ≠ Acceptance.

## Lenses
- **Client Lens (primary):** plain language per request/criterion — "You asked for X — done, witnessed by Y", "claimed, not witnessed", "not done", "review required".
- **Developer Lens (detail):** events, hashes, diffs, logs, verification output.
