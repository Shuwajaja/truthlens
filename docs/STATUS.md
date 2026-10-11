# TruthLens – Build Status (persistent supervisor state)

Updated: 2026-10-11 10:30 Europe/Berlin · by supervisor (actor.kind=agent)

## Mission
Build the TruthLens MVP autonomously to completion (owner mandate 2026-10-11). Agent decisions are never recorded as human approval.

## Definition of done
- [x] Ledger, redaction, integrity verification (#14 #18 #19 #27 merged)
- [x] Artifact manifest + capture (#21 store, #23 manifest, #26 wrapper)
- [x] Real OpenCode run recorded (docs/DEMO-RUNS.md, `demo/runs/demo-2`: c1 met, c2 unmet, c3 unverified, claim_unwitnessed)
- [x] Run rendered in browser (#30, DESIGN v2: Overview cards, Claimed vs Proven, Timeline, evidence drawer); diff + markdown renderers in drawer (#37, Cursor); blob content export (#41); MVP viewer issues #57–#61 done 08:35 (status counts, claims, drawer markdown emphasis, review hint, "Verification failed" state) – checked in headless Chromium against demo-2/demo-1 exports
- [x] Developer Lens + Client Lens (toggle, default Client, #47, Cursor worker)
- [x] SQLite projections rebuildable (`truthlens project`, atomic replace)
- [x] Approval gate blocks a real controlled action (#29 agent request channel, #32 hardening: verify-before-act, reserve, strict expiry)
- [x] MCP read-only over stdio (#31); same statuses as export, `integrity` hmac / hash-only (no key → `verified:false`) / failed (#63, PR #76)
- [x] CI + tamper tests pass (99 tests + offline demo in CI)
- [~] README quickstart + reproducible demo (`demo/run-demo.sh`, #31); quickstart verified in a fresh clone + gated by CI (#69 closed); offline demo deterministic in CI (#67 closed); README wording PR #77 (#68) **waits for Shu's review**
- [ ] 3-minute product demo prepared

## MVP spec
`docs/MVP-SPEC.md` approved by Shu 06:37 (#54) and **frozen**, target date **2026-10-25**; new ideas go to the post-v1 list. Accepted v1 limit: app code forging the test result inside the test process (#55).

## Session 10:10–10:30 (MCP + demo/README issues, OpenCode as tl-agent via tl-cycle.sh)
| Issue | Result |
|---|---|
| #63 MCP status = viewer, integrity | PR #76 merged (mcp.py only: `integrity` hmac/hash-only/failed; no key → `verified:false`; 3 acceptance tests). 1 correction loop (ruff), Hermes QA PASS |
| #67 offline demo deterministic in CI | already met on main – two local runs identical statuses, CI log checked, no key; closed without PR |
| #69 reproducible quickstart | already met on main – fresh `gh repo clone` + venv + offline demo + viewer build exit 0; CI step guards it; closed without PR |
| #68 README tagline/promise/no fake claims | PR #77 open, CI green, Hermes QA PASS – **not merged: needs Shu's review** (criterion 4) |

Infra note: `tl-cycle.sh` `chmod -R g+w` on the week folder (`/srv/tl-agent/wt/w5`) drops its setgid bit (box is not in group tl-agent), so a 2nd OpenCode run in the same week folder gets a worktree tl-agent cannot write (one #68 run failed 3× "no changes"). Workaround used: remove the empty week folder between runs. Fix in agent-config pending.

## Session 08:16–08:35 (viewer MVP issues, Cursor composer-2.5 via tl-cycle.sh)
| Issue | Result |
|---|---|
| #57 Overview status counts | PR #72 merged ("1 met, 1 unmet, 1 unverified", no %) |
| #58 Claimed vs Proven | already met on main – verified, closed without PR |
| #59 Drawer diff/markdown | PR #73 merged (inline *em*/**strong** in MarkdownView) |
| #60 Review required hint | already met on main – verified, closed without PR |
| #61 Verification failed | PR #74 merged (`validateRunDoc`: verified flag + status/card/count consistency, fail-closed) |

All: 0 correction loops, Hermes QA PASS (advisory), `npm run build` exit 0, CI green. Note: a doc that is forged *consistently* can still not be detected by the browser alone (viewer trusts `truthlens export`).

## Merged earlier (squash, admin rule 2026-10-11)
#20 spec D23–D31 · #14 redaction · #18 ledger · #19 verify CLI + tamper · #23 manifest/acceptance/claims · #27 round-3 fixes (expiry, redaction leaks, claim ordering) · #26 wrapper/report/projection/gate · #28 DESIGN v2 + docs index · this STATUS (#25). agent-config #7 prune script.
Later: #29 gate channel · #30 viewer · #31 MCP/demo/README · #32 fixes for CodexChat post-merge findings on #26/#27/#28 · #37 drawer diff/markdown · #38 manifest round-5 · #41 blob export · #47 lens toggle + ARCHITECTURE · #53 README wording + AGENTS docs rules · #54 MVP-SPEC v1 · #55 met definition + v1 limit · #72 #73 #74 viewer MVP · #76 MCP integrity.

## Worker comparison (#36 diff + markdown view, same brief, separate worktrees)
| | Cursor CLI (composer-2.5) | OpenCode (DeepSeek V4 Flash) |
|---|---|---|
| Wall time | ~41 s | ~2 min 2 s |
| Correction rounds | 0 | 0 |
| tsc + vite build | pass | pass |
| Cost | Pro plan (no OpenRouter) | OpenRouter, part of session delta |
| Quality | clean split (detect/view/blob helpers), React text only, plain fallback, "Content not exported" | works, but double-escapes text (`escapeHtml` inside React text → `<` shown as `&lt;`) |
Result: Cursor merged, OpenCode branch discarded. Cursor = UI worker; OpenCode stays for small bounded tasks.

## Security stack: merged (2026-10-11 ~16:50)
CodexChat approved the stack #34 → #40 → #42 → #43 → #45 → #46 (head 5f0eb6f). It was merged top-down with merge commits after main was merged into the top branch (conflicts in mcp/wrapper/TRUST-LEVELS resolved, CI green). Merge commit on main: 6e01556. New follow-up: #83 (separate `-c <path>` / `--config-file` in the gate, post-v1). Older follow-ups: #48–#52.

## Demo-2 rerun (2026-10-11)
Real OpenCode (DeepSeek V4 Flash) via `demo/run-demo.sh` on the merged main, run as the box user (not tl-agent). Verify OK (16 events, anchored, manifest consistent). c1 met, c2 unmet, c3 unverified; 1 claim supported, 2 claims unwitnessed. The tamper copy fails closed (hash + HMAC mismatch on line 15). Committed to `demo/runs/demo-2`.

## Worker isolation
- OpenCode worker runs as unix user `tl-agent` (agent-config #9): own binary/config under `/srv/tl-agent`, OpenRouter key only in that process from a 600 file owned by tl-agent, worktree under `/srv/tl-agent/wt`. tl-agent cannot read `/home/box` (HMAC key, gh, ~/.cursor) or `/workspace/projects`.
- Cursor still runs as the box user (Shu's token not copied) and is restricted to `viewer/` by `tl-cycle.sh` → same-UID risk remains for Cursor runs.
- ruff + test command for OpenCode runs also run as tl-agent (own venv, agent-config #10).

## Blockers
- Branch protection unavailable (private repo, free plan) – supervisor self-enforces PR-only, green CI, no force-push.
- Same-user trust boundary: agent could read the HMAC key file if it finds the path (key never in env; documented in TRUST-LEVELS). Real fix = separate UID/container.
- Merge rule changed 2026-10-11 05:00: security PRs never merged without CodexChat review (AGENTS.md).

## Budget (OpenRouter, /api/v1/key usage)
Total cap 10.00 USD · measured 08:16: $0.6701 · 08:31: $0.6878 (≈ $0.018, Hermes QA only) · 10:11: $0.6878 · 10:27: $0.8037 (this session ≈ $0.116, OpenCode + Hermes QA, incl. 3 wasted attempts from the permission bug) · 16:50: $1.8188.

## Next task
1. Shu: review README PR #77 (#68).
2. Optional: demo-2 rerun as tl-agent (#62); then #64–#66, #70, #71 (need `agent-ready` + contract lines).
3. 3-minute product demo / video (still open).
