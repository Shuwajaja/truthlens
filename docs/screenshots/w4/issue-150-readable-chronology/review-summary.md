# Recorded Story / Timeline and review scheduling — issue150

PR149 was externally merged as mainf1f6074 during implementation. This follow-up is independent on current mainf1f6074; mode colours are already on main. No stacked PR. Before source6898fd9 (the already-verified mode-colour stage). After tested source `6ceb61e43071f0bf29c2027f9f9d86111311fc1e`, tree `5667b1b705f6acae34cc8d235186e44980e1fb29`. Later publication changes only evidence/STATUS. The source tree stayed byte-identical when reparented to the new main squash; raw reports retain their original capture HEAD and identify the tested tree. Actual run.json, frozen contracts and approval rules unchanged.

## Readability

Story and Timeline use the same actual actor and recorded-result presentation, absolute local clock with zone in JetBrains Mono, and contiguous Task/Result presentation groups. Sequence order is preserved; groups are not claimed as exported workflow phases. Real dates/observed spans label phase headers. An elapsed timestamp gap is now Gap between records; it no longer claims the agent was working. No success inferred from a claim, confirmation or run exit0. Trusted test.reported counts retain guarded success/failure colours; related criterion results and claim findings remain distinct.

Long summaries use literal excerpts and native Show full text disclosures. Explicitly SHA-referenced exported bodies use closed Recorded content disclosures in both full chronologies. The existing Overview timeline keeps its compact record actions. Complete content is escaped text in a bounded focusable pre; no guessed artifact or executable output. Mode cues, Stitch fonts/tokens and trust/approval notices remain.

## Verification actually performed

- Unit suite:277 tests/26 files passed locally; final affected snapshot/content tests22/22 passed after label punctuation. Five new behavioral tests cover phase order/absence, result-source honesty, actual actors/timestamps, exact long-text disclosure and explicit blob/missing-content lookup. Final-head full unit CI is reported in the PR.
- Lint, hard-colour/language guard,134 existing AA/UI/focus contrast pairs, TypeScript and production build pass. Existing snapshots updated for new time/actor/result rows, phase structure and exact exported text; no test file removed.
- New Python fast selection (canonical/redaction/ledger/manifest):66 tests passed in0.60s locally. The full Python/UID/demo job is preserved verbatim in the manual workflow; it was not rerun as part of fast readiness.
- Manual Playwright:8 before states and8 after states (Story/Timeline × Client/Developer ×1440×900/390×844). Each after state also opens its largest actual attached body (3863 characters), tabs to the pre and scrolls with ArrowDown:8/8 pass. No horizontal page overflow.24 images below (8 before,8 after,8 expanded).
- Unrestricted axe:8 before scans,16 after scans (8 closed +8 expanded), **zero violations and zero incomplete nodes in these scoped states**. Chromium156.0.8078.4. No filters/suppression; these targeted states are not the separate all-view/all-dialog release audit.
- Desktop Developer Timeline, mobile Client Story and expanded mobile original diff inspected. Independent React/interface/workflow review found no actionable open finding. Raw artifact text (including its historic product names/styles) stays exact; it is not invented viewer copy.

[Before browser/axe report](before/review.json) · [After collapsed/expanded browser/axe report](after/review.json)

## CI change requested by Shu

[Complete previous configuration](ci-before.yml). Previously **every push and pull_request** ran: npm test (toolbar multi-build matrix plus all Vitest units), lint/styles/language/build, Playwright screenshot review/upload; docs existence lint; Python3.12/3.13 full pytest with UID user setup and offline demo.

Now automatic PR CI and main pushes run build/lint/static colour/language/theme checks, all Vitest unit tests directly, docs lint and the66 fast Python unit tests on3.12/3.13. Feature-branch pushes no longer duplicate PR runs. Existing job names remain stable. No Playwright, screenshot, axe, toolbar build matrix, UID setup or offline demo runs automatically for a PR.

Manual `.github/workflows/release-review.yml` uses **workflow_dispatch** and preserves the previous full/review commands. It also invokes existing unrestricted axe, mode-colour/sticky-label and toolbar browser scripts, retaining partial artifacts with always() for30days. No test file or script deleted. YAML parsed and full legacy Python/UID/demo job compared byte-for-byte. The new manual workflow itself was **not dispatched**; first availability requires its presence on the default branch. Do not equate fast CI green with release validation. PR147's separate expanded axe/AX work must follow this manual scheduling policy if later integrated; it is not a dependency of this PR.

AGENTS.md, UI-PIPELINE.md, DESIGN.md and STATUS.md updated for Shu's policy. Once fast PR CI is green, report merge-ready without waiting for long suites; no agent merge. The prior mode-colour proof remains under ../issue-148-mode-colours/ as historical scoped evidence.

Limits: this is one real exported demo, two chronologies and their content disclosures; other exports, all possible drawers and spoken NVDA/VoiceOver output are not certified. No human acceptance or blanket WCAG claim. No full release run claimed. PR95 untouched.

## Screenshots

### 1440×900

| View / lens | Before | After | Expanded largest actual content |
|---|---|---|---|
| Timeline / client | [Before](before/timeline-1440-client.png) | [After](after/timeline-1440-client.png) | [Expanded](after/timeline-1440-client-expanded.png) |
| Timeline / developer | [Before](before/timeline-1440-developer.png) | [After](after/timeline-1440-developer.png) | [Expanded](after/timeline-1440-developer-expanded.png) |
| Story / client | [Before](before/agent-story-1440-client.png) | [After](after/agent-story-1440-client.png) | [Expanded](after/agent-story-1440-client-expanded.png) |
| Story / developer | [Before](before/agent-story-1440-developer.png) | [After](after/agent-story-1440-developer.png) | [Expanded](after/agent-story-1440-developer-expanded.png) |

### 390×844

| View / lens | Before | After | Expanded largest actual content |
|---|---|---|---|
| Timeline / client | [Before](before/timeline-390-client.png) | [After](after/timeline-390-client.png) | [Expanded](after/timeline-390-client-expanded.png) |
| Timeline / developer | [Before](before/timeline-390-developer.png) | [After](after/timeline-390-developer.png) | [Expanded](after/timeline-390-developer-expanded.png) |
| Story / client | [Before](before/agent-story-390-client.png) | [After](after/agent-story-390-client.png) | [Expanded](after/agent-story-390-client-expanded.png) |
| Story / developer | [Before](before/agent-story-390-developer.png) | [After](after/agent-story-390-developer.png) | [Expanded](after/agent-story-390-developer-expanded.png) |
