# TruthLens viewer

React/TypeScript viewer for a local exported RunDoc. Node >=22.19 is required; CI uses Node 24. From this directory:

```sh
npm ci
npm test
npm run check:styles
npm run lint
npm run build
```

The browser loads local `/run.json`, validates the complete export and checks internal consistency. It does not verify signatures. RunDoc fields, event hashes and the export vocabulary are unchanged.

## UI contract

[DESIGN.md](DESIGN.md) is binding. `src/theme.css` is the sole presentation palette and defines the five text sizes. Inter and JetBrains Mono are bundled locally; their SIL OFL licenses are in `public/licenses/`. No remote fonts or other product themes are loaded. `npm run check:styles` rejects colour literals outside theme.css, legacy palette classes and unsupported explicit type sizes/weights in src.

`src/components/ui/` contains source components adapted from [shadcn/ui](https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/new-york-v4/ui), under the adjacent MIT license. Radix supplies keyboard and focus behaviour for Sheet, Tabs, Tooltip, ScrollArea and Separator. Motion respects reduced-motion preferences.

Use `StatusBadge` with exported criterion status, claim finding, or both integrity fields. Its semantic variants are private. HMAC checked requires `verified === true` **and** `integrity === 'hmac'`; hash-only stays neutral and says “Hash only · signature not checked”. Claims never receive proof styling. Technical integrity never implies human acceptance. The unchanged wire types and fail-closed validator live in `contracts/`; legacy card field names there are data, not UI colours.

## Recorded views

The supplied mountain and shield SVG shapes use theme paints. Desktop navigation is 200px; a 300px sticky evidence rail contains real export events and the disabled static Navigator below it. “Navigator coming later” is explicit: there is no transport, model or generated reply.

Status cards count criteria with met, unmet and still proposed/unverified results. They do not count failing runs or infer acceptance from exit 0. This format contains one run, with an explicit missing-history note and no trend or sparkline. Duration comes from recorded start/end timestamps; missing ends remain missing. Times use local time with a zone abbreviation.

The diff panel uses the first actual exported unified diff through RenderKit. JSON or logs quoting a diff do not become a diff panel. Line numbers come only from bounded hunk headers; metadata remains unnumbered and all content is escaped. Addition/deletion colours describe edits. The diff is labelled “nicht signiert”.

The read-only graph cites recorded criterion evidence IDs, event criterion IDs, exact artifact IDs or content hashes. Unknown and ambiguous endpoints are omitted. Unwitnessed claims stay isolated; a supported claim has no edge without an exported witness. Green/red result colours require decisive linked wrapper/system tests, per D25/D27. Reference-only edges remain neutral. Selecting a record updates the property detail and opens that same record. Zoom never shrinks node text below 12px; panning and the complete record list expose larger graphs.

The timeline sorts sequence numbers, groups initial setup events as Task and the remainder as Result, and shows only nonempty phases. Durations are recorded timestamp spans. Gaps over one second come from adjacent timestamps, not live telemetry. Consecutive claims expand. Every event opens its original record; the Developer lens adds seq/type/actor metadata.

## Mobile and evidence sheets

At 760px and below, the viewer uses a 52px compact header, 64px bottom navigation, 84px content clearance and a graph list instead of a canvas. The actual DOM and visual reading order are status → run → criteria/graph list → timeline → diff → detail. Tab changes reset scroll and focus to the new view title. Client/Developer controls remain available.

Run/criterion taps open a bottom sheet with real data; the compact integrity seal opens run details. Full trust boundaries stay in the sheet. Overview/Tests/Artefakte/Zeit tabs filter the selected records; run details use the full export. Missing content remains an explicit neutral state. The sheet traps focus, Escape closes it, and focus returns to the original trigger. Close and the trust notice remain outside the scrolling body.

## Browser review

After building, `npm run review:screenshots` captures all four views at 1440px and 420px, the full mobile overview and mobile sheets: 15 images in ignored `.screenshots/review/`. It checks axe contrast, computed type sizes/weights, viewport overflow, mobile DOM/visual order, fixed navigation, sheet placement, trust text, Escape/focus return and view scroll reset. Additional 360/760/1024px probes guard intermediate layout. Desktop graph records are also exercised by keyboard.

CI publishes a `viewer-screenshots-<commit>` artifact for each PR, retained for 30 days. PR descriptions link the run and image archive. Generated images and temporary reports are not source files. `npm run screenshots` runs the same review in both Client and Developer lenses, under ignored `.screenshots/both-lenses/`.

Playwright is a dev dependency. Local browser binaries and required libraries stay inside this clone; see the root README for setup. `PLAYWRIGHT_BROWSERS_PATH` defaults to the clone's `.venv/playwright`. `REVIEW_BROWSER_EXECUTABLE` can select an existing browser; CI uses the runner's installed Google Chrome. No browser download or system install is required by the review script.

Tests retain the real export and isolated, explicitly labelled synthetic renderer fixtures. P3 intentionally updates visual snapshots. Only Radix's transient mount-animation style is normalized in cloned snapshots; live behaviour remains tested. Snapshot files preserve meaningful spaces around inline Markdown.

## Logo addendum (2026-10-22)

Shu's logo and recorded results share the single --ok green token. Truth, eye and check are green; Lens and the shield outline use text white. Navigation and focus use info. Outside the logo, green describes real recorded results; an integrity badge is green only when verified is true and integrity is hmac. Hash-only remains grey. Native SVG geometry reconstructs the supplied JPEG references; wordmark glyph outlines use the bundled Inter 600 font. No JPEG or external font is loaded at runtime.

`npm run brand:build` generates the public SVG wordmark/icon, favicon SVG/ICO 32 and touch PNG 180. SVG templates use theme variables; generated public assets resolve those values from theme.css for standalone image/favicon rendering. There is no second hand-maintained palette. Build checks SVG regeneration and icon dimensions; rasterization uses the clone-local Playwright browser only when deliberately rebuilding assets.

The browser review checks the shared logo/result green, white Lens text and neutral hash seal, rejects the superseded green shades and inspects all five generated assets, including ICO/PNG pixels and dimensions.

## UI language

All viewer labels and accessible names use plain English, following DESIGN.md. `npm run check:language` scans src for German copy; npm test and CI run it too. Rendered-DOM tests and browser review cover all four views and evidence sheets in both lenses using the unchanged English public export. These are development checks, not runtime export validation or translation. Local dates use en-GB, 24-hour time and a zone abbreviation. Recorded content, RunDoc fields and wire values are preserved.
