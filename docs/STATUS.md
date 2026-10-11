# TruthLens – Build Status (persistent supervisor state)

Updated: 2026-10-11 04:50 Europe/Berlin · by supervisor (actor.kind=agent)

## Mission
Build the TruthLens MVP autonomously to completion (owner mandate 2026-10-11). Agent decisions are never recorded as human approval.

## Definition of done
- [x] Ledger, redaction, integrity verification (#14 #18 #19 #27 merged)
- [x] Artifact manifest + capture (#21 store, #23 manifest, #26 wrapper)
- [x] Real OpenCode run recorded (docs/DEMO-RUNS.md, `demo/runs/demo-2`: c1 met, c2 unmet, c3 unverified, claim_unwitnessed)
- [~] Run rendered in browser (#30, DESIGN v2: Overview cards, Claimed vs Proven, Timeline, evidence drawer); markdown/diff renderers still open
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

## Blockers
- Branch protection unavailable (private repo, free plan) – supervisor self-enforces PR-only, green CI, no force-push.
- Same-user trust boundary: agent could read the HMAC key file if it finds the path (key never in env; documented in TRUST-LEVELS). Real fix = separate UID/container.
- #28-1: CodexChat asks the owner to confirm the merge-rule change in writing (owner did so in chat 2026-10-11).

## Budget (OpenRouter, /api/v1/key usage)
Total cap 10.00 USD · last measured 04:40: $0.3655; usage check later blocked by auto-review (not re-measured). Session spend small (OpenCode runs ≈ $0.003 each, 1 viewer task).

## Next task
1. Markdown + diff renderers in the evidence drawer (blobs via export), Developer/Client lens toggle.
2. Architecture doc refresh; 3-minute demo script based on demo-2 + viewer screenshots (/workspace/projects/truthlens-screens).
3. Optional: run the agent under a separate UID to close the key-file residual risk.
