# TruthLens Viewer — Workspace design contract

## Reference runs surface, 26 October 2026

The reference catalog has three areas: Übersicht (`/runs`), Prüfdetails
(`/checks`), and Nachweise (`/records`). `/runs/:id` opens one task.
Technical events sit in a closed developer disclosure. `/settings` and
`/doctor` stay footer tools. `/` and `/?view=overview` stay the evidence
workspace, including its honesty seals and the production “Not connected”
state. That workspace is not this catalog and does not gain a task store,
an orchestration panel, or an artifact gallery.

The reference surface is scoped under `.tl-ref` in
`viewer/src/reference/theme.css`. German chrome lives only in
`viewer/src/reference/copy.ts`. Recorded task text is data, not chrome.
The owner mockups replace the green-tinted near-black with a neutral
background `#0a0a0b`, cards `#111113`, and a 1px border. There is no card
shadow. The logo square is the only gradient (violet to cyan). The active
project chip is a violet outline. The demo badge is a dashed amber outline
and reads “Beispieldaten”; a demo catalog does not name a publish directory
as its source. Type uses the already vendored Plus Jakarta Sans and
JetBrains Mono for identifiers and evidence. Layout targets: sidebar 228px,
header 56px, content padding 28px (16px below 768px), timeline 360px. The
evidence-workspace 12/14/16/20/28px scale still binds that surface; the
reference theme file is the only place that also uses 13px and 22px.

Honesty rules still bind this surface:

- Demo data is visible only with `?demo=1` and the label “Beispieldaten”.
- Human words are display-only: stored `confirmed` shows TRUE, `refuted`
  shows FALSE, and `unclear` shows UNKNOWN. A `benchmark_missing` reason
  shows UNKNOWN even when a stored claim says confirmed. One refuted claim
  still shows FALSE. Zero claims, an unfinished audit, incomplete execution,
  or unknown integrity stay at most UNKNOWN. Stored values and the D34
  statuses `passed` / `failed` / `not_checkable` do not change.
- `integrity=failed`, a bad shape, or counts that disagree with the claims
  render “Nachweis beschädigt oder inkonsistent”. Confirmed claims from that
  run are not shown and are not counted.
- Hash-only evidence shows “Hash only · signature not checked”. “Integrität
  ist keine Freigabe.” stays visible. HMAC text appears only when the
  projection integrity is `hmac`.
- The browser doctor never uses a green confirmed pill. Isolation stays
  unverified. Recheck in the browser ends as “Kein Auditdienst verbunden”.
- Filters in the query string apply to the table and the figures above it.

Derived export headlines describe the presence of recorded claims without
inventing a quotation or inferring completion. Both Python exports and local-folder
derived exports say “Your agent made recorded claims.” when claims exist; with
none, retain the neutral no-claim headline. Original claim text and findings stay
unchanged. This metadata wording introduces no visual, integrity or approval change.

## Verdict and integrity data boundary, 26 October 2026

Step 5 retains criterion pills, the criterion ring and unsmoothed criterion-ratio
trend. RunDoc does not contain Phase F's audit version, checks (including required
flags, outcomes and evidence/criterion joins), conclusion, authentication or input
digests. Its criteria, claims, exit code and integrity cannot reproduce
`project_status` or its fixed reason codes. No overall verdict, passed-run count
or pass-rate trend is inferred, and no Python/export/wire/legacy MCP change is made.

Replace the hardcoded hash-only notice with the loaded export's integrity result.
Only `verified === true && integrity === 'hmac'` gets a green seal stating that
the protocol was unchanged and HMAC checked **at export**. Hash-only and unchecked
signatures stay neutral grey; failure is red. Mixed sets list actual counts for
each state across accepted, deduplicated loaded runs; they never claim all verified.
Keep the check scope explicit: the browser performs no signature verification.
Run detail and source details use the same guard. Empty workspaces report no
integrity result. Integrity is not approval stays visible.

The compact header adds Stand / As of from the latest valid loaded run **start**,
following the overview's bounded acceptance and deduplication rules. Use short
German/English dates in Europe/Berlin, with the zone visible and a full zoned
timestamp in the title. With no dated run, say the time is unavailable; never
substitute load time, wall clock, an unloaded catalog entry or an example date.
Keep explicit development fixture provenance visible, with no example label in
production. Preserve the local font, existing tokens and 12/14/16/20/28px scale;
warnings stay grey, with no amber, network, dependencies or new assets.

Acceptance: red-first tests cover the integrity guard and mixed/deduplicated
counts, no false verdict, empty/undated data, latest loaded start, timezone/DST
and language. Extend the synthetic fixture and manual review script to cover
checked and hash-only exports (synthetic flags never prove verification).
Run npm test in UTC and Europe/Berlin, lint and build. Chrome/axe/screenshots at
1440×900 and 390×844 remain for VPSMan; no browser installation or network here.

## Overview with many or one run, 26 October 2026

Step 4 keeps the approved palette, local fonts, 12/14/16/20/28px type scale,
1208px desktop column, 320px score card and mobile chart strip. With at least
two dated runs containing criteria, draw the actual met/total ratios as an
unsmoothed line in chronological run order. Stacked columns and agent bars count
recorded criterion outcomes; latest-run pills describe criteria, never a run verdict.
Below the ring, use a quiet sentence counting unmet, not checkable and proposed
criteria. Keep full status counts in the accessible chart data and details.

With fewer than two dated runs with criteria, explain the trend requirement
instead of showing a large ratio and an isolated dot. With one loaded run, show
its criterion counts and a comparison explanation instead of a narrow column.
Use the same minimum chart-body height so these states retain balanced geometry.
No criteria/dates remains explicit; no synthetic chart marks fill the space.
Agent names in bars and run rows stay on one line with ellipsis, full text nodes
and title; mobile row names remain available to assistive technology.
Fixed overview labels are German by default and English when selected; recorded
strings stay exact. Warnings remain grey; reduced motion and native keys remain.

`fixtures/overview-multirun.fixture.mjs` supplies fourteen explicitly synthetic
development documents, three fixture agents and mixed criterion outcomes for
tests/manual review only. The separate review HTML entry renders the real shell,
overview and run summary without adding an App import, data endpoint or product
control. Its fixture label stays visible in the existing source-label position.
It is not a production build entry; production empty state has no sample data.
Synthetic reports are neither recorded witnesses nor human approvals. Browser
review must capture single/multiple runs at 1440×900 and 390×844 with unrestricted
axe; missing Chrome leaves visual/accessibility qualification open.
Frozen contracts, G1 broker/wire/adapter boundary and D34 stay unchanged;
agents get STATUS ONLY. No new I/O, dependencies, assets or external requests.

## Run detail polish, 26 October 2026

Step 3b keeps the summary's existing geometry, data joins and honesty boundary.
Use round inline SVG check/cross/question icons beside visible result words and
a right-aligned pill-shaped native Why disclosure with a 44px hit target. Keep
criterion status separately labelled when claims have their own findings; every
`claim_unwitnessed` stays a red gap, including beside an unverified criterion.
Multiple findings remain individually visible. No claim uses criterion status as
its finding. Missing reasons stay explicit; never assert no evidence was found.
Supported comparison connectors are green and solid; gaps are red and dashed
with a red-tinted evidence cell; unverified/proposed criterion prefixes are grey
questions. Keep visible words alongside all shapes.

Timeline dots use blue for recorded human actors, green only for wrapper/system
test reports with positive passed and zero failed counts and no nonzero exit,
red for recorded failures, and grey otherwise. Exit 0, file records and agent
claims never establish a passed check. Test timeout/isolation exits (124/125)
stay grey absent recorded failed tests. Dots share a vertical line; timestamps
use the body font, tabular figures and right alignment at both breakpoints.
Run-summary focus uses the green accent in `:focus-visible`; suppress only the
non-keyboard heading outline while retaining programmatic navigation focus.
German fixed labels include Befund; raw field values remain recorded text.
No new dependencies, I/O, assets, contracts or agent access. Author self-review
does not qualify independent security approval. Browser geometry, focus and axe
need Chrome review at 1440×900 and 390×844; DOM checks alone do not qualify them.

## Run detail visual parity, 26 October 2026

Step 3 applies the approved `desktop-lauf*.png` / `mobile-lauf*.png` geometry
and the overview palette to the human run summary. Reuse its compact header,
1208px column, 12px mobile gutters, local Plus Jakarta Sans, token colours and
12/14/16/20/28px scale. No amber, gradients, glow, external assets or dependencies.
The header leads to the overview and identifies project, agent and recorded start.
Show a criterion score ring, all four status counts and a plain sentence counting
recorded claims/findings separately from met criteria. Never infer a run verdict.

Render one card per criterion and additional cards for claims with no matching
criterion. Preserve every linked claim and missing reference; never substitute a
criterion's text for an agent's words. Three columns on desktop, two on tablet,
one horizontally scrolling strip on mobile with native keys and tap controls.
Each card distinguishes criterion status, claim finding and linked evidence.
Native Why disclosures use fixed templates for status/finding and recorded linked
event type/exit/result/test-count fields. Missing evidence explicitly says no
reason recorded; no inferred absence of file changes, isolation diagnosis or
free-text generation. A supported claim with no criterion remains a claim finding.

Claim/evidence rows use solid supported and dashed unwitnessed connectors, with
actual claim counts and text equivalents; missing criterion/evidence references
stay explicit. Timeline uses original event summaries, actor kinds/IDs and seq
order, short German/English local times and full zoned timestamps in titles.
No exit-0 event turns green as a passed check. All recorded text is React text.

German defaults through the existing fixed overview dictionary; English remains
available. The neutral signature notice and Integrity is not approval stay visible.
Details opens the existing English review workspace, including inspection,
downloads, preview, comparisons and original evidence views. Its legacy theme
preference remains intact; returning to the summary restores the approved palette.
No data read is added. Menu retains workspace tools; explicit/deep/restored run
routes retain their identities. No frozen contract, G1/G2 or D34 change.

Acceptance: red-first DOM regressions for counts, missing/unmatched/proposed
records, text safety, timestamp/localization, navigation and existing inspection;
full Python/viewer suites in UTC and Europe/Berlin, ruff/lint/build. Manual browser
review captures 1440×900 and 390×844, unrestricted axe, menu/Why/Details/keyboard,
empty state and reduced motion. Without Chromium, screenshots, axe and rendered
visual parity remain explicitly unqualified.

## Overview visual parity, 26 October 2026

The owner-approved reference is the four desktop/mobile shots and `src.html` in
`$HOME/specs/truthlens-design/`. Step 2 changes the human overview only.
Use a centered 1208px column, compact TruthLens header, quiet opening sentence,
320px score card beside a two-by-two chart grid, and compact latest-run rows in
one bordered list. On mobile use 12px page gutters, a full-width score, and a
keyboard-focusable horizontally scrolling chart strip with previous/next buttons
and a swipe hint. Use 12px panels and 8px controls, matching the shots. Keep
the 12/14/16/20/28px scale, local Plus Jakarta Sans,
green-tinted near-black tokens, grey warnings and no horizontal page overflow.

The overview is first. Put workspace navigation, tabs, local folder opening and
connection/catalog controls in a native disclosure reached from the small header
menu. Retain source/tab identities, pin/close/restore, explicit connection and
existing downloads/run detail. Opening a run uses the existing route and detail
layout; explicit deep links and restored selections still work. No new I/O,
aggregation, dependencies, telemetry, remote assets or changes to G1/G2/D34.

German is the overview default, with English available through a fixed typed
string table and selector. Only interface strings are translated; recorded names,
IDs, values and evidence remain exact text nodes. Existing run review and
secondary workspace tools stay English with explicit language boundaries.

Use an SVG ring for **met / total recorded criteria**, with red unmet and grey
unverified/proposed segments. Zero criteria has a neutral empty ring, no ratio.
The trend shows actual dated criterion ratios, real point labels and no smoothing;
a single eligible run uses the explanatory state above. Criteria-per-run uses
stacked vertical columns on a shared count scale. Evidence bars count recorded events; agent bars count
criterion outcomes. Latest-run pills explicitly say **criteria** met/unmet/not
checkable/proposed, never an inferred overall verdict. Keep full counts and source
metadata in a disclosure. Charts retain accessible text equivalents.

Round 2 review: score-ring circles have no fill, including status segments;
status colours apply to their strokes and to filled criterion columns. Evidence
bars use the existing green `--accent` token. Agent chart labels stay on one line
with ellipsis, retaining the full text and title. Latest-run buttons take their
accessible name from visible content. Overview dates use a short German/English
local format without seconds, with the full zoned timestamp in the time title
and the original timestamp in `datetime`. Keep existing tokens and type scale.

The mockup's invented overall verdict, moving average and verified-ledger seal
are replaced by supported criteria data and a neutral dashed
“Hash only · signature not checked” notice. “Integrity is not approval” remains
visible in both languages. No example numbers in product; fixtures only in tests
and the separate development review entry.
Check desktop 1440×900/mobile 390×844, unrestricted axe, keyboard, long strings,
no criteria/runs/evidence/dates, reduced motion and existing run opening.
Screenshot evidence for this local-only task stays gitignored.

## Workspace overview, 25 October 2026

The approved overview reference is `$HOME/specs/truthlens-design/src.html`,
with its `DATEN.md` field inventory and shared `DESIGN.md`. Implement the workspace
overview in the existing Runs route (`?view=runs`), now also the fresh workspace
landing page. Explicit run URLs, restored tabs and the existing run review remain
compatible. Step 2 adds the German/English copy specified above.

This step uses loaded documents only: no new requests, automatic catalog reads,
audit computation or broker access. RunDoc has no Phase F overall verdict, so
the headline counts **criteria met**, never runs passed. Four charts show met
criteria over recent runs, all four criterion statuses per run, recorded evidence
kinds, and criterion counts by recorded agent. Missing dates remain undated.
Evidence counts are event counts, not files or tests passed. Claims retain only
supported / claim_unwitnessed; neither becomes a failed run. Agent comparisons
describe these loaded records, not quality or performance rankings.

The overview alone adopts the approved dark green palette: background #070B0A,
surface #0E1513, raised #15201C, border #22312C, text #E6EDEA, secondary #A7B5AF,
metadata #86948E, accent/result #1CDC44, failed #FF7B72, action/focus #79B8FF,
neutral/warnings #97A3B3. Scope these tokens in theme.css to the overview so the
existing run review is not restyled in this step. Keep Plus Jakarta Sans and
JetBrains Mono local, the 12/14/16/20/28px scale, 8px cards and 44px controls.
No amber, gradients, glow, animation, remote assets or chart dependency.

Charts have visible text equivalents and counts, no made-up points or smoothing.
All recorded strings render as React text nodes (DOM textContent), never HTML.
Bound runs and per-run records before aggregation; reject malformed/oversized
documents as a whole and disclose exclusions, duplicates and display limits.
Limits: 1,000 source entries scanned, 200 documents considered, 10,000 entries
per record/reference array, 100,000 total record/reference visits (including
duplicates and rejected documents), and 4,096 characters per displayed string.
Once the global work budget is exceeded, later nonempty documents are excluded.
Group by run ID so repeated snapshots cannot inflate totals. Totals cover all
accepted documents; the latest list and per-run charts cover at most 14 runs.
An empty source has a neutral empty state. The scope notice always states that
signature checking and overall verdicts are unavailable here, and that integrity
is not approval. Check desktop 1440×900 and mobile 390×844, unrestricted axe,
keyboard run opening, long labels, empty state and reduced motion.

Owner-approved Phase A, 23 October 2026. Replaces the Stitch styling contract. The approved plan is [PLAN-redesign-2026-10-23.md](../PLAN-redesign-2026-10-23.md). The development fixture remains available only through Vite's local development middleware. Production may connect only when the user explicitly selects Connect to the fixed same-origin private read API provided through the authorized local socket and SSH repository setup. Production makes no connection attempt on mount and never loads the development fixture. There is no arbitrary URL, public endpoint, or remote source configuration.

## Themes and tokens

Petrol & Porcelain is the default: solid petrol frame #102F38, porcelain reading area #F1F4EF, text #183A42 and secondary text #46656C. Frame text #F1F4EF, secondary #B9CFCE and interaction #97DCD2 have separate roles. Content interaction is dark petrol, never the light frame accent on porcelain.

Cool Graphite is the explicit dark alternative: frame #0D0F13, reading area #181B22, raised surface #1F242E, main text #EDF1F7, secondary #ABB5C5, interaction #A5B4FC. These are owner-approved theme cues, not recorded status. No automatic theme switch on navigation. The theme selector stores only its validated name; storage failure leaves the interface usable. Portalled sheets inherit the root theme.

All literal colours live in src/theme.css; components, graph and SVG use semantic variables/currentColor. Separate frame/reading text, focus, borders, selection, status and mode tokens. Success means recorded proven result, error means recorded failed result, neutral grey means open human review or unchecked/missing. Warnings stay grey; no amber or yellow. Light-theme status text uses dark AA variants; dark theme uses lighter variants. Status surfaces are opaque 8% semantic mixes. Selection uses its own interaction token and aria-current/aria-pressed, never a result colour. Mode labels stay visible and use distinct muted role tokens.

Workspace warning text uses neutral grey: #4B5563 in Petrol & Porcelain
and #ABB5C5 in Cool Graphite. The light warning is darker than `--neutral-text`
to retain AA contrast on nested status tints. The open human-review badge uses this colour for
text and border, with the existing 8% warning surface mix. The overview and
run-summary override stays #97A3B3. The theme check guards this mapping as well
as AA text and 3:1 controls, including tinted and nested status surfaces.

Self-hosted Plus Jakarta Sans Variable for prose; JetBrains Mono for IDs, times, code and numbers. Type scale 12/14/16/20/28px; body 14px, line-height 1.5. Spacing 8/16/24/32px, functional controls target 44px, panel radius 12px and control radius 8px. Optical border/icon/focus widths are exceptions. No new font/dependency/CDN.

## Shell and first review path

Solid full-width header; local fixture source is explicit. Independent Navigation and Inspector controls. At >=1200px: 248px navigation, flexible reading area and 320px non-modal inspector. From 768–1199px navigation remains optional; inspector is a sheet. Below 768px both side panels use accessible sheets, one at a time. No fixed bottom tab bar. Desktop preferences survive a breakpoint change without opening mobile sheets.

Overview, Claims, Timeline and Story share the shell and retain existing ?view= links, browser Back/Forward and Client/Developer lenses. Phase C uses the existing source-aware renderer tabs and a Runs list backed by the Phase B private reader adapter, or supplied development records in development. Imports and export actions remain deferred; Phase D comparison uses already loaded snapshots as described below. No placeholders pretending those features work.

The initial demo overview separates recorded results, claims and approval. Selecting a criterion updates the inspector; when the desktop inspector is closed, selection does not reopen it. Mobile selection opens the criterion sheet. Event/file record actions show exactly referenced records; missing evidence remains missing. Existing shadcn/Radix sheets handle keyboard focus, Escape and return to trigger. Desktop inspection never traps focus. View navigation moves focus only after user navigation, never during initial load or breakpoint changes.

Project preview uses only the actual stored HTML artifact. Sandbox remains opaque, scripts/forms/network blocked, no live URL. Its original styling/bytes remain unchanged. A labelled disclosure bounds the secondary preview instead of forcing a third narrow content column. Iframe itself stays in DOM for regression inspection. Frame and loading surfaces use tokens; responsive canvas sizing never clips a scaled frame and leaves an unintended white area.

## Components — reuse and replacement

Reuse existing MIT shadcn/Radix Button, Badge, Card, Sheet, Tabs, Tooltip; existing RunDoc validator, Overview result/claim derivation, CriterionDetail, Drawer record content, Renderkit, Timeline/Story and graph/Raw fallback. New WorkspaceShell owns panel presentation and ThemeSelect owns the validated theme preference. Existing Header remains a compatibility component; the production App uses the new shell.

Do not import code or instructions from example apps. Agent-Plane 05 has no complete licence/provenance record in the supplied kit: no code copied. Layout ideas and owner-selected colour values are implemented within TruthLens. No foreign event/state/success logic.

## Honesty and data boundary

Run detail and secondary workspace tools use English; the overview uses the fixed German/English table above. Recorded contents stay exact. There is no public demo build. The existing recorded demo is now fixtures/demo-run.json, served at /run.json exclusively by Vite local development middleware. Production starts Not connected and offers an explicit Connect action; no fetch occurs on mount. Connect probes only same-origin /v1/health and /v1/runs, then opens a selected run through /v1/runs/{id}/document. Each source ID is derived from the validated view, registry and run anchor context; every response is checked against its identity. Reads are bounded (10 MiB per document, 1 MiB per catalog); the viewer keeps loaded documents within a 50 MiB total cache budget. No arbitrary URL, fixture in production, external run URL, audit enqueue, agent controls or approval actions. The private reader is reachable only through the authorized local socket and SSH repository setup. Existing Vercel project/deployment settings remain untouched. Preview links are not delivery evidence; PRs carry screenshots. Toolbar/deployment plumbing remains legacy test infrastructure, considered for later owner-approved removal. Widget remains not connected.

“Signature checked” only if verified === true AND integrity === 'hmac'. Neutral “Hash only · signature not checked” and “Integrity is not approval” remain visible. Browser validates structure/internal label consistency, not signatures. Claims, exit 0, human-confirmed criteria and completed jobs never become passed tests or human approval. Frozen contracts stay unchanged.

## Restrained visual rules

No gradients, glow, glassmorphism, emoji or decorative icons. Icons only identify working controls/records. Clear single primary task per view; content-first lists, fewer boxed groups, consistent whitespace. No invented activity, percentages or marketing copy. Reduced motion disables transitions; no entrance animation.

## Accessibility and regression acceptance

Text >=4.5:1 on its actual surface; functional borders, selection and focus >=3:1 against neighbours. Focus is a 2px opaque surface-appropriate outline with offset; never suppress keyboard focus. No autofocus heading on load. Muted text cannot inherit the frame palette onto paper. Selected status tints must also meet text AA.

Four required browser regressions: actual mobile preview content/canvas; last criterion reachable and hit-testable without nav overlap; all secondary text contrast on both themes; delayed initial loading without heading focus/white frame while keyboard focus remains visible. Vitest guards theme restore/failure and user-only focus changes; full browser review covers real geometry and contrast.

Fast PR CI: build/lint/unit/static guards. Manual release review: Playwright 1440x900 and 390x844, both themes and lenses, four views, criterion/event/file sheets, full axe (serious/critical fixed), keyboard and overflow checks; report incomplete findings honestly. Screenshots and axe summary identify the tested commit. Merge guidance follows the standing authorization and task-specific limits in [AGENTS.md](../AGENTS.md); security-sensitive changes require independent Codex review.

## Phase C navigation

The connected catalog's `source_id` identifies the workspace; each registered snapshot's `source_id` identifies its source, while run ID identifies the target and view identifies the renderer. Runs exposes workspace and snapshot IDs as wrapping monospace metadata using the existing 12/14px scale and surface tokens. No new colours, fonts or primitives. The existing reducer dedupes the source/target/renderer tuple, including Claimed vs proven. An empty document cache starts at a canonical Runs URL, so browser Back returns to that catalog. Navigation metadata is bound to the workspace in the existing single 64 KiB storage slot: changing workspaces replaces the saved session, and old unscoped metadata is ignored. Explicit unavailable URL references remain inert. Catalog pages must advance their cursor; late document responses cannot select another tab or replace its content.

Horizontal in-flow workspace controls below the header use the existing tokens on desktop and mobile. A bounded keyboard-scrollable strip exposes separate Select, Pin/Unpin and Close buttons with selected state. Full source/run/view labels remain available through titles; content IDs wrap. No overlay covers criteria. A native details disclosure lists the latest 20 closed references with Restore controls. Closing focuses the next then previous tab, or Open Runs; restoring focuses its selected tab. Pins never prevent explicit close. At 40 open tabs a visible limit rejects new tabs without eviction. Only metadata persists; failure shows “Unsaved on this device.” Unavailable references remain inert with Return to Runs. Runs lists supplied development records in development, and private reader catalog metadata only after explicit production connection; opening a run fetches only that run's document. No production fixture or automatic source fetch.

## Phase D evidence and comparison

Chain, Coverage, Gated actions, Changes and Compare are renderer views in the existing Phase C tab owner. Same source/run/view deduplication, URL history, close/pin/restore and bounded metadata persistence apply. No second navigation host. Claims continues to use Claimed vs proven.

The three audit views fetch only the existing stored-audit GET route when selected, bound to source, run and ledger head. There is no audit execution. All checks in a rule group remain visible: contradictory takes precedence over unchecked, and mixed supported/unchecked is Partially checked. No report or absent rule is Not checked; not applicable stays distinct. Chain means recorded TL-AUD-001 checks, with signature-check records separately disclosed. Coverage shows recorded content/claim/test rules (002 and 004–011), never inferred code-coverage percentages. Gated actions shows TL-AUD-012 outcomes plus original action/approval event records, never an approval action or invented human approval. Actor kinds remain literal and simulated records are explicitly labelled. Original check messages, rule IDs, event/criterion references and limitations stay visible; unavailable references stay missing. Browser validates shape/identity, not cryptography; stored reports are not fresh verification or individual chain-link diagnostics. Failed reads are retryable and obsolete replies cannot update another selected snapshot.

Reuse existing semantic success/error/neutral tokens and 12/14/16/20/28px typography. Unchecked uses neutral grey (`--neutral-text`, `--status-neutral-bg`), separately labelled from red failed checks. No new colour, font or dependency. Changes uses the existing Renderkit boundary to render captured unified diff text with its event record; renderer failure retains safe raw content; absent bodies have an explicit empty state, with no fabricated before-file. Inspector and mobile Sheets retain existing keyboard/focus behavior.

Compare keeps the active snapshot on the left and offers only other already-loaded source/run tuples on the right. Each side repeats source ID, run ID, ledger head, export trust notice, criterion results and any stored diff. Selection is memory-only, reset with the owning tab; eviction becomes unavailable. It does not fetch a new source or compute a pretend before/after diff. Two independent recorded diffs are labelled as such. Stack the two sides below 1200px; no page overflow. No external layout code or domain logic is imported.

## Phase E local folders and individual exports

Open local folder is an explicit read-only browser action, available beside Connect and in Runs. The directory picker requests read permission only; browsers without it offer a directory file input. Local sources use `local-` identities and the existing Phase C tabs, Runs and Phase D evidence views. They remain in memory, outside the registered catalog, private reader, audits and Agent Zero. Refresh leaves only inert navigation metadata. No ZIP or write-back API.

Local opening checks original canonical ledger lines, chain order/close/semantics, recomputed manifest acceptance/artifacts and content-addressed bytes. It never accepts a key or an input RunDoc trust flag. The notice reads “Local folder · not authenticated”, with the existing neutral “Hash only · signature not checked” and visible “Integrity is not approval”. This is a local consistency check, not D34 admission or signature verification. Existing imported RunDoc views retain their export-time trust boundary.

An in-flow details disclosure offers original ledger, manifest and referenced evidence downloads. Every original download uses the captured bytes, not reconstructed text. The separate action is “Download derived RunDoc” and its filename contains `derived`. No inline image decoder or active content is introduced; raster dimensions are checked before opening and binary evidence remains download-only. Limits: 200 files, 10 MiB per file, 32 MiB per folder, 20,000 events, 16 million image pixels/8192 pixels per dimension; loaded local folders share a 50 MiB byte budget. Existing tokens, fonts, spacing, native inputs and shadcn buttons suffice.

Paths reject traversal, absolute/drive paths, backslashes, ambiguous/encoded segments and duplicates. Explicit non-file/symlink entries are rejected. Browser handles/File objects do not expose lstat; a browser that dereferences a symlink cannot establish its original filesystem type. The interface discloses this limitation; browser selection is not an OS symlink audit. No filesystem path is followed by application code.

## Phase F status deck

The existing human stored-audit GET envelope carries a two-field status result
from the shared Python projection: passed/failed/not_checkable and a fixed safe
reason code. The local human `truthlens audit status DIR` command calls that same
projection. Viewer audit views and the standalone widget share StatusDeck; they
validate and display the result without deriving another overall audit verdict.
Existing detailed rule-group summaries remain scoped to their named views.
Missing legacy projection, unavailable sources, loading, interruption and errors
are neutral Not checkable; cached green is cleared before a refresh.

The compact widget shows status and its fixed explanation, with no run IDs,
events, evidence, keys, timestamps or raw server errors. It starts Not connected,
requests nothing until a human selects Connect, and uses only the existing
bounded human reader and selected catalog identity. Refresh is explicit; no
background feed. Both themes reuse the existing neutral/success/error surface
tokens and 12/14/16px scale, with rem units so 200% text enlargement reflows at
320px. No new component dependency. Integrity is not approval stays visible;
the status deck never claims browser signature verification. The viewer's
separate neutral Hash only · signature not checked seal remains unchanged.
Mobile header controls wrap in normal flow when text is enlarged; Navigation,
Inspector and Theme remain reachable without horizontal page scrolling.

No agent uses this human read service. The Phase G status broker, Unix socket,
peer credentials and single tool remain deferred. The legacy MCP command is
unrelated and unchanged. No new API route, listener or write action is added.
