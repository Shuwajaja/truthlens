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
- **Security review rule (owner, binding since 2026-10-11 05:00):** any PR touching `gate.py`, `ledger.py`, `redaction.py`, `wrapper.py`, `manifest.py` or anything HMAC gets `needs-codex-review` (set automatically by `tl-cycle.sh` from a fixed path list, not by a model) and is **never merged without CodexChat's review**. Other low-risk PRs: merge after green CI + admin diff check.
- Acceptance criteria are fixed in the issue before the run; the issue's test command is the deterministic check.

## Worker roles
| Role | Who | Does | Never |
|---|---|---|---|
| Plan / label / QA comments | Hermes (DeepSeek V4 Flash) | cuts issues, proposes `worker:opencode` or `worker:cursor`, comments QA | starts workers, approves alone |
| Small bounded tasks | OpenCode (DeepSeek) | docs, single functions, tests | — |
| UI tasks | Cursor CLI (composer-2.5, owner's Pro plan) | `viewer/` work only | security paths (script refuses) |
| Mandatory security review | CodexChat | reviews every `needs-codex-review` PR | — |
| Supervise / verify / merge | Admin | runs `tl-cycle.sh`, checks diffs, merges non-security PRs | merges security PRs without CodexChat |

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

## Docs rules
- Docs are updated in the same PR as the code they describe.
- `docs/STATUS.md` is the only status file; do not add other status/progress files.
