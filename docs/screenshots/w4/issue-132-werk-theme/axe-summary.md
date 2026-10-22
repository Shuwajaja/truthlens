# WERK theme verification — 2026-10-22

Tested source: [`23527c1d91186cf9c95df0b65861afe20495dec0`](https://github.com/Shuwajaja/truthlens/commit/23527c1d91186cf9c95df0b65861afe20495dec0), tree `3567c8331319ef8746a06c4ad33f124553cd44a7`. Chromium 156.0.8078.4, Playwright 1.64.1, axe-core 4.14.0. Local production build, actual repository export; requests to other origins blocked. No hosted-deployment claim.

Source identity: checks ran against the staged source before its commit was created. The raw report's original `commit` records checkout HEAD `40dbb8c4f9521a56280c8b17a69e03216e1ba105`; added `testedSourceCommit`/`testedSourceTree` identify the tested changes. `git diff --cached --exit-code FETCH_HEAD` confirmed the staged tree matched the published source commit exactly, then the local branch was advanced without altering files. There were no subsequent Viewer source changes.

## Result

- 214 tests / 19 test files passed, without snapshot-update mode in the final run. Snapshot changes are spacing classes only.
- Lint, semantic-style check, English-language check and production build passed. Brand SVG consistency and raster dimensions checked during build; actual pixels of all five served brand assets checked in the browser.
- Six exact WERK base colours; Inter UI, 8px spacing steps, 12px corners. The theme check guards all four spacing variables and disallows the migrated odd spacing utilities in TSX.
- 50 explicit contrast pairs passed: all text pairs >=4.5:1 (minimum **4.54:1**); focus/control pairs >=3:1 (minimum **3.16:1**). Covers three dark surfaces, tinted success/error/neutral badges, blue brand, selected violet Developer lens, and dark text on the five coloured fills. Brighter text variants are documented in DESIGN.md; base palette values remain exact.
- **36 full unrestricted axe scans: 0 violations**, including zero serious/critical findings. No rule filter or exclusion. Seven overflowing-code keyboard checks passed (Tab reachability, visible outline and native arrow scrolling); dialog Escape/focus restoration and trust-boundary text checked.
- Browser review: all four views, both lenses at **1440×900** and **390×844**, mobile trust/run/criterion sheets; intermediate 360/760/1024px checks. No page overflow, browser/console errors, invalid type-scale values or retired green. The separate screenshot review's axe checks remain contrast-only; the 36-scan audit above is the full check.

## Coverage

| Size | Both Client and Developer lenses | Additional states per lens |
|---|---|---|
| 1440×900 | Overview, Claimed vs proven, Timeline, Agent story | Claim, criterion, evidence and file drawers |
| 390×844 | Same four views | Four trust sheets, run and criterion sheets |

Thirty screenshots are published beside this file: 16 exact-viewport view captures, 12 mobile sheets and two supplementary full-page mobile overviews. Representative desktop/mobile views, the violet Developer lens, raw-record sheet, neutral seal and success/error badges were visually inspected. Existing information density, graph truncation and other UX backlog items are outside this theme change.

## Incomplete results and limits

`axe-results.json` retains every incomplete node; these are **not passes or confirmed violations**:

| Rule | Scan occurrences | Node occurrences |
|---|---:|---:|
| color-contrast | 27 | 218 |
| aria-hidden-focus | 20 | 140 |
| aria-prohibited-attr | 4 | 6 |

The contrast incompletes involve the decorative mountain SVG, transformed/overlapped graph text, sticky content and partially obscured drawer/background content. Relevant text/surface tokens were checked mathematically and representative screenshots inspected. This does not resolve every obscured-node case or certify complete WCAG AA compliance.

ARIA incompletes include Radix modal background/focus guards, the labelled scroll viewport and React Flow controls. Browser checks verified focus containment, closing/restoration and seven overflowing blocks in the exercised flow; exhaustive screen-reader/manual ARIA validation remains open. No unrelated ARIA changes are bundled here.

## Review and reproduction

The No-Slop UI checklist, repository Web Interface Review checklist and Vercel React Best Practices were applied. The independent diff review found old spacing utilities; those were migrated and guarded by the theme check. No remaining blocking diff finding. TSX edits only adjust spacing classes; data, hooks, event handlers, verification gates and displayed claims are unchanged. No new UI/library code or dependency was introduced.

From `viewer/` (with the existing local Chromium library/browser paths configured):

```sh
npm test
npm run lint
npm run check:styles
npm run check:language
npm run build
P3_LENSES=client,developer P3_SHOTS=/tmp/werk-review node scripts/review-screenshots.mjs
A11Y_OUTPUT=/tmp/werk-audit node scripts/audit-a11y.mjs
```

Screenshots: [Desktop overview](overview-1440-client.png), [Mobile overview](overview-390-client.png), [Developer lens](overview-390-developer.png), [Evidence sheet](criterion-sheet-390-developer.png). All other view/sheet captures are in this directory.

No merge; Shu's explicit OK is required.
