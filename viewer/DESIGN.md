# TruthLens Viewer – Design rules (Final Stitch theme)
Binding viewer reference. Use the supplied TruthLens desktop/mobile reference images and Shu's logo.
Purpose: a calm, readable view of recorded evidence. Every colour has a meaning; other content is grey or white.

## Semantic accents (Shu follow-up, 22 October 2026)
KPI cards use a 4px left status rail, a 10% status tint over the surface, and status-coloured numerals. Proven uses emerald; failed uses rose with rose400 AA text; Not checked stays neutral. Criterion rows and their recorded-result blocks use the same status rails/tints, never a fabricated progress percentage. Approval OPEN alone uses the amber tint; unknown integrity/claims remain neutral.

Central theme tokens define the tints and navigation accent. Active navigation and evidence tabs use an emerald edge/underline plus a subtle emerald tint to mean selected, retaining aria-current/data-state and text. This owner-approved selection meaning is an explicit exception to green-for-recorded-success; selected navigation is never proof. Lens controls use the separate owner-approved mode colours below; the hash-only notice stays neutral. Text contrast >=4.5:1 and meaningful rails/active indicators >=3:1 against both adjacent surfaces; focus keeps its separate opaque neutral ring. No gradients, glow, decorative icons or new cards. All four existing views share these controls; fonts,8px spacing, recorded values and review flow remain unchanged.

## Mode and role identifiers (Shu follow-up, issue148)

Client uses `--mode-client: #9CAFA8`, a low-saturation green-grey (HSL saturation about11%, versus84% for status emerald). Developer uses `--mode-developer: #9EADC2`, a muted cool slate (about23% saturation). These identify the viewing mode, never a result, approval, signature or recorded actor authority. This explicit owner exception permits cool slate for roles while retaining the final Stitch status palette; it does not restore blue navigation or a second theme.

Each has an opaque10% tint over --surface (`--mode-client-bg` / `--mode-developer-bg`). The selected Client/Developer button retains its visible label and aria-pressed, with a2px bottom edge, matching text and tint. A2px top header strip repeats the current mode; no extra card, icon, banner or invented run status. Developer-only sequence/type/actor metadata and raw event details carry a narrow slate rail plus the visible word Developer. Exported human/agent role strings remain exact; a role colour is never approval. Both modes keep the same typography, grid and status colours. Hash-only remains neutral.

Executable theme and browser checks cover text>=4.5:1 and functional rails>=3:1 against zinc bg/surface/surface-2 and the actual selected tint; the opaque neutral focus outline must also remain>=3:1 against those fills. The browser proof for both mode colours has a minimum6.46:1 for mode text and functional edges across these neighbours; retained existing controls have a separate3.08:1 minimum. Colours and tints live only in theme.css. No glow, gradients, colour-only labels or colour changes inside exported artifacts.

## 1. One final Stitch theme (sole colour/font source: src/theme.css)
Shu requires the final Stitch palette on every view, lens, header, graph and portalled drawer. One unconditional `:root` token set; no view-specific theme switching or legacy blue/purple palette. The owner-approved cool slate mode token below is a role cue, not a restored WERK accent. Exported artifact content keeps its historical styling and is not rewritten.

| Token | Value | Meaning |
|---|---|---|
| `--bg` | #09090B | zinc950 page |
| `--surface` | #18181B | zinc900 cards/drawers |
| `--surface-2` | #27272A | zinc800 nested surfaces |
| `--border` | #3F3F46 | zinc700 decorative separators |
| `--text`, `--primary`, `--primary-text`, `--focus` | #F4F4F5 | zinc100 text, neutral buttons and focus |
| `--text-2`, `--text-3`, `--secondary`, `--neutral-text` | #A1A1AA | zinc400 AA secondary text |
| `--secondary-text` | #D4D4D8 | zinc300 control text |
| `--neutral` | #71717A | zinc500 control boundary/unchecked indicator |
| `--success` | #10B981 | emerald500, actual proven results |
| `--error` | #F43F5E | rose500, failure fill/indicator |
| `--error-text` | #FB7185 | rose400, AA-readable failure text on tinted surfaces |
| `--warning` | #F59E0B | amber500, Approval OPEN |
| `--backdrop` | #09090B80 | translucent page-colour overlay |
| `--status-success-bg`, `--status-error-bg`, `--status-warning-bg`, `--status-neutral-bg` | 10% corresponding status + 90% surface | opaque status areas |
| `--navigation-accent`, `--navigation-bg` | success / status-success-bg | selected navigation/tabs, never proof |

Plus Jakarta Sans Variable everywhere; JetBrains Mono Variable for IDs/code. Self-hosted fonts, OFL-1.1. Spacing8px, radius12px. No literal colours or default Tailwind palette classes outside theme.css in viewer/src; CSS/SVG/graph/inline styles use semantic variables, currentColor or transparent. `check:styles` enforces this in CI and has regression fixtures. Generated standalone brand assets resolve tokens at build time and use Plus Jakarta Sans; those generated files are outside src.

Focus uses `--focus`, not the informational alias: opaque2px outline with3px offset. The offset leaves the underlying zinc surface between a light filled control and its outline, so adjacent pixels are the surrounding surface, never the matching control fill. Outline contrast must be >=3:1 against bg/surface/surface-2 and tinted control neighbours; check:theme records each ratio, browser checks computed outlines and keyboard reachability. `--color-ring` also resolves to --focus; do not dilute the outline. Text pairs >=4.5:1, including rose400 on rose50010% badges. Hash-only/unchecked remain neutral; integrity is not approval stays visible.

## 2. Type
Plus Jakarta Sans Variable for prose; JetBrains Mono for numeric glyphs, times, code, hashes, IDs and raw records, with tabular numbers.
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
- Pills: Plus Jakarta Sans 12/600 uppercase, 1px border and 10% status fill. PASSED/PROVEN green, FAILED/UNMET red, REVIEW/PENDING/OPEN criteria grey. Approval OPEN uses warning.
- Neutral dashed seal: “Hash only · signature not checked” and “Integrity is not approval”. Always visible: full text above desktop content; compact “Hash only” in the mobile header, full text in the sheet.
- “Signature checked” is green only when `verified === true` AND `integrity === 'hmac'`.
- Never use green for exit 0, agent completion or “Healthy”. Unsupported is grey, never red.

## 5. Stitch Overview layout and shared navigation
Main-view URLs use the existing four view IDs in `?view=overview`, `?view=claimed-vs-proven`, `?view=timeline` or `?view=agent-story`. Direct links/reload restore that view; navigation adds a browser history entry only when the view changes, and Back/Forward restores it. Missing/unknown values show Overview. Keep unrelated query parameters/path/hash and existing lens persistence independent. No new Share control, router, visual styling or exported-data changes.

Shu approved `stitch/shu-landing-run1.html` and `.png` on 2026-10-22. Adopt their layout and the final token profile above; never copy invented data or remote scripts. The local approved files take precedence over other Stitch project variants. The final Stitch profile above applies to all views.

- Compact solid header (64px desktop, 56px mobile): existing shield, neutral Truth/Lens, and tabs for the four existing views. Desktop lens controls stay in the header; mobile navigation remains four bottom tabs. No mountain/hero or additional inactive tabs/actions.
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
Keep the supplied shield/eye/check geometry and generate wordmark/icon SVGs from it. Truth and Lens use neutral text; shield outline uses text white. Brand colour is independent of success. The wordmark and shield are neutral on every view. Use the wordmark in the desktop header and icon in sidebar/mobile header. Generate favicon.svg, favicon.ico (32) and apple-touch-icon.png (180) from the same theme palette. Green is reserved for real results, guarded verified signatures and the explicitly approved navigation/tab selection accent.

## 10. UI language and plain names
**UI language: English only, no German.** This covers visible text, accessible names, titles, tooltips, placeholders, alt text, empty/error states, navigation, drawers/sheets and Navigator. Document language is en; document title is TruthLens. Use the approved glossary exactly; other wording must be plain, literal English without jargon or marketing.

Use Overview, Project overview, Run/Runs, Exported runs, Evidence, Proven, No proof, Not checked, Open, Criteria/Criterion, Claim, Task/Result, Timeline, Event/Events, Start/End/Duration, File/Files and Close. Use Open run, Open record, Open file, Filter selected evidence, All records and links as a list, Recorded links, Criterion links and Graph records. Navigator says “Navigator coming later”; its suggestions are “Example questions (static)”.

The neutral seal is exactly “Hash only · signature not checked”. The checked label is “Signature checked”, subject to the integrity guard above. The approval boundary is “Integrity is not approval”. `npm run check:language`, rendered-DOM tests and browser review protect the English-only UI. Export data remains unchanged.

## 11. Accessible labels and scrollable records
- Button names must include their visible text in reading order, including status, sequence/type metadata and times. Prefer names derived from content; keep explicit action labels only when they include the visible label. Mobile navigation uses its visible short name.
- Scrollable code, diff and raw-data blocks are in the Tab order (`tabIndex={0}`), use the `--focus` outline, and retain native arrow-key scrolling. No changes to colour or type tokens are needed.

## 12. Preview review toolbar
- Vercel Comments is optional review tooling only in builds with `VERCEL_ENV=preview`. Production, local development, unset and unknown environments do not include its loader or bundle.
- Load the official toolbar after the viewer mounts; an unavailable toolbar must not block the recorded evidence. Reuse an existing Vercel-injected toolbar/loader rather than adding another one.
- The toolbar is a third-party overlay, not a TruthLens status or approval control. It must not alter RunDoc data, trust wording, tokens or the type scale. Inspect keyboard focus, mobile navigation and trust-text overlap when checking a real authenticated preview.

## 13. Criteria confirmation is not a passed check
For `criteria.confirmed`, Timeline and its embedded Overview show “Criteria confirmed by human” only when the recorded actor is human; otherwise “Criteria confirmation recorded”. Add “Confirmation is not a test result.” Use existing informational styling, never a passed-test icon/tone. These labels override a potentially misleading recorded summary in this navigation surface; the exact event/summary remains accessible in its unchanged raw-data drawer. Actual `test.reported` results retain their recorded passed/failed presentation. No schema, RunDoc data or approval-rule changes.

## 14. Client claims, results and evidence together
Both lenses show the exported agent claim separately from the recorded criterion result. In Claimed vs proven, each claim includes only criteria linked by its `criterion_ids`, with its recorded status and referenced evidence summaries/actions. Overview criterion detail includes all claims explicitly linked to that selected criterion. Claim finding is never a test result. Use existing cards, status badges, buttons, spacing, typography and tokens; retain the Stitch Overview layout.

Evidence is resolved only from `criterion.evidence` event IDs; never guess by prose, actor timing or matching claim finding. Unverified is labelled “Not checked — no confirmed result exported.” Missing events and missing criterion/claim links are stated explicitly; missing evidence does not erase an independently exported criterion status or fabricate a test. Event buttons open the exact referenced record. No changes to exports, event schema, approval rules or signature guards.

## 15. Shared Stitch components and review path

Inventory and consolidation (all four views):
- Actions: shadcn Button for primary/outline/ghost actions; icon-free text for record navigation. Header tabs/lens controls and timeline rows remain native semantic buttons with the same token focus treatment.
- Cards: one shadcn Card base (surface, border,12px radius,16px padding/gap). Overview panels and Claims articles reuse it; chronological Story records use a divided list. No separate card-wrap styling for Claims.
- Badges: StatusBadge remains the sole exported-status mapping; claim finding, recorded criterion result, approval and integrity remain separate. No decorative success.
- Tabs: shared shadcn Tabs for selected evidence; one Header/Sidebar navigation across all views. No extra permanent desktop evidence rail or inactive Navigator in the shell.
- Tables/properties: existing node-properties definition lists for metadata and existing recorded-payload/diff renderers for raw evidence; shared borders, mono IDs and focusable scrolling. No alternative table theme.
- Headings: PageHeading supplies the same title/action/description layout. Timeline can use level2 when embedded. A real Review criteria action in the other views returns to Overview.
- Empty/loading/error: shared shadcn Empty + compact ViewState/Card. Missing-data copy stays specific; no sample content. Loading uses status, failures alert. Invalid export stays fail-closed.
- Drawer: one existing Sheet/Tabs implementation, now with the selected object in its visible title, while keeping established dialog kind names and trust notices.

Existing Plus Jakarta Sans/JetBrains Mono, type12/14/16/20/28 and8px spacing tokens apply everywhere; add shell/content/header/footer spacing tokens rather than parallel layouts. Four views share Header, tabs, one main content column and the same Drawer. Overview retains its approved three-column workspace inside that column.

UX proposals, individually justified (review points3–8):
3. Adopt: recorded outcome cards select the first real criterion in that category; absent categories have disabled actions. Selecting a criterion moves focus/scroll to its detail, removing the separate mobile “find the detail” step. No outcome is inferred.
4. Adopt: a data-derived outcome sentence accompanies the three separate counts; Approval remains distinct. No run-level verified/approved claim.
5. Adopt: remove duplicate permanent EvidenceRail/Navigator from the shell; role descriptions explain Claims, Timeline and Story. Graph/diff remain optional disclosure. All records remain accessible through the run drawer and selected evidence.
6. Adopt existing simple criterion list as primary; retain secondary Graph and its accessible record/link list. A new graph-layout algorithm is deferred because this task does not need one.
7. Adopt plain purpose/absence explanations and consistent record actions. A new narrative summary or rewriting exported finding vocabulary is deferred: preserve the actual chronology and claims instead of inventing a story.
8. Adopt selected criterion/event/file/claim/run identity in the visible drawer title; preserve contextual evidence tabs, original record identity and focus return. Run-wide evidence and selected records are no longer permanently side-by-side.

These are design decisions, not measured user-study results. URL persistence (point9) and authenticated comments remain separate work.

Drawer focus return must not override a newer deliberate focus target during a view change; restore the trigger only while focus remains in the closing dialog or has fallen back to the body.

## Anti-AI-slop rules (binding)

- No gradients, glow effects or glassmorphism; no blurred/translucent decorative surfaces. Opaque zinc surfaces and plain separators remain the baseline. Focus rings are functional accessibility indicators.
- No decorative icons without a function, no emoji in UI copy. Icons may identify navigation, an action, event type or an actual status; always retain accessible text. Do not display a disabled future feature as a working tool.
- Emerald/green for recorded success and the explicitly approved active-navigation/tab selection accent; rose/red for recorded failure, amber for an open human-review state. Unknown/unverified/hash-only remain neutral. Colour never substitutes for a label or evidence; navigation selection never means proof.
- Exactly one primary purpose per view: Overview evaluates criteria; Claims compares statements with recorded outcomes; Timeline reads chronology; Story reads recorded actions and claims. Secondary technical detail stays subordinate/on demand.
- Prefer fewer cards and more whitespace. Group meaningful tasks, not every sentence or event into another card. Keep the three functional Overview outcome groups; use simple lists for chronological records.
- Consistent8px spacing and existing type scale. UI digits use JetBrains Mono through a digit-only font-face fallback; numeric-only fields/time use --mono directly. Prose stays Plus Jakarta Sans; no raw export text is rewritten.
- Factual, honest English only. No marketing language, invented metrics, decorative verification seals or fabricated results.

The style guard rejects gradients, backdrop blur/filter, glow/drop-shadow utilities and emoji; manual review verifies icon purpose, semantic colour meaning and primary-task hierarchy. The inactive Navigator is not part of the visible review interface. Its standalone legacy controls keep text/function labels, without decorative Compass/Send graphics.

Code additions/removals use neutral styling and retain their literal +/- markers: a source change is not a recorded pass/fail result.
