# TruthLens Viewer — Workspace design contract

Owner-approved Phase A, 23 October 2026. Replaces the Stitch styling contract. The approved plan is [PLAN-redesign-2026-10-23.md](../PLAN-redesign-2026-10-23.md). The development fixture remains available only through Vite's local development middleware. Production may connect only when the user explicitly selects Connect to the fixed same-origin private read API provided through the authorized local socket and SSH repository setup. Production makes no connection attempt on mount and never loads the development fixture. There is no arbitrary URL, public endpoint, or remote source configuration.

## Themes and tokens

Petrol & Porcelain is the default: solid petrol frame #102F38, porcelain reading area #F1F4EF, text #183A42 and secondary text #46656C. Frame text #F1F4EF, secondary #B9CFCE and interaction #97DCD2 have separate roles. Content interaction is dark petrol, never the light frame accent on porcelain.

Cool Graphite is the explicit dark alternative: frame #0D0F13, reading area #181B22, raised surface #1F242E, main text #EDF1F7, secondary #ABB5C5, interaction #A5B4FC. These are owner-approved theme cues, not recorded status. No automatic theme switch on navigation. The theme selector stores only its validated name; storage failure leaves the interface usable. Portalled sheets inherit the root theme.

All literal colours live in src/theme.css; components, graph and SVG use semantic variables/currentColor. Separate frame/reading text, focus, borders, selection, status and mode tokens. Success means recorded proven result, error means recorded failed result, amber means open human review, neutral means unchecked/missing. Light-theme status text uses dark AA variants; dark theme uses lighter variants. Status surfaces are opaque 8% semantic mixes. Selection uses its own interaction token and aria-current/aria-pressed, never a result colour. Mode labels stay visible and use distinct muted role tokens.

Self-hosted Plus Jakarta Sans Variable for prose; JetBrains Mono for IDs, times, code and numbers. Type scale 12/14/16/20/28px; body 14px, line-height 1.5. Spacing 8/16/24/32px, functional controls target 44px, panel radius 12px and control radius 8px. Optical border/icon/focus widths are exceptions. No new font/dependency/CDN.

## Shell and first review path

Solid full-width header; local fixture source is explicit. Independent Navigation and Inspector controls. At >=1200px: 248px navigation, flexible reading area and 320px non-modal inspector. From 768–1199px navigation remains optional; inspector is a sheet. Below 768px both side panels use accessible sheets, one at a time. No fixed bottom tab bar. Desktop preferences survive a breakpoint change without opening mobile sheets.

Overview, Claims, Timeline and Story share the shell and retain existing ?view= links, browser Back/Forward and Client/Developer lenses. Phase C uses the existing source-aware renderer tabs and a Runs list backed by the Phase B private reader adapter, or supplied development records in development. Imports, compare and export actions remain deferred. No placeholders pretending those features work.

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
