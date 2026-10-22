# TruthLens Viewer – Design rules (Stitch Overview / WERK base)
Binding viewer reference. Use the supplied TruthLens desktop/mobile reference images and Shu's logo.
Purpose: a calm, readable view of recorded evidence. Every colour has a meaning; other content is grey or white.

## 1. Theme profiles (sole colour/font source: src/theme.css)
Shu corrected the Overview direction after the WERK addition: use the approved Stitch colours and fonts. Shu confirmed this palette and typography as final on 2026-10-22. This instruction supersedes WERK-only statements for Overview below and in earlier evidence. `:root[data-viewer-theme=stitch]` overrides semantic tokens centrally; navigation to another existing view restores the WERK base. Root scope includes portalled drawers and is cleaned up on unmount. Do not change export/verification data with theme changes.

### Final Stitch Overview
| Token | Value | Use |
|---|---|---|
| `--bg` | #09090B | Page background |
| `--surface` | #0D0E12 | Cards |
| `--surface-2` | #14151B | Elevated panels |
| `--primary` | #F4F4F5 | Neutral active tabs / brand |
| `--secondary` | #A1A1AA | Secondary controls |
| `--success` | #10B981 | Actual proven results (Stitch emerald) |
| `--error` | #F43F5E | Failed results (Stitch rose) |
| `--warning` | #F59E0B | Approval OPEN (Stitch amber) |
| `--neutral` | #71717A | Neutral indicators and control boundaries |
| `--text` | #F4F4F5 | Main text |
| `--text-2`, `--text-3`, `--neutral-text` | #A1A1AA | AA-readable secondary/neutral text |
| `--error-text` | #FB7185 | AA-readable rose text on tinted badges |
| `--secondary-text` | #D4D4D8 | Secondary active text |
| `--border` | #27272F | Decorative separators |
| `--font` | Plus Jakarta Sans Variable | Locally hosted UI font, OFL-1.1 |
| `--mono` | JetBrains Mono Variable | IDs, hashes and code |

The original muted #71717A is retained as a base indicator/control colour; small text uses the brighter variant for AA. The existing shield is displayed neutral in this profile; base brand SVG assets remain for other views. All theme values remain swappable variables. Spacing/radius/layout and honesty rules remain binding; the current 8px spacing rhythm and12px corners are retained while final visual choices are pending.

### WERK base for the other existing views

Shu approved the shared WERK dark theme on 2026-10-22, replacing the earlier single-green rule. References: `werk-design-system.png` and `truthlens-mockup.png` supplied by Shu. The mockup is a visual reference only; its synthetic data and verification claims must not be copied.

| Token | Hex | Meaning |
|---|---|---|
| `--primary` | #3B82F6 | Brand, selected navigation and primary actions |
| `--secondary` | #8B5CF6 | Secondary actions; never an evidence verdict |
| `--success` | #10B981 | Actual proven/passed results; guarded signature status |
| `--warning` | #F59E0B | Approval OPEN and explicit warnings; never Not checked criteria |
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

Earlier WERK direction (superseded on Overview by the final profile above): Proven=success, Failed=error, Not checked=neutral, Approval OPEN=warning, active navigation=primary. This earlier exclusion of Stitch rose and Plus Jakarta Sans no longer applies to Overview.

The six base colours remain exact. Text variants provide AA contrast on dark surfaces and tinted badges. Filled primary/secondary buttons use dark foregrounds. Compatibility aliases: ok → success, fail → error-text, info → primary-text. No colour literals outside theme.css or raw Tailwind palette classes. Always pair colour with words or shapes. Not checked/open criteria, unsupported and hash-only stay neutral grey. Approval OPEN uses warning; a missing approval statement stays neutral. `npm run check:theme` checks the palette, spacing/radius and text/control contrast pairs; browser axe checks actual rendered combinations.

## 2. Type
The active profile font (Plus Jakarta Sans on Overview, Inter on other views) for UI text, numbers, labels and times, with tabular numbers. JetBrains Mono is reserved for code, hashes, IDs and raw records.
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
- Pills: active profile font 12/600 uppercase, 1px border and 10% status fill. PASSED/PROVEN green, FAILED/UNMET red, REVIEW/PENDING/OPEN criteria grey. Approval OPEN uses warning.
- Neutral dashed seal: “Hash only · signature not checked” and “Integrity is not approval”. Always visible: full text above desktop content; compact “Hash only” in the mobile header, full text in the sheet.
- “Signature checked” is green only when `verified === true` AND `integrity === 'hmac'`.
- Never use green for exit 0, agent completion or “Healthy”. Unsupported is grey, never red.

## 5. Stitch Overview layout and shared navigation
Shu approved `stitch/shu-landing-run1.html` and `.png` on 2026-10-22. Adopt their layout and the final token profile above; never copy invented data or remote scripts. The local approved files take precedence over other Stitch project variants. The final Stitch profile above applies to Overview; WERK remains the base for other views (dependency PR #133 / issue #132).

- Compact solid header (64px desktop, 56px mobile): existing shield, neutral Truth/Lens on Stitch (blue Truth/white Lens on WERK), and tabs for the four existing views. Desktop lens controls stay in the header; mobile navigation remains four bottom tabs. No mountain/hero or additional inactive tabs/actions.
- Overview title is the actual RunDoc project; show actual run ID, agent, start and duration. A real-record button opens full run details. Approval is separate: warning-coloured `Open` when review_required, otherwise neutral `Not stated`; never infer approval from a false review flag, exit code or integrity.
- Three KPI cards: Proven X/Y, Failed and Not checked, computed from criteria. No fabricated percentages, timeout explanations, version/browser/company/hardware metadata or “Run verified”. Keep the full neutral integrity/approval notice visible above the workspace.
- Desktop three-column workspace: criteria and recorded timeline on the left; exported project preview in the centre; selected criterion and its referenced evidence on the right. Criterion buttons update the detail selection with a visible selected state; an explicit action opens the real record. Timeline remains recorded events, not invented phases or durations.
- Graph and code diff remain available in a secondary disclosure. Other views keep their real evidence rail. No fake Share/Export/Re-run actions.
- Preview requires a real HTML artifact entry and its nonempty body in RunDoc.blobs at the referenced hash. Display the exact body as a static, inert sandboxed document with opaque origin, scripts/forms/network blocked, and no external URL. Retain the artifact's own styling as historical content; do not repaint it with Viewer tokens. Expose an accessible real-file record action. Missing artifact/body or unsupported format shows “No project preview available.”; metadata alone never becomes a synthetic preview.

## Responsive (760px or below)
- Compact 56px header and neutral Hash only button; full integrity notice and lens controls in the page.
- Three KPI cards remain readable without horizontal overflow; body text at least12px. Stack criteria, preview, selected detail and timeline in DOM reading order, with bounded timeline scrolling and keyboard access.
- Fixed bottom navigation64px, four existing views;88px bottom clearance.
- Drawers become bottom sheets,12px top corners. Escape/focus restoration and real-record targets remain intact.

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
Keep the supplied shield/eye/check geometry and generate wordmark/icon SVGs from it. Truth uses primary blue and Lens uses text white; shield outline uses text white. Brand colour is independent of success. On Stitch Overview the wordmark and shield are neutral; the base SVG assets remain WERK for the other views. Use the wordmark in the desktop header and icon in sidebar/mobile header. Generate favicon.svg, favicon.ico (32) and apple-touch-icon.png (180) from the same theme palette. Green is reserved for real results or guarded verified signatures.

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

## 13. Criteria confirmation is not a passed check
For `criteria.confirmed`, Timeline and its embedded Overview show “Criteria confirmed by human” only when the recorded actor is human; otherwise “Criteria confirmation recorded”. Add “Confirmation is not a test result.” Use existing informational styling, never a passed-test icon/tone. These labels override a potentially misleading recorded summary in this navigation surface; the exact event/summary remains accessible in its unchanged raw-data drawer. Actual `test.reported` results retain their recorded passed/failed presentation. No schema, RunDoc data or approval-rule changes.

## 14. Client claims, results and evidence together
Both lenses show the exported agent claim separately from the recorded criterion result. In Claimed vs proven, each claim includes only criteria linked by its `criterion_ids`, with its recorded status and referenced evidence summaries/actions. Overview criterion detail includes all claims explicitly linked to that selected criterion. Claim finding is never a test result. Use existing cards, status badges, buttons, spacing, typography and tokens; retain the Stitch Overview layout.

Evidence is resolved only from `criterion.evidence` event IDs; never guess by prose, actor timing or matching claim finding. Unverified is labelled “Not checked — no confirmed result exported.” Missing events and missing criterion/claim links are stated explicitly; missing evidence does not erase an independently exported criterion status or fabricate a test. Event buttons open the exact referenced record. No changes to exports, event schema, approval rules or signature guards.
