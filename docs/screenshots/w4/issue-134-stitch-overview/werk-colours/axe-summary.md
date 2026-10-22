> Superseded for Overview: Shu now requests the provisional Stitch palette and fonts. See [latest evidence](../stitch-colours/axe-summary.md). Final palette remains pending.

# WERK colour clarification — 2026-10-22

Latest tested source: [5b69fa91e0e1c4746559fd0423564097f0861db4](https://github.com/Shuwajaja/truthlens/commit/5b69fa91e0e1c4746559fd0423564097f0861db4). The full axe audit ran on this clean commit. Layout/colour checks ran against the identical staged source tree, verified against the published commit before advancing the local branch. This follow-up supersedes the earlier neutral Approval OPEN styling.

## Applied mapping

| Meaning | WERK base token |
|---|---|
| Active navigation / accents | primary #3B82F6 |
| Secondary controls | secondary #8B5CF6 |
| Proven | success #10B981 |
| Approval OPEN | warning #F59E0B |
| Failed | error #EF4444 |
| Not checked | neutral #6B7280 |

Six exact base tokens remain central in theme.css. Error/neutral base colours now drive status indicators, borders and fills; documented brighter text variants preserve AA on dark surfaces. Approval OPEN uses warning text/border and a 10% warning fill. Approval Not stated, Not checked criteria and hash-only remain neutral. Inter UI, monospace for IDs/code, 8px grid, 12px corners and dark surfaces remain binding. No Stitch rose or Plus Jakarta Sans in Viewer UI. The original exported artifact's historical styling remains its own content.

## Verification

- 223 tests / 20 files passed in a normal run, including regression assertions distinguishing warning OPEN from neutral Not stated. Lint, styles, language and production build passed.
- 54 explicit token contrast pairs passed (text >=4.5:1; focus/control >=3:1), including the new warning, error, neutral and primary tinted fills.
- Four real-export viewport/lens states asserted the actual computed colours: approval rgb(245,158,11); dots rgb(16,185,129), rgb(239,68,68), rgb(107,114,128); active navigation border rgb(59,130,246); Inter font; no visible Stitch rose/Plus Jakarta. The existing preview isolation and all 12 real criterion selections also passed. Raw checks: `stitch-check.json`.
- 28 screenshot-review states passed across both lenses/all four views and mobile sheets at 1440×900 and 390×844, with intermediate 360/760/1024px probes. Updated overview screenshots were visually inspected and published here.
- 36 full unrestricted axe scans: **0 violations**, including 0 serious/critical. Seven overflow keyboard checks passed. No unexpected browser/console errors; four exact sandbox script-denial messages retained separately. Browser Chromium156.0.8078.4 / axe4.14.0. Raw report: `axe-results.json`.

Incomplete results remain manual follow-up, not passes or confirmed violations:

- color-contrast: 24 scan occurrences / 541 node occurrences.
- aria-hidden-focus: 20 scan occurrences / 140 node occurrences.

These concern obscured/overlapping modal/sticky content and Radix background/focus guards; the prior report describes the limits. Token checks and representative visual review do not certify complete WCAG AA or the historical artifact's own content.

[Desktop 1440×900](overview-1440-client.png) · [Mobile 390×844](overview-390-client.png).

Reproduce from viewer/: `npm test`, `npm run lint`, `npm run check:styles`, `npm run check:language`, `npm run build`, `P3_LENSES=client,developer npm run review:screenshots`, and `A11Y_OUTPUT=/tmp/werk-audit node scripts/audit-a11y.mjs` with the existing local browser/library paths configured. No merge performed.
