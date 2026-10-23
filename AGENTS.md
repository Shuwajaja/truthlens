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

## Branches & PRs — standing owner authorization (2026-10-23)
The owner's request to loosen repository rules and avoid constant supervision supersedes the earlier per-PR Shu OK and named-person CodexChat waiting requirements. It applies to already prepared PRs as well as further work within the authorized task scope.

- Work on branches and PRs targeting `main`; bundle related changes into independent PRs. No direct push to `main`, force-push, or bypass of GitHub protections.
- The supervising agent may squash-merge without asking again when acceptance criteria are met, the current head has green required CI, the diff is checked, and no blocking review finding remains. Record the evidence and merge outcome. A new user constraint always takes precedence.
- Security-sensitive changes (`gate.py`, `ledger.py`, `redaction.py`, `wrapper.py`, `manifest.py`, HMAC) retain the `needs-codex-review` classification and require an independent Codex review. A separate capable subagent may perform that review automatically; the author may not approve its own security change. Existing independent reviews can be reused for unchanged code, with scoped review for fixes. Record reviewer findings, their resolution and the reviewed code in the PR description or linked evidence. No separate manual CodexChat appointment or user acknowledgment is required.
- Small documentation/routine changes need a diff check and relevant checks, not an extra approval ceremony. Use inexpensive subagents for bounded tasks; use a stronger reviewer only when complexity or security warrants it.
- Ask only when a material requirement cannot be inferred, a new cost or external commitment is needed, or an action exceeds the authorization below. Do not ask again for already authorized implementation, fixes, review, PR creation or qualifying merges.
- Local-first remains binding. Public deployments, changes to live VPS services/users/permissions/keys, destructive cleanup, and sensitive-data migration require separate explicit authorization. A repository merge does not authorize deployment or activation.
- Repository workflow permission never creates product-level human approval: `approval.granted` and `criteria.confirmed` still obey the frozen actor/signature rules. Do not relax those controls or label an agent's action as a human event.
- Fix acceptance criteria before implementation in the issue or explicit user task; keep validation proportional to those criteria.

## Worker roles
| Role | Who | Does | Never |
|---|---|---|---|
| Plan / label / QA comments | Hermes (DeepSeek V4 Flash) | cuts issues, proposes `worker:opencode` or `worker:cursor`, comments QA | starts workers, approves alone |
| Small bounded tasks | Inexpensive Codex subagent | docs, single functions, focused tests | expands scope or invents results |
| UI tasks | Cursor CLI (composer-2.5, owner's Pro plan) | `viewer/` work only | security paths (script refuses) |
| Mandatory security review | Independent Codex reviewer/subagent | reviews security changes and scoped fixes; records evidence | approves its own implementation |
| Supervise / verify / merge | Supervising agent | checks diffs, current-head CI and reviews; merges under standing authorization | bypasses protections, unresolved findings or operational limits |

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
7. **Operational limits:** use the standing merge authorization above. Do not restart live services, perform destructive cleanup, or expose secrets without the separately required authorization; never print secrets.

## Repo hygiene
- No prompts, task files, run logs or interim reports in the repo. They stay in `/workspace/projects/truthlens-runs/` (outside the repo). Exceptions: deliberately published demo ledgers under `demo/runs/`, and published UI screenshots and axe summaries under `docs/screenshots/<branch>/`.
- Decisions go into the specs as D-numbers, not into new files. New living docs must be added to `docs/README.md`.
- Old run dirs: `agent-config/scripts/tl-prune-runs.sh` (manual, not scheduled).

## Docs rules
- Docs are updated in the same PR as the code they describe.
- `docs/STATUS.md` is the only status file; do not add other status/progress files.
