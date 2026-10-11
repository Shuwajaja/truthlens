# AGENTS.md – rules for coding agents (OpenCode, Codex, Hermes)

## Contracts (FROZEN, do not change without a decision record)
- `docs/spec/event-schema-v1.md` (decisions D1–D22), `docs/spec/artifact-manifest-v1.md`, `docs/TRUST-LEVELS.md`.
- Key rules: canonical JSON, no floats; plain `[REDACTED]` before hashing; hash chain by `seq`; fail-closed verify; single writer + fsync; payload ≤ 64 KiB; `approval.granted` / `criteria.confirmed` only by `actor.kind = human`.

## Definition of Done
See `docs/STATUS.md` (MVP checklist). No mock-only feature counts as done.

## Never claim, always witness
Do not state results you did not produce and check. "Tests pass" means you ran the test command and saw it pass. Agent decisions are `actor.kind = agent`, never human approval; simulated approvals are labelled `simulated`.

## Tests
Lean: only tests that guard an acceptance criterion (ledger, tamper, crash, redaction, approval gate, …). No test bloat. Run the issue's `Test command:` locally; full suite runs in CI.

## Branches & PRs
- Branch `w<N>/issue-<n>-<slug>`; one issue per branch/worktree; only touch the issue's `Allowed paths:`.
- PR to `main` only, squash merge after green CI. No force-push, no direct push to `main`.
- PRs touching specs, ledger, redaction or approval gate get `needs-codex-review` and wait for an independent review.

## Secrets
Never write secrets/keys/tokens to files, logs, commits, prompts or test fixtures. Use env vars; use fake values like `sk-test-...` in tests.
