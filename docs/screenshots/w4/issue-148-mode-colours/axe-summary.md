# Client / Developer mode colours — issue148

Before: main `776212ceb95e1c4147e17ca72f0f7a93b109d210`. After tested source `a3ac178a0d5eda5f45c15d50db79364bab9c995d`, tree `5a1799442122156e60086c4f2a822565d89e01f1`. Later publication changes only this evidence and STATUS.md. Actual demo export unchanged.

## Change and meaning

Client uses desaturated grey-green `--mode-client` (#9CAFA8, saturation about11%); Developer uses cool slate `--mode-developer` (#9EADC2, about23%). Status emerald remains #10B981 (about84% saturation); rose and amber unchanged. Each mode gets an opaque10% selected fill over surface, a2px selected-button edge and a2px top header strip. Developer-only sequence/type/actor metadata and event data retain visible Developer labels and a slate rail. These are mode identifiers, never proof or approval. Client/Developer button text and aria-pressed remain; actual human/agent actor strings are not rewritten. Hash-only and the approval boundary remain visible and neutral.

## Executed verification

- 272 tests/25 files pass; lint, hard-colour/language guard, toolbar gate,134 theme contrast pairs and production build pass. Eight existing snapshots updated only for mode attributes, Developer labels and technical wrappers. One initial exact-text assertion led to preserving the original sequence/type/actor string intact in its own span; no test weakened.
- New theme gate failed before tokens existed; real-browser mode gate failed before the mode marker existed. Both now pass. Playwright fallback import order corrected after independent code review; final browser proof ran without an explicit browser-path override.
- 16 mode/view/viewport cases: both modes across all4views at1440×900 and390×844. Keyboard Enter selects the visible labelled mode with aria-pressed. No horizontal page overflow or unexpected browser errors.32 before/after images linked below. Original inert artifact script denials remain expected and separately handled.
- [Actual browser foreground/fill/edge ratios](after/mode-results.json): minimum6.4621:1 across new mode text and UI pairs; [134 theme pairs](contrasts.json) retain existing control minimum3.08:1. Selected label/tint: Client6.4935:1, Developer6.5555:1; edge/zinc800: Client6.4621:1, Developer6.5325:1. Neutral focus/selected tint: Client13.6167:1, Developer13.5985:1. AA text>=4.5 and functional UI>=3 thresholds enforced.
- Full unrestricted axe4.14.0, Chromium156.0.8078.4:36 scans before and36 after, **zero violations at any impact**, seven keyboard/code-scroll checks each, zero unexpected errors. Both lenses,4views and baseline drawer/sheet states. No rule/tag filters or suppressions. This independent PR uses main's36-state script; the separate48-state CI expansion remains in PR147.
- [88 changed Developer metadata scroll/hit-tests](metadata-scroll-results.json): grouped claims expanded, then each technical block in Overview/Timeline/Story scrolled into view at both widths and verified reachable by hit test. Existing disclosure is intentional; a collapsed claim is not asserted visible.
- Local React/interface review and visual inspection: desktop Developer Overview, mobile Developer Timeline and mobile Client Overview inspected. No extra cards, icon decoration, gradient/glow, overflow or status recolouring. Independent review found no remaining code issue.

[Before full axe JSON](before/axe-results.json) · [After full axe JSON](after/axe-results.json)

## Incomplete / limits

Raw incomplete node occurrences: before color-contrast571 and aria-hidden-focus140; after color-contrast661 and aria-hidden-focus140. Added metadata spans produce additional short-text/clipped/overlapped text candidates, including inactive modal background and scrollable/collapsed chronology. These are retained as incomplete, never rewritten as passes. New mode text has separate computed CSS contrast proof and targeted scroll reachability above; that does not resolve every historical incomplete node. PR147 documents the separate broader modal/AX triage. Actual NVDA/VoiceOver spoken output, other exports and hosted third-party comments were not tested. No blanket WCAG or human usability certification.

Commands: `cd viewer && npm test && npm run lint && npm run check:styles && npm run build`; `THEME_REPORT=/tmp/mode148-contrasts.json npm run check:theme`; `MODE_OUTPUT=/tmp/mode148-final node scripts/check-mode-colours.mjs`; `A11Y_OUTPUT=/tmp/mode148-final-axe node scripts/audit-a11y.mjs`. Baseline captures used MODE_PHASE=before. Normal local Playwright library path applies. CI status for the final head is reported in the PR. No merge or force-push; PR95 untouched.

## Screenshots

### 1440×900

| View | Client before | Client after | Developer before | Developer after |
|---|---|---|---|---|
| Overview | [before](./before/overview-1440-client.png) | [after](./after/overview-1440-client.png) | [before](./before/overview-1440-developer.png) | [after](./after/overview-1440-developer.png) |
| Claims | [before](./before/claims-1440-client.png) | [after](./after/claims-1440-client.png) | [before](./before/claims-1440-developer.png) | [after](./after/claims-1440-developer.png) |
| Timeline | [before](./before/timeline-1440-client.png) | [after](./after/timeline-1440-client.png) | [before](./before/timeline-1440-developer.png) | [after](./after/timeline-1440-developer.png) |
| Story | [before](./before/agent-story-1440-client.png) | [after](./after/agent-story-1440-client.png) | [before](./before/agent-story-1440-developer.png) | [after](./after/agent-story-1440-developer.png) |

### 390×844

| View | Client before | Client after | Developer before | Developer after |
|---|---|---|---|---|
| Overview | [before](./before/overview-390-client.png) | [after](./after/overview-390-client.png) | [before](./before/overview-390-developer.png) | [after](./after/overview-390-developer.png) |
| Claims | [before](./before/claims-390-client.png) | [after](./after/claims-390-client.png) | [before](./before/claims-390-developer.png) | [after](./after/claims-390-developer.png) |
| Timeline | [before](./before/timeline-390-client.png) | [after](./after/timeline-390-client.png) | [before](./before/timeline-390-developer.png) | [after](./after/timeline-390-developer.png) |
| Story | [before](./before/agent-story-390-client.png) | [after](./after/agent-story-390-client.png) | [before](./before/agent-story-390-developer.png) | [after](./after/agent-story-390-developer.png) |
