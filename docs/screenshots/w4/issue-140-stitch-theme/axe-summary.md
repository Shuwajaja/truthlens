# One final Stitch theme — issue140

Before main: `29e930bd318dd8305e1dc6bb00e7cb6d11257669`. After source: `ce9f36f82448a42701108b8b94f9b89049b8763c`, tree `5bcbf4814149787e704921a68bf422072499940f`. Raw after axe preserves scan-start HEAD separately and attributes the staged rendered changes to the source commit. Subsequent publication is evidence only. Final pre-publish cleanup changed comments only.

PR139/issue138 was completed before this work and is left open/unmodified. This branch starts from main, not PR139; its Client-results implementation is intentionally not duplicated. PR95 untouched.

## Changes

One unconditional theme.css root: bg#09090B, emerald#10B981, rose#F43F5E, amber#F59E0B. Derived surfaces/foreground/borders are zinc900/800/700/500/400/300/100. Rose400#FB7185 is the AA text variant for rose-tinted badges. Plus Jakarta Sans UI, JetBrains Mono IDs/code. No per-view theme effect or legacy active font packages. Generated neutral brand SVG/favicon/touch assets resolve central tokens; outlined wordmark uses the bundled font's regular glyphs. Plus Jakarta font licence OFL-1.1 published. Historical unused Inter licence notices remain notices, not loaded fonts.

The actual exported artifact retains its recorded HTML/CSS, including its historical colours. It is not Viewer UI and no raw export is rewritten. Schema/approval/integrity/trust text unchanged.

## Colour guard and CI

check:styles scans viewer/src recursively, exempts only actual theme.css, rejects hex, rgb/rgba, hsl/hsla, hwb/lab/lch/oklab/oklch/color functions, standard Tailwind colour utilities (including outline/gradient/shadow/ring-offset), named-colour declarations and arbitrary named utilities. Semantic variables, currentColor, transparent and token-based colour mixing remain allowed. Existing CI already runs check:styles; npm test now includes it as well. Twelve focused guard fixtures include inline style/SVG and cyan/chartreuse/bg-[cyan] bypass regressions. Fonts/spacing checks remain.

## Focus and contrast witness

Opaque --focus#F4F4F5 outline,2px wide,3px offset; ring aliases use it. Offset exposes the underlying zinc surface between a light filled control and its ring, preventing same-colour adjacency. [All72 measured pairs](contrast-pairs.json): focus/bg18.10:1, focus/surface16.12:1, focus/surface-213.55:1; minimum over all21 focus/neighbour pairs10.08:1 (threshold3:1). Text minimum4.76:1 (threshold4.5:1). Neutral control boundary minimum3.08:1. These are calculated sRGB pairs, separate from axe.

[Computed browser checks](theme-focus-checks.json) verify all16 view/lens/viewport states: single background/font and no view override, no legacy visible colours/fonts; focus-visible computed outline2px/offset3px/opaque token colour. Graph handles and portalled drawer colours/fonts checked. [Desktop focus](focus-1440.png), [mobile focus](focus-390.png). Full keyboard scroll audit below checks real Tab access and visible focus on overflowing records.

## Executed verification

- 242 tests/22 files, lint, language, styles,72 AA text/control/focus pairs and build passed. Focus-class snapshot updates only; no raw-data snapshots changed semantically.
- Before and after:28 baseline screenshots each; published32 comparison images cover all4 views, both lenses, exact1440×900/390×844. Existing intermediate responsive widths and real preview/isolation/selection checks passed. Desktop Timeline before/after and mobile Claims sample visually inspected.
- Chromium156.0.8078.4, axe-core4.14.0: **36 unrestricted scans before and36 after, zero violations in either**. Both lenses/all4 views/affected drawers/sheets. Seven keyboard scroll checks per phase passed. No unexpected browser errors; exact expected artifact sandbox script denials retained separately.
- Incompletes remain manual follow-up: before color-contrast24 scans/551 node occurrences, after24/543; aria-hidden-focus20/140 in each phase. No blanket WCAG or hosted-validation claim.
- Independent review found XY handle defaults and named-colour guard gaps; both fixed and independently rechecked. React checklist: removing theme lifecycle state/effect simplifies rendering; no new state/async paths. Interface review: text + colour status, honest English and integrity notice retained.

[Before full axe](before/axe-results.json) · [After full axe](after/axe-results.json) · [Stitch checks](stitch-check.json)

| View / exact viewport | Before | After |
|---|---|---|
| overview 1440 client | [Before](before/overview-1440-client.png) | [After](after/overview-1440-client.png) |
| overview 390 client | [Before](before/overview-390-client.png) | [After](after/overview-390-client.png) |
| claimed 1440 client | [Before](before/claimed-1440-client.png) | [After](after/claimed-1440-client.png) |
| claimed 390 client | [Before](before/claimed-390-client.png) | [After](after/claimed-390-client.png) |
| timeline 1440 client | [Before](before/timeline-1440-client.png) | [After](after/timeline-1440-client.png) |
| timeline 390 client | [Before](before/timeline-390-client.png) | [After](after/timeline-390-client.png) |
| story 1440 client | [Before](before/story-1440-client.png) | [After](after/story-1440-client.png) |
| story 390 client | [Before](before/story-390-client.png) | [After](after/story-390-client.png) |

Developer screenshots follow the same filenames with -developer suffix in both directories. No merge without Shu’s explicit OK.
