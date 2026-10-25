# AGENTS.md – repository rules for coding agents

## Contracts (FROZEN, do not change without a decision record)
- `docs/spec/event-schema-v1.md` (decisions D1–D22), `docs/spec/artifact-manifest-v1.md`, `docs/TRUST-LEVELS.md`.
- Key rules: canonical JSON, no floats; plain `[REDACTED]` before hashing; hash chain by `seq`; fail-closed verify; single writer + fsync; payload ≤ 64 KiB; `approval.granted` / `criteria.confirmed` only by `actor.kind = human`.

## Definition of Done
See `docs/STATUS.md` (MVP checklist). No mock-only feature counts as done.

## Never claim, always witness
Do not state results you did not produce and check. "Tests pass" means you ran the test command and saw it pass. Agent decisions are `actor.kind = agent`, never human approval; simulated approvals are labelled `simulated`. Report the tested commit or tree, actual command and observed result; distinguish passed, failed, skipped, expected failure, not run, and blocked. Mocked tests and synthetic fixtures prove only their stated test boundary, never a live service or a real user approval. Never invent counts, logs, screenshots, runs or success, suppress failures, or weaken an assertion to obtain green checks.

## Tests — fast and evidence-based (owner update, 2026-10-23)
- Run the smallest meaningful regression set covering the changed behavior and its immediate dependencies. For a bug, witness the regression fail before the fix when practical. Retain existing tests and acceptance criteria.
- Run appropriate lint/build checks once. Reuse already witnessed results for unchanged code; repeat only after relevant changes, an actual failure, or a new unresolved risk. Reviewers inspect the diff and existing evidence first, then run targeted probes only where needed. Do not repeat full suites merely for a handoff or another reviewer.
- Documentation-only edits need document/consistency checks, not unrelated application suites. CI selects affected components conservatively; unknown paths or uncertain detection must not silently skip required checks. A skipped job is not a test pass.
- Automatic PR CI stays build/lint/fast tests. Changed security code must include its relevant regression tests. Full browser matrices, separate-UID/live-service checks and long release suites run only when the changed behavior requires them or the user requests them. For UI changes, use targeted real-browser screenshots and unrestricted axe on affected states rather than repeating all historical states.
- Report actual scope and limitations: green fast CI does not mean full release, live isolation or every browser flow passed. Keep raw evidence outside the repo except the published evidence paths allowed below. Do not expand testing after the relevant checks pass without a concrete reason.

## Branches & PRs — Shu / VPSMan approval (2026-10-25)
Shu's directive of 2026-10-25 revokes the merge relaxation from TruthLens PR #164 and supersedes earlier standing merge authorization. VPSMan coordinates the work and reviews every PR.

- Work on branches and PRs targeting `main`; bundle related changes into independent PRs. No direct push to `main`, force-push, or bypass of GitHub protections.
- Coding agents never merge their own or other PRs. VPSMan reviews every PR; explicit approval from Shu/VPSMan is required. Merges use **Squash and merge** only after the required CI and review findings are resolved; coding agents do not execute the merge themselves.
- Security-sensitive changes (`gate.py`, `ledger.py`, `redaction.py`, `wrapper.py`, `manifest.py`, HMAC) retain the `needs-codex-review` classification and require an independent Codex review. The author may not approve its own security change. Record findings, resolutions and the reviewed commit in the PR.
- Before any server change, announce the exact proposed action and wait for an explicit OK from Shu/VPSMan. This includes systemd, sshd, `/etc`, containers, users, packages and deletion. Permission to edit code, commit or open a PR does not authorize these operations.
- **Agent Office is paused by Shu since 2026-10-25.** All `agent-office*` units must remain stopped and deactivated. Do not start, restart, enable, activate or otherwise run them. Preserve their code and data. Repository work and PR publication remain authorized.
- Repository workflow permission never creates product-level human approval: `approval.granted` and `criteria.confirmed` still obey the frozen actor/signature rules. Do not relax those controls or label an agent action as a human event.
- Fix acceptance criteria before implementation in the issue or explicit user task. Keep validation proportional to those criteria.

## Mandatory ECC coding workflow (owner directive, 2026-10-25)
1. **Plan:** use `ecc:plan-orchestrate` or `ecc:blueprint` as appropriate to the scope; state acceptance criteria and the affected paths before editing code.
2. **Tests first:** follow `ecc:tdd-workflow`; witness the relevant regression fail before implementation, then make it pass. Preserve existing tests and acceptance criteria.
3. **Implement:** make only the authorized changes, without bypassing server approvals or product approval gates.
4. **Review:** obtain a review of the diff and resolve blocking findings; independent security review remains mandatory for the paths above.
5. **Verify:** use `ecc:verification-loop` and report the actual checks, tested revision and limitations.
6. **E2E:** use `ecc:e2e-testing` with Playwright for affected end-to-end application/browser flows. Do not claim a browser pass for a skipped or unavailable run.

Documentation-only changes follow the document/consistency checks above; record runtime, coverage and browser checks as not applicable when no executable behavior or UI is changed. Do not manufacture application tests for prose.

## Worker roles
| Role | Who | Does | Never |
|---|---|---|---|
| Plan / label / QA comments | Hermes (DeepSeek V4 Flash) | cuts issues, proposes `worker:opencode` or `worker:cursor`, comments QA | starts workers, approves alone |
| Small bounded tasks | Inexpensive Codex subagent | docs, single functions, focused tests | expands scope or invents results |
| UI tasks | Cursor CLI (composer-2.5, owner's Pro plan) | `viewer/` work only | security paths (script refuses) |
| Mandatory security review | Independent Codex reviewer/subagent | reviews security changes and scoped fixes; records evidence | approves its own implementation |
| Supervise / verify / approve | VPSMan, with Shu | reviews every PR and required evidence; approves for squash merge | delegates merge authority to coding agents or bypasses approval |

## Secrets
Never write secrets/keys/tokens to files, logs, commits, prompts or test fixtures. Use env vars; use fake values like `sk-test-...` in tests.

## Skills & design
- Python work: `.agents/skills/python-conventions.md`.
- UI work must follow [viewer/DESIGN.md](viewer/DESIGN.md) (binding), then `.agents/skills/no-slop-ui/`, apply `.agents/skills/react-best-practices.md` to changed React code, with `.agents/skills/web-interface-review.md` as the final check. The viewer rules supersede older UI rules in root `DESIGN.md`. Vetting record: `.agents/skills/README.md`.
- Demo golden path: `docs/DEMO-TASK.md`.

## UI pipeline (binding for all UI work)
1. **Design first:** read and update `viewer/DESIGN.md` (tokens, colours, type scale) before UI code. Its honesty rules always apply: no signature verification claim unless `verified === true` and `integrity === 'hmac'`; no fake data; a neutral grey "Hash only · signature not checked" seal; "Integrity is not approval" stays visible.
2. **Components:** prefer shadcn via MCP `shadcn` and Magic UI via MCP `magicui`. Do not use Origin UI / coss code (AGPL).
3. **Review UI changes, outside automatic PR CI:** use a targeted manual headless Playwright script to capture desktop **1440×900** and mobile **390×844** screenshots. Use @axe-core/playwright during manual/release review; fix serious and critical violations. Full browser/axe runs are not automatic PR gates.
4. **Publish evidence:** attach screenshots and the axe summary to the PR description, or commit them under `docs/screenshots/<branch>/`. Identify the tested commit and viewports; report findings honestly.
5. **Local rules and checks:** follow [docs/UI-PIPELINE.md](docs/UI-PIPELINE.md), the local React/interface checklists and the pinned source/license record. No mutable upstream skill fetches or automatic installers. `npm test` retains the toolbar build matrix for manual/release review. Fast PR CI uses npx vitest run and the static lint/theme/language checks; toolbar browser verification belongs to the release workflow. Distinguish CI checks, full axe and manual review; report unresolved items.
6. **Preview feedback:** Toolbar/Comments is preview-only; no production loader. Reuse platform injection. Preview provisioning stays in `p3/pr-previews`; do not duplicate it. Keep project Preview toolbar On and Production Off; report platform access limits instead of claiming an untested live comment flow.
7. **Operational limits:** coding agents never merge. Server changes require prior announcement and explicit OK from Shu/VPSMan; Agent Office remains paused. Never print secrets.

## Repo hygiene
- No prompts, task files, run logs or interim reports in the repo. They stay in `/workspace/projects/truthlens-runs/` (outside the repo). Exceptions: deliberately published demo ledgers under `demo/runs/`, and published UI screenshots and axe summaries under `docs/screenshots/<branch>/`.
- Decisions go into the specs as D-numbers, not into new files. New living docs must be added to `docs/README.md`.
- Old run dirs: `agent-config/scripts/tl-prune-runs.sh` (manual, not scheduled).

## Docs rules
- Docs are updated in the same PR as the code they describe.
- `docs/STATUS.md` is the only status file; do not add other status/progress files.
