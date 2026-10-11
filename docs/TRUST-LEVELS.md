# Trust levels

| Label | Meaning |
|---|---|
| **Imported** | File was imported; its origin and execution are not independently evidenced. |
| **Integrity verified** | Hashes and existing evidence match the ledger; chain verifies. |
| **Review required** | Technical checks exist; human/domain acceptance is still open. |

Principles:
- **A valid hash does not prove the agent told the truth.** It proves the record has not changed since it was written.
- **The wrapper only witnesses what passes through it** or is explicitly handed to it. It cannot attest internal agent actions.
- "Verified" is only shown for things TruthLens observed at runtime. GitHub imports are at most "Imported".
- **Approvals must actually block.** An `approval.granted` event alone proves nothing; the gate must have prevented execution beforehand.
- **A changed action invalidates the approval** (different action hash). Approvals are single-use.
- **Timeout = deny** (`approval.expired`).
- Execution ≠ Verification ≠ Approval ≠ Acceptance.
