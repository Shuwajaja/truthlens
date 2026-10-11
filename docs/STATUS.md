# TruthLens – Build Status (persistent supervisor state)

Updated: 2026-10-11 03:45 Europe/Berlin · by supervisor (actor.kind=agent)

## Mission
Build the TruthLens MVP autonomously to completion (owner mandate 2026-10-11). Agent decisions are never recorded as human approval.

## Definition of done
- [ ] Ledger, redaction, integrity verification (PRs #14/#18/#19 open, waiting for independent review)
- [ ] Artifact manifest + capture (blob store merged #21; manifest + wrapper next)
- [ ] Real OpenCode run recorded
- [ ] Markdown, diffs, tests, evidence rendered in browser
- [ ] Developer Lens + Client Lens
- [ ] SQLite projections rebuildable
- [ ] Approval gate blocks a real controlled action
- [ ] MCP read-only over stdio
- [ ] CI + tamper tests pass (tamper suite in #19, green in CI)
- [ ] README, architecture, reproducible demo
- [ ] 3-minute product demo prepared

## Milestones done
- [x] Preflight · Schema freeze v1 (#9, #11) · CI (#10) · canonical JSON (#12) · AGENTS.md (#15) · UI-CONCEPT (#16) · skills/DESIGN.md/demo task (#17) · evidence store (#21)

## Review gate (needs-codex-review: merge only after independent review comment, findings addressed)
- #14 redaction – review findings 1–5 addressed (3d35c3d, 1a4bf19), waiting for re-review
- #20 spec fixes D23–D29 (post-review of #9/#11) – waiting for review
- #18 ledger-core (stacked on #14, enforces D23–D25/D28) – waiting
- #19 verify-cli + tamper/crash tests (stacked on #18) – waiting
Merge order: #20 → #14 → #18 (merge main in) → #19.

## Blockers
- Branch protection unavailable (private repo, free plan) – supervisor self-enforces PR-only, green CI, no force-push.
- Critical path waits for independent review.

## Budget (OpenRouter, measured via /api/v1/key usage)
Total cap 10.00 USD · usage 2026-10-11 03:45: $0.1289 · this session spent $0.00 (cap 2.50)

## Next task
After reviews: merge chain, then W2 manifest builder + process wrapper (git diff before/after, command + test witnessing, real OpenCode run).
