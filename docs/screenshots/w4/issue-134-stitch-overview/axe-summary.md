# Stitch Overview verification — 2026-10-22

**Latest colour mapping and screenshots:** [WERK follow-up](werk-colours/axe-summary.md). The report below records the preceding source and its original neutral Approval styling.

Tested source: [`a4010db2b37758610ebc2b0afd4ae553e75448ea`](https://github.com/Shuwajaja/truthlens/commit/a4010db2b37758610ebc2b0afd4ae553e75448ea), tree `58d532ea439f928235abeed5a402d3181095cb95`. The full axe audit was run on this clean source commit. Production build, Chromium156.0.8078.4, Playwright1.64.1, axe-core4.14.0. Local loopback preview; no hosted validation claimed.

## Approved design and scope

Shu's local `stitch/shu-landing-run1.html` / `.png` are the approved layout. Stitch project6413245827645409955 was read with `list_screens`, `get_screen` and `download_file` (remote Overview screen5cb907c062dc4dccbe50a928627aa627 inspected as context). No Stitch resource was changed or deleted; local approved files take precedence over remote variants.

The Viewer uses its existing React/Vite and shadcn components, with WERK from [PR#133](https://github.com/Shuwajaja/truthlens/pull/133) / issue#132. The branch includes that dependency unchanged. [Review only this task's source changes](https://github.com/Shuwajaja/truthlens/compare/b859942e1354d446b15719b9c974578025fe6440...a4010db2b37758610ebc2b0afd4ae553e75448ea).

Compact header tabs retain the four working views. Overview has three measured KPI cards and criteria+timeline / project preview / selected criterion columns. The primary layout is replaced; graph and diff remain in a secondary disclosure. Mobile stacks the panels with a direct selected-detail link and the existing bottom navigation/sheets. DESIGN.md was updated before UI code. No external Stitch scripts/fonts/palette or invented company/version/browser/hardware/timing data was copied.

## Results

- **223 tests /20 files passed**, final normal run without snapshot-update mode;9 new acceptance tests first witnessed failing on the previous layout. Existing layout snapshots intentionally updated; drawer/render behavior remains separately tested.
- Lint, styles, English-language check, WERK theme check and production build passed. The50 WERK contrast pairs remain green: text>=4.5:1, focus/control>=3:1. These are Viewer tokens, not a claim about the historical artifact's own styling.
- **36 unrestricted axe scans,0 violations**, including0 serious/critical. Raw results are in `axe-results.json` with tested source commit, exact viewports and every incomplete node. Seven keyboard checks confirm Tab reachability, visible focus and native arrow scrolling in overflowing raw-code blocks; sheets/drawers close with Escape and restore focus.
- Browser review covered both lenses and all four views at **1440×900 /390×844**, mobile trust/run/criterion sheets, desktop claim/criterion/evidence/file drawers, and360/760/1024px probes. No page overflow, invalid UI type scale or unexpected browser/console error.
- Dedicated layout/preview check passed four viewport/lens states, all12 actual criterion selections, desktop three-column geometry, mobile reading order and visible preview pixels. `stitch-check.json` retains these checks. Both desktop and mobile previews are from the actual exported `index.html` body.

Thirty published PNGs:16 exact-viewport view captures,12 mobile sheets and2 mobile preview scroll positions. Representative desktop/mobile overviews, all other views, selected detail, sheet and the actually painted mobile preview were visually inspected. Full-page screenshots were omitted because Chromium may omit offscreen frame paint; the dedicated check validates real nonblank pixels before capturing the visible preview.

## Evidence honesty and preview isolation

The actual export has3 criteria:1 met,1 unmet,1 unverified;16 events and one `index.html` artifact with an embedded body. Current display is1/3 Proven,1 Failed,1 Not checked and neutral ApprovalOpen. The run ID, project title, agent,20.846s duration and zoned timestamps come from that export. No approval is inferred from a missing review flag, an exit status or integrity. Hash-only and “Integrity is not approval” remain visible; signature guards are unchanged.

The preview selects only an HTML artifact with its referenced nonempty exported body. It is a static rendering of that content, not a live application, screenshot witness, new test result or signature check. Its historical styling is retained. An inert wrapper and empty iframe sandbox disable interaction and give an opaque origin; CSP blocks scripts, network, forms and nested content. File-record actions expose the actual recorded source.

Separate, explicitly synthetic fixtures exercise malicious inline script, external image/network and form submission, plus missing body. They produced no outgoing requests; script/form denial was witnessed and a300ms observation followed submission. Those fixture bodies are never published as recorded UI screenshots. An independent review also witnessed meta-refresh denial with zero outgoing requests after1.5s. The preview check records expected denials separately from unexpected errors.

Four expected `about:srcdoc` script-denial messages occur in the real-export audit because the original artifact contains JavaScript. Only that exact sandbox-denial message is classified separately; every other browser error still fails. Test lens initialization is restricted to the top Viewer window, avoiding privileged test-script access to sandboxed localStorage. The sandbox was not relaxed.

## Incomplete results and limits

| Rule | Scan occurrences | Node occurrences |
|---|---:|---:|
| color-contrast |24|534|
| aria-hidden-focus |20|140|

These are incomplete, not confirmed violations or passes. Contrast cases report partially obscured/obscuring content or overlapping backgrounds around sticky content and modal layers. Viewer token pairs were checked; representative screenshots inspected. Radix background/focus-guard cases remain for exhaustive manual/screen-reader verification. This is not a blanket WCAG AA certification, and no accessibility claim is made for the exported page's own CSS/content. Its static preview has an accessible file-record alternative.

No-Slop UI, repository Web Interface Review and Vercel React Best Practices were applied. Independent diff review found no blocking issue. No contract, backend, HMAC, export-data or deployment change. PR#133 dependency remains open; no merge was performed.

## Reproduction

From `viewer/`, with the existing local Chromium/library paths configured:

```sh
npm test
npm run lint
npm run check:styles
npm run check:language
npm run build
P3_LENSES=client,developer P3_SHOTS=/tmp/stitch-review STITCH_OUTPUT=/tmp/stitch-layout npm run review:screenshots
A11Y_OUTPUT=/tmp/stitch-audit node scripts/audit-a11y.mjs
```

[Desktop](overview-1440-client.png) · [Mobile](overview-390-client.png) · [Mobile actual artifact](preview-390-client.png) · [Criterion sheet](criterion-sheet-390-client.png). Other view/sheet captures are beside this file.

No merge without Shu's explicit OK.
