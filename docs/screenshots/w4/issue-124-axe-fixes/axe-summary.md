# Issue 124: accessible labels and keyboard scrolling

Captured 2026-10-22 using the actual `viewer/public/run.json`; no substitute data.

- Audit executed at local source commit `ce9352334a4d7efa980221751d5613ce56ad4e3f`. Published source commit: `e831bc69fceb74bd18dcec3cbd6bfdb8be016eee`. Both have the identical Git tree `4cf87f94c10d31c6680513c414761d4b1920d927` (checked locally after fetching the published commit). GitHub connector publication changes commit metadata; the tested source is identical.
- Production build; Playwright 1.64.1, headless Chromium 156.0.8078.4, axe-core 4.14.0.
- Exact desktop **1440×900** and mobile **390×844** CSS pixels, scale 1, locale `en-GB`, timezone `Europe/Berlin`, reduced motion.
- **36 full unrestricted axe scans** (`new AxeBuilder({page}).analyze()`, no rule/tag filters). Both Client and Developer lenses, all four views; desktop claim/criterion/evidence/file drawers; mobile run/criterion sheets and trust sheet in each view.
- **0 confirmed violations of any severity**, including `label-content-name-mismatch` and `scrollable-region-focusable`; **0 browser errors**.
- **7 overflowing code blocks** reached with keyboard Tab; visible focus outline confirmed; ArrowRight/ArrowDown actually scrolled content. Drawers/sheets opened with Enter, closed with Escape; focus returned to their trigger. Trust boundary wording checked inside each dialog.
- `npm run build`, `npm run lint`, `npm run check:styles`, `npm run check:language`, `npm test` (**214 passed**) and `git diff --check`: passed.
- Two Client Overview viewport screenshots below were visually inspected. The interface, neutral integrity notice and mobile navigation retain their layout.

## Before / after

The same 36-state baseline reproduced **200 label occurrences** and **7 scroll occurrences** (repeated elements across states/lenses, not unique defect counts). All are absent after the fix. Buttons now derive names from visible content; mobile navigation uses its visible short labels. Code/diff/raw blocks use native tab focus and the existing focus outline.

## Automated coverage by state

| State | Desktop Client | Desktop Developer | Mobile Client | Mobile Developer |
| --- | --- | --- | --- | --- |
| overview | 0 violations | 0 violations | 0 violations | 0 violations |
| claims | 0 violations | 0 violations | 0 violations | 0 violations |
| timeline | 0 violations | 0 violations | 0 violations | 0 violations |
| agent-story | 0 violations | 0 violations | 0 violations | 0 violations |
| claim-drawer | 0 violations | 0 violations | — | — |
| criterion-drawer | 0 violations | 0 violations | — | — |
| evidence-drawer | 0 violations | 0 violations | — | — |
| file-drawer | 0 violations | 0 violations | — | — |
| overview-trust-sheet | — | — | 0 violations | 0 violations |
| run-sheet | — | — | 0 violations | 0 violations |
| criterion-sheet | — | — | 0 violations | 0 violations |
| claims-trust-sheet | — | — | 0 violations | 0 violations |
| timeline-trust-sheet | — | — | 0 violations | 0 violations |
| agent-story-trust-sheet | — | — | 0 violations | 0 violations |

## Manual review remains

Axe `incomplete` results are unresolved manual-review items, not passes or confirmed violations:

| Rule | States |
| --- | ---: |
| `aria-hidden-focus` | 20 |
| `aria-prohibited-attr` | 4 |
| `color-contrast` | 28 |

This does not establish full accessibility compliance. Screen readers, alternate exports, loading/error states and every drawer tab were not exhaustively tested. Frozen contracts, real data and trust guards were not changed. Existing CI screenshots still check contrast only at other viewport sizes; the full audit here is separately reproducible with `cd viewer && npm run build && node scripts/audit-a11y.mjs`. On this host prepend `LD_LIBRARY_PATH=<workspace>/.venv/playwright-libs/usr/lib/x86_64-linux-gnu` to the node command to use the already-present browser libraries.

[Detailed axe results and keyboard evidence](axe-results.json)

[Desktop 1440×900](desktop-1440x900.png) · [Mobile 390×844](mobile-390x844.png)
