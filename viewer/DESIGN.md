# TruthLens Viewer – Design rules (Midnight Command)
Binding viewer reference. Use the supplied TruthLens desktop/mobile reference images and Shu's logo.
Purpose: a calm, readable view of recorded evidence. Every colour has a meaning; other content is grey or white.

## 1. Tokens (only colour source: src/theme.css)
| Token | Hex | Meaning |
|---|---|---|
| `--bg` | #070A0D | Page background |
| `--surface` | #0F151B | Hover, quotes and detail panels |
| `--surface-2` | #161E26 | Active tabs and popovers |
| `--border` | #22303A | All 1px lines |
| `--text` | #E6EDF3 | Main text and numbers (15:1) |
| `--text-2` | #A9B4C2 | Explanatory text (8.5:1) |
| `--text-3` | #8592A3 | Metadata, labels and times (at least 5:1), never body content |
| `--ok` | #1CDC44 | Proven/passed results and the logo; signature status only when `verified === true` and `integrity === 'hmac'` |
| `--fail` | #FF7B72 | Failed, unmet or nonzero exit |
| `--info` | #79B8FF | Focus, links, file and criterion events (an action, not a verdict) |
| `--neutral` | #97A3B3 | Open, pending, unsupported or needs review; hash-only seal and system events |
No colour literals outside theme.css. No Tailwind palette classes. No orange/yellow in the status system. Status uses green (proven/passed/checked), red (failed/contradicts), or grey (everything else). Always pair colour with a word or shape.

## 2. Type
Fonts: Inter for text, JetBrains Mono for numbers, IDs, times and labels. Mono always uses tabular numbers.
| Size | Use |
|---|---|
| 12 | Mono uppercase labels (+0.08em), metadata, pills, times and hashes |
| 14 | Body text, tables and timeline |
| 16 | Section headings (600) and verdict text |
| 20 | Mobile titles and values |
| 28 | Run title (600) and evidence counts (mono 600) |
Weights: 400 for body text, 500 for labels/pills/active navigation, 600 for headings/numbers. Line height: 1.5 for text, 1.25 for headings.

## 3. Spacing and shape
4px grid: 4/8/12/16/24/32. Panels use surface, 1px border, radius 8, padding 14/16 and gaps 12–16. Pills/seals use radius 4. Icon circles: 28px in timeline/drawer, 36px in graph. No shadows.

## 4. Status pills and seals
- Pills: mono 12/600 uppercase, 1px border and 10% status fill. PASSED/PROVEN green, FAILED/UNMET red, REVIEW/PENDING/OPEN grey.
- Neutral dashed seal: “Hash only · signature not checked” and “Integrity is not approval”. Always visible: full text above desktop content; compact “Hash only” in the mobile header, full text in the sheet.
- “Signature checked” is green only when `verified === true` AND `integrity === 'hmac'`.
- Never use green for exit 0, agent completion or “Healthy”. Unsupported is grey, never red.

## 5. Desktop layout and branding (at least 1024px)
1. Mountain header, 150px: shield and TruthLens (28/600, Truth green, Lens white), mono uppercase tagline; right-side evidence statement.
2. Left sidebar, 200px: Overview, Claimed vs proven, Timeline, Agent story; export notice. Active item has a green inner edge.
3. Four status cards: Overall status, Criteria proven X/Y, Failed, Unproven. Dot plus mono label; value 28/600. Sparklines require at least two actual runs; otherwise omit them.
4. Exported runs: status pill; with one run, show Start/End/Duration/Exit code and an honest missing-history state.
5. Code diff: mono 12, line numbers and green addition markers; neutral “Not signed” pill.
6. Right evidence drawer, 300px and sticky: Overview/Tests/Files/Time tabs; icon, title and short evidence text.
7. Record details: selected criterion/record properties as key/value rows and a status pill.

## Responsive (760px or below; a separate arrangement)
- Compact header, 52px: small logo and Hash only seal; no mountain.
- Actual reading order: status cards (2×2), runs, criteria and graph list, timeline, diff, details.
- Graph is a criterion/claim/test list, not a canvas.
- Fixed bottom navigation, 64px and four tabs; content has 84px bottom clearance.
- Evidence drawer becomes a bottom sheet with a top handle and top radius 16; run/criterion taps open real records.
- Values use 20 rather than 28. No text below 12.

## 6. Timeline
Vertical 1px line and 28px event icon circles: start, task, passed/failed test, file, claim and end. Run events are neutral; requirement/criterion and evidence/file events use info; claims are neutral; test results use green/red from actual counts. Only nonempty Task/Result phases, with start time and duration. Relative times use milliseconds. Gaps over one second show the recorded time gap; consecutive claims can expand. Developer view adds sequence/type/actor metadata. Every event opens its real record.

## 7. Evidence graph
Node text is at least 12px. Border uses border token; unsupported claims/criteria have grey dashed borders. Links: green proven, red contradicts, grey dashed no proof. Legend at top right; criterion result dot. Never use green for a node without a linked test.

## 8. Honesty
- Never show “Signature checked” or green integrity without both `verified === true` and `integrity === 'hmac'`.
- Keep “Hash only · signature not checked” and “Integrity is not approval” visible at the existing locations.
- Show only actual RunDoc data: no placeholder counts or invented trends/events. Claims never become proof.
- Times stay local, with a zone abbreviation, formatted in English (`en-GB`, 24-hour); relative times can accompany them.
- Do not translate, rename or alter recorded content, RunDoc field names or wire values.

## 9. Logo
Rebuild the supplied shield/eye/check logo as clean wordmark and icon SVGs. Truth is green and Lens is white, in the SVG and header. Both logos and actual results use the single --ok #1CDC44; no separate brand token. Shield outline uses text white. Use the wordmark in the desktop header and icon in sidebar/mobile header. Generate favicon.svg, favicon.ico (32) and apple-touch-icon.png (180) from the same theme palette. Outside the logo, green is reserved for real results or verified signatures.

## 10. UI language and plain names
**UI language: English only, no German.** This covers visible text, accessible names, titles, tooltips, placeholders, alt text, empty/error states, navigation, drawers/sheets and Navigator. Document language is en; document title is TruthLens. Use the approved glossary exactly; other wording must be plain, literal English without jargon or marketing.

Use Overview, Project overview, Run/Runs, Exported runs, Evidence, Proven, No proof, Not checked, Open, Criteria/Criterion, Claim, Task/Result, Timeline, Event/Events, Start/End/Duration, File/Files and Close. Use Open run, Open record, Open file, Filter selected evidence, All records and links as a list, Recorded links, Criterion links and Graph records. Navigator says “Navigator coming later”; its suggestions are “Example questions (static)”.

The neutral seal is exactly “Hash only · signature not checked”. The checked label is “Signature checked”, subject to the integrity guard above. The approval boundary is “Integrity is not approval”. `npm run check:language`, rendered-DOM tests and browser review protect the English-only UI. Export data remains unchanged.

## 11. Accessible labels and scrollable records
- Button names must include their visible text in reading order, including status, sequence/type metadata and times. Prefer names derived from content; keep explicit action labels only when they include the visible label. Mobile navigation uses its visible short name.
- Scrollable code, diff and raw-data blocks are in the Tab order (`tabIndex={0}`), use the existing `--info` focus outline, and retain native arrow-key scrolling. No changes to colour or type tokens are needed.
