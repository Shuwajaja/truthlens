# TruthLens Viewer – Design rules (WERK dark)
Binding viewer reference. Use the supplied TruthLens desktop/mobile reference images and Shu's logo.
Purpose: a calm, readable view of recorded evidence. Every colour has a meaning; other content is grey or white.

## 1. WERK tokens (only colour source: src/theme.css)
Shu approved the shared WERK dark theme on 2026-10-22, replacing the earlier single-green rule. References: `werk-design-system.png` and `truthlens-mockup.png` supplied by Shu. The mockup is a visual reference only; its synthetic data and verification claims must not be copied.

| Token | Hex | Meaning |
|---|---|---|
| `--primary` | #3B82F6 | Brand, selected navigation and primary actions |
| `--secondary` | #8B5CF6 | Secondary actions; never an evidence verdict |
| `--success` | #10B981 | Actual proven/passed results; guarded signature status |
| `--warning` | #F59E0B | Explicit warnings, never a substitute for unproven/open |
| `--error` | #EF4444 | Failed, unmet or nonzero exit |
| `--neutral` | #6B7280 | Neutral control boundaries |
| `--bg` | #090F17 | Page background |
| `--surface` | #111C29 | Cards and detail panels |
| `--surface-2` | #192638 | Active tabs and popovers |
| `--border` | #344459 | Decorative separators; interactive boundaries use neutral |
| `--text` | #E6EDF3 | Main text |
| `--text-2` | #B4BFCE | Explanatory text |
| `--text-3` | #A7B0BF | Metadata |
| `--primary-text` | #60A5FA | Small blue text and focus outlines |
| `--secondary-text` | #B79CFF | Small violet text |
| `--error-text` | #FF9292 | Small error text and error badges |
| `--neutral-text` | #A7B0BF | Open/pending/unsupported, hash-only seal and system events |

The six base colours remain exact. Text variants provide AA contrast on dark surfaces and tinted badges. Filled primary/secondary buttons use dark foregrounds. Compatibility aliases: ok → success, fail → error-text, info → primary-text. No colour literals outside theme.css or raw Tailwind palette classes. Always pair colour with words or shapes. Open, unsupported and hash-only stay neutral grey. `npm run check:theme` checks the palette, spacing/radius and text/control contrast pairs; browser axe checks actual rendered combinations.

## 2. Type
Inter for UI text, numbers, labels and times, with tabular numbers. JetBrains Mono is reserved for code, hashes, IDs and raw records.
| Size | Use |
|---|---|
| 12 | Labels, metadata, badges, times and hashes |
| 14 | Body text, tables and timeline |
| 16 | Section headings (600) and verdict text |
| 20 | Mobile titles and values |
| 28 | Run title (600) and evidence counts |
Weights: 400 body, 500 labels/active navigation, 600 headings/numbers. Line height: 1.5 text, 1.25 headings.

## 3. Spacing and shape
8px layout grid: 8/16/24/32; central spacing variables. Panels use surface, 1px border, 12px radius, 16px padding and 8–16px gaps. Badges, seals, fields and sheets use 12px corners. Circular event icons remain circles. Border widths, focus outlines, typography and small icon details are optical exceptions to the layout grid. No shadows.

## 4. Status pills and seals
- Pills: Inter 12/600 uppercase, 1px border and 10% status fill. PASSED/PROVEN green, FAILED/UNMET red, REVIEW/PENDING/OPEN grey.
- Neutral dashed seal: “Hash only · signature not checked” and “Integrity is not approval”. Always visible: full text above desktop content; compact “Hash only” in the mobile header, full text in the sheet.
- “Signature checked” is green only when `verified === true` AND `integrity === 'hmac'`.
- Never use green for exit 0, agent completion or “Healthy”. Unsupported is grey, never red.

## 5. Desktop layout and branding (at least 1024px)
1. Mountain header, 152px: shield and TruthLens (28/600, Truth blue, Lens white), Inter uppercase tagline; right-side evidence statement.
2. Left sidebar, 200px: Overview, Claimed vs proven, Timeline, Agent story; export notice. Active item has a blue inner edge.
3. Four status cards: Overall status, Criteria proven X/Y, Failed, Unproven. Dot plus Inter label; value 28/600. Sparklines require at least two actual runs; otherwise omit them.
4. Exported runs: status pill; with one run, show Start/End/Duration/Exit code and an honest missing-history state.
5. Code diff: mono 12, line numbers and green addition markers; neutral “Not signed” pill.
6. Right evidence drawer, 300px and sticky: Overview/Tests/Files/Time tabs; icon, title and short evidence text.
7. Record details: selected criterion/record properties as key/value rows and a status pill.

## Responsive (760px or below; a separate arrangement)
- Compact header, 56px: small logo and Hash only seal; no mountain.
- Actual reading order: status cards (2×2), runs, criteria and graph list, timeline, diff, details.
- Graph is a criterion/claim/test list, not a canvas.
- Fixed bottom navigation, 64px and four tabs; content has 88px bottom clearance.
- Evidence drawer becomes a bottom sheet with a top handle and top radius 12; run/criterion taps open real records.
- Values use 20 rather than 28. No text below 12.

## 6. Timeline
Vertical 1px line and 32px event icon circles: start, task, passed/failed test, file, claim and end. Run events are neutral; requirement/criterion and evidence/file events use info; claims are neutral; test results use green/red from actual counts. Only nonempty Task/Result phases, with start time and duration. Relative times use milliseconds. Gaps over one second show the recorded time gap; consecutive claims can expand. Developer view adds sequence/type/actor metadata. Every event opens its real record.

## 7. Evidence graph
Node text is at least 12px. Border uses border token; unsupported claims/criteria have grey dashed borders. Links: green proven, red contradicts, grey dashed no proof. Legend at top right; criterion result dot. Never use green for a node without a linked test.

## 8. Honesty
- Never show “Signature checked” or green integrity without both `verified === true` and `integrity === 'hmac'`.
- Keep “Hash only · signature not checked” and “Integrity is not approval” visible at the existing locations.
- Show only actual RunDoc data: no placeholder counts or invented trends/events. Claims never become proof.
- Times stay local, with a zone abbreviation, formatted in English (`en-GB`, 24-hour); relative times can accompany them.
- Do not translate, rename or alter recorded content, RunDoc field names or wire values.

## 9. Logo
Keep the supplied shield/eye/check geometry and generate wordmark/icon SVGs from it. Truth uses primary blue and Lens uses text white; shield outline uses text white. Brand colour is independent of success. Use the wordmark in the desktop header and icon in sidebar/mobile header. Generate favicon.svg, favicon.ico (32) and apple-touch-icon.png (180) from the same theme palette. Green is reserved for real results or guarded verified signatures.

## 10. UI language and plain names
**UI language: English only, no German.** This covers visible text, accessible names, titles, tooltips, placeholders, alt text, empty/error states, navigation, drawers/sheets and Navigator. Document language is en; document title is TruthLens. Use the approved glossary exactly; other wording must be plain, literal English without jargon or marketing.

Use Overview, Project overview, Run/Runs, Exported runs, Evidence, Proven, No proof, Not checked, Open, Criteria/Criterion, Claim, Task/Result, Timeline, Event/Events, Start/End/Duration, File/Files and Close. Use Open run, Open record, Open file, Filter selected evidence, All records and links as a list, Recorded links, Criterion links and Graph records. Navigator says “Navigator coming later”; its suggestions are “Example questions (static)”.

The neutral seal is exactly “Hash only · signature not checked”. The checked label is “Signature checked”, subject to the integrity guard above. The approval boundary is “Integrity is not approval”. `npm run check:language`, rendered-DOM tests and browser review protect the English-only UI. Export data remains unchanged.

## 11. Accessible labels and scrollable records
- Button names must include their visible text in reading order, including status, sequence/type metadata and times. Prefer names derived from content; keep explicit action labels only when they include the visible label. Mobile navigation uses its visible short name.
- Scrollable code, diff and raw-data blocks are in the Tab order (`tabIndex={0}`), use the existing `--info` focus outline, and retain native arrow-key scrolling. No changes to colour or type tokens are needed.

## 12. Preview review toolbar
- Vercel Comments is optional review tooling only in builds with `VERCEL_ENV=preview`. Production, local development, unset and unknown environments do not include its loader or bundle.
- Load the official toolbar after the viewer mounts; an unavailable toolbar must not block the recorded evidence. Reuse an existing Vercel-injected toolbar/loader rather than adding another one.
- The toolbar is a third-party overlay, not a TruthLens status or approval control. It must not alter RunDoc data, trust wording, tokens or the type scale. Inspect keyboard focus, mobile navigation and trust-text overlap when checking a real authenticated preview.
