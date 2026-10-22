Latest current-main integration: [Shared Stitch/URL screenshots and full axe](flow-integration/axe-summary.md), source78681d8. Earlier reports below remain historical.

Latest main integration: [Updated Stitch/URL screenshots and full axe](main-integration/axe-summary.md), source69063da. Earlier original-main reports below remain historical.

# Main-view URL persistence — issue144 / PR145

Tested source `8e83dac7fafed5914b008963268125564295acbc`, tree `13ba7fefd7dfbfeb20d5cf1e6cefd44e8657c26a`, based only on main31dbf35 after PR139 squash. Later changes publish evidence/STATUS only. Open PR141/143 theme/flow changes are deliberately not duplicated here; existing main styling is unchanged. This feature does not restore or reintroduce a theme.

The address bar records the four existing view IDs in ?view=. Direct links, reload and native Back/Forward restore the actual view; same-view selection adds no history entry. Unknown/missing values show Overview. Other parameters/path/hash/history.state and independent lens storage are retained. No new router, Share control, layout, data, schema, approval or integrity rules. English copy and original records unchanged.

## Executed checks

- 246 tests/23 files passed, plus9 focused tests rerun after adding a nested-path assertion. Nine URL tests initially reproduced5 failures before implementation. Existing layout snapshots are byte-for-byte unchanged; test fixture now resets URL between cases. Lint, styles, language, existing theme contrast checks (54 pairs per existing profile), toolbar build gate and production build pass.
- Real Chromium156.0.8078.4:16 direct/reload/copied-URL combinations (4views×2sizes×2lenses),4 keyboard/Back/Forward/same-view/query-hash/fallback cases. No horizontal overflow or unexpected browser errors. Script: VIEW_URL_OUTPUT=/tmp/truthlens-view-urls node scripts/check-view-urls.mjs (after build, normal Playwright runtime variables).
- 28 baseline screenshots:all4views/both lenses at1440×900/390×844 plus mobile sheets and responsive probes;16 core images published. Story images come from the native-history checks after Back/Forward. Existing real preview/criterion assertions pass.
- 36 unrestricted axe4.14.0 scans:zero violations,7 keyboard scroll checks, no unexpected browser errors. Expected blocked scripts from the real inert artifact are recorded separately. Full JSON is retained. Incomplete:color-contrast24 scans/547 nodes;aria-hidden-focus20 scans/140 nodes. These remain manual follow-up, not confirmed violations or a blanket WCAG certification. No hosted validation claim.

[Full axe](axe-results.json) · [URL/browser checks](view-url-checks.json)

| View | Desktop1440×900 | Mobile390×844 |
|---|---|---|
| Overview | [Client](overview-1440-client.png) / [Developer](overview-1440-developer.png) | [Client](overview-390-client.png) / [Developer](overview-390-developer.png) |
| Claims | [Client](claimed-1440-client.png) / [Developer](claimed-1440-developer.png) | [Client](claimed-390-client.png) / [Developer](claimed-390-developer.png) |
| Timeline | [Client](timeline-1440-client.png) / [Developer](timeline-1440-developer.png) | [Client](timeline-390-client.png) / [Developer](timeline-390-developer.png) |
| Story | [Client](story-1440-client.png) / [Developer](story-1440-developer.png) | [Client](story-390-client.png) / [Developer](story-390-developer.png) |

Local React/interface review: rendering pure; lazy URL initialization; popstate listener cleanup; native buttons, existing aria-current/focus/layout/trust labels retained. Independent focused review found no correctness issue; nested-path assertion added. PR95 untouched. No merge without Shu’s explicit OK.
