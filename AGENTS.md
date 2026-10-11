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
- PRs touching specs, ledger, redaction or approval gate get `needs-codex-review`. Since 2026-10-11 (owner rule) the admin may merge them once all known findings are fixed with targeted tests and CI is green; CodexChat reviews additionally, findings go into follow-up PRs.

## Secrets
Never write secrets/keys/tokens to files, logs, commits, prompts or test fixtures. Use env vars; use fake values like `sk-test-...` in tests.

## Skills & design
- Python work: `.agents/skills/python-conventions.md`.
- UI work (viewer, mockups, page): `DESIGN.md` first, then `.agents/skills/no-slop-ui/`, final check `.agents/skills/web-interface-review.md`. Vetting record: `.agents/skills/README.md`.
- Demo golden path: `docs/DEMO-TASK.md`.

## Repo hygiene
- No prompts, task files, run logs or interim reports in the repo. They stay in `/workspace/projects/truthlens-runs/` (outside the repo). Exception: deliberately published demo ledgers under `demo/runs/`.
- Decisions go into the specs as D-numbers, not into new files. New living docs must be added to `docs/README.md`.
- Old run dirs: `agent-config/scripts/tl-prune-runs.sh` (manual, not scheduled).
