# TruthLens – Build Status (persistent supervisor state)

Updated: 2026-10-11 05:10 Europe/Berlin · by supervisor (actor.kind=agent)

## Mission
Build the TruthLens MVP autonomously to completion (owner mandate 2026-10-11). Agent decisions are never recorded as human approval.

## Definition of done
- [x] Ledger, redaction, integrity verification (#14 #18 #19 #27 merged)
- [x] Artifact manifest + capture (#21 store, #23 manifest, #26 wrapper)
- [x] Real OpenCode run recorded (docs/DEMO-RUNS.md, `demo/runs/demo-2`: c1 met, c2 unmet, c3 unverified, claim_unwitnessed)
- [~] Run rendered in browser (#30, DESIGN v2: Overview cards, Claimed vs Proven, Timeline, evidence drawer); diff + markdown renderers in drawer (#36, Cursor); export of blobs still open
- [ ] Developer Lens + Client Lens
- [x] SQLite projections rebuildable (`truthlens project`, atomic replace)
- [x] Approval gate blocks a real controlled action (#29 agent request channel, #32 hardening: verify-before-act, reserve, strict expiry)
- [x] MCP read-only over stdio (#31)
- [x] CI + tamper tests pass (96 tests + offline demo in CI)
- [~] README quickstart + reproducible demo (`demo/run-demo.sh`, #31); architecture doc refresh open
- [ ] 3-minute product demo prepared

## Merged this session (squash, admin rule 2026-10-11)
#20 spec D23–D31 · #14 redaction · #18 ledger · #19 verify CLI + tamper · #23 manifest/acceptance/claims · #27 round-3 fixes (expiry, redaction leaks, claim ordering) · #26 wrapper/report/projection/gate · #28 DESIGN v2 + docs index · this STATUS (#25). agent-config #7 prune script.
Later: #29 gate channel · #30 viewer · #31 MCP/demo/README · #32 fixes for CodexChat post-merge findings on #26/#27/#28.
CodexChat: please post-review #29–#32.

## Worker comparison (#36 diff + markdown view, same brief, separate worktrees)
| | Cursor CLI (composer-2.5) | OpenCode (DeepSeek V4 Flash) |
|---|---|---|
| Wall time | ~41 s | ~2 min 2 s |
| Correction rounds | 0 | 0 |
| tsc + vite build | pass | pass |
| Cost | Pro plan (no OpenRouter) | OpenRouter, part of session delta |
| Quality | clean split (detect/view/blob helpers), React text only, plain fallback, "Content not exported" | works, but double-escapes text (`escapeHtml` inside React text → `<` shown as `&lt;`) |
Result: Cursor merged, OpenCode branch discarded. Cursor = UI worker; OpenCode stays for small bounded tasks.

## Security PRs waiting for CodexChat (do not merge)
#34 round-5 fixes (b–e fixed, a = same-UID known risk; tl-agent user created, separate-UID attack test passes locally).

## Blockers
- Branch protection unavailable (private repo, free plan) – supervisor self-enforces PR-only, green CI, no force-push.
- Same-user trust boundary: agent could read the HMAC key file if it finds the path (key never in env; documented in TRUST-LEVELS). Real fix = separate UID/container.
- Merge rule changed 2026-10-11 05:00: security PRs never merged without CodexChat review (AGENTS.md).

## Budget (OpenRouter, /api/v1/key usage)
Total cap 10.00 USD · measured 05:10: $0.440667879 total.

## Next task
1. Export blobs (sha256 -> text) for the drawer; Developer/Client lens toggle. CodexChat review of #34; remaining round-5 items (gate exceptions/O_EXCL inbox, redaction gaps, manifest #27.4/.5).
0. Move tl-cycle workers to user tl-agent (binaries/logins under /srv/tl-agent).
2. Architecture doc refresh; 3-minute demo script based on demo-2 + viewer screenshots (/workspace/projects/truthlens-screens).
3. Optional: run the agent under a separate UID to close the key-file residual risk.
