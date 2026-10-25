# TruthLens Viewer — Workspace design contract

Owner-approved Phase A, 23 October 2026. Replaces the Stitch styling contract. The approved plan is [PLAN-redesign-2026-10-23.md](../PLAN-redesign-2026-10-23.md). The development fixture remains available only through Vite's local development middleware. Production may connect only when the user explicitly selects Connect to the fixed same-origin private read API provided through the authorized local socket and SSH repository setup. Production makes no connection attempt on mount and never loads the development fixture. There is no arbitrary URL, public endpoint, or remote source configuration.

## Themes and tokens

Petrol & Porcelain is the default: solid petrol frame #102F38, porcelain reading area #F1F4EF, text #183A42 and secondary text #46656C. Frame text #F1F4EF, secondary #B9CFCE and interaction #97DCD2 have separate roles. Content interaction is dark petrol, never the light frame accent on porcelain.

Cool Graphite is the explicit dark alternative: frame #0D0F13, reading area #181B22, raised surface #1F242E, main text #EDF1F7, secondary #ABB5C5, interaction #A5B4FC. These are owner-approved theme cues, not recorded status. No automatic theme switch on navigation. The theme selector stores only its validated name; storage failure leaves the interface usable. Portalled sheets inherit the root theme.

All literal colours live in src/theme.css; components, graph and SVG use semantic variables/currentColor. Separate frame/reading text, focus, borders, selection, status and mode tokens. Success means recorded proven result, error means recorded failed result, amber means open human review, neutral means unchecked/missing. Light-theme status text uses dark AA variants; dark theme uses lighter variants. Status surfaces are opaque 8% semantic mixes. Selection uses its own interaction token and aria-current/aria-pressed, never a result colour. Mode labels stay visible and use distinct muted role tokens.

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

English UI; recorded contents stay exact. There is no public demo build. The existing recorded demo is now fixtures/demo-run.json, served at /run.json exclusively by Vite local development middleware. Production starts Not connected and offers an explicit Connect action; no fetch occurs on mount. Connect probes only same-origin /v1/health and /v1/runs, then opens a selected run through /v1/runs/{id}/document. Each source ID is derived from the validated view, registry and run anchor context; every response is checked against its identity. Reads are bounded (10 MiB per document, 1 MiB per catalog); the viewer keeps loaded documents within a 50 MiB total cache budget. No arbitrary URL, fixture in production, external run URL, audit enqueue, agent controls or approval actions. The private reader is reachable only through the authorized local socket and SSH repository setup. Existing Vercel project/deployment settings remain untouched. Preview links are not delivery evidence; PRs carry screenshots. Toolbar/deployment plumbing remains legacy test infrastructure, considered for later owner-approved removal. Widget remains not connected.

“Signature checked” only if verified === true AND integrity === 'hmac'. Neutral “Hash only · signature not checked” and “Integrity is not approval” remain visible. Browser validates structure/internal label consistency, not signatures. Claims, exit 0, human-confirmed criteria and completed jobs never become passed tests or human approval. Frozen contracts stay unchanged.

## Restrained visual rules

No gradients, glow, glassmorphism, emoji or decorative icons. Icons only identify working controls/records. Clear single primary task per view; content-first lists, fewer boxed groups, consistent whitespace. No invented activity, percentages or marketing copy. Reduced motion disables transitions; no entrance animation.

## Accessibility and regression acceptance

Text >=4.5:1 on its actual surface; functional borders, selection and focus >=3:1 against neighbours. Focus is a 2px opaque surface-appropriate outline with offset; never suppress keyboard focus. No autofocus heading on load. Muted text cannot inherit the frame palette onto paper. Selected status tints must also meet text AA.

Four required browser regressions: actual mobile preview content/canvas; last criterion reachable and hit-testable without nav overlap; all secondary text contrast on both themes; delayed initial loading without heading focus/white frame while keyboard focus remains visible. Vitest guards theme restore/failure and user-only focus changes; full browser review covers real geometry and contrast.

Fast PR CI: build/lint/unit/static guards. Manual release review: Playwright 1440x900 and 390x844, both themes and lenses, four views, criterion/event/file sheets, full axe (serious/critical fixed), keyboard and overflow checks; report incomplete findings honestly. Screenshots and axe summary identify the tested commit. No merge without independent security check and Shu approval.

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

No agent uses this human read service. The Phase G status broker, Unix socket,
peer credentials and single tool remain deferred. The legacy MCP command is
unrelated and unchanged. No new API route, listener or write action is added.
