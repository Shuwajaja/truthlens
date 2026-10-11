# TruthLens – Build Status (persistent supervisor state)

Updated: 2026-10-11 04:40 Europe/Berlin · by supervisor (actor.kind=agent)

## Mission
Build the TruthLens MVP autonomously to completion (owner mandate 2026-10-11). Agent decisions are never recorded as human approval.

## Definition of done
- [x] Ledger, redaction, integrity verification (#14 #18 #19 #27 merged)
- [x] Artifact manifest + capture (#21 store, #23 manifest, #26 wrapper)
- [x] Real OpenCode run recorded (docs/DEMO-RUNS.md, `demo/runs/demo-2`: c1 met, c2 unmet, c3 unverified, claim_unwitnessed)
- [ ] Markdown, diffs, tests, evidence rendered in browser (Week 3, DESIGN.md v2)
- [ ] Developer Lens + Client Lens
- [x] SQLite projections rebuildable (`truthlens project`, atomic replace)
- [~] Approval gate blocks a real controlled action (`truthlens act/approve`, tested; not yet an agent-side request channel inside `truthlens run`)
- [ ] MCP read-only over stdio
- [x] CI + tamper tests pass (84 tests)
- [ ] README, architecture, reproducible demo
- [ ] 3-minute product demo prepared

## Merged this session (squash, admin rule 2026-10-11)
#20 spec D23–D31 · #14 redaction · #18 ledger · #19 verify CLI + tamper · #23 manifest/acceptance/claims · #27 round-3 fixes (expiry, redaction leaks, claim ordering) · #26 wrapper/report/projection/gate · #28 DESIGN v2 + docs index · this STATUS (#25). agent-config #7 prune script.
CodexChat: please post-review #26, #27, #28 (findings → follow-up PRs).

## Blockers
- Branch protection unavailable (private repo, free plan) – supervisor self-enforces PR-only, green CI, no force-push.
- Same-user trust boundary: agent could read the HMAC key file if it knows the path (documented limitation; key kept outside the fixture and child env).

## Budget (OpenRouter, /api/v1/key usage)
Total cap 10.00 USD · usage 2026-10-11 04:40: $0.3655 (session start $0.3468)

## Next task
1. Gate as agent-side request channel during `truthlens run` (wrapper executes approved actions).
2. Week 3 viewer per DESIGN.md v2 reading `projection.sqlite` (Overview, Claimed vs Proven, Timeline).
3. MCP read-only server over stdio; README + reproducible demo script around `demo/make-fixture.sh`.
