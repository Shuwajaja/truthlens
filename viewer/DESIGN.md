# TruthLens Viewer — Workspace design contract

Owner-approved Phase A, 23 October 2026. Replaces the Stitch styling contract. The approved plan is [PLAN-redesign-2026-10-23.md](../PLAN-redesign-2026-10-23.md). Only the local development fixture evidence path is connected. The single local production build contains no fixture and shows Not connected; no local reader or server integration is implemented.

## Themes and tokens

Petrol & Porcelain is the default: solid petrol frame #102F38, porcelain reading area #F1F4EF, text #183A42 and secondary text #46656C. Frame text #F1F4EF, secondary #B9CFCE and interaction #97DCD2 have separate roles. Content interaction is dark petrol, never the light frame accent on porcelain.

Cool Graphite is the explicit dark alternative: frame #0D0F13, reading area #181B22, raised surface #1F242E, main text #EDF1F7, secondary #ABB5C5, interaction #A5B4FC. These are owner-approved theme cues, not recorded status. No automatic theme switch on navigation. The theme selector stores only its validated name; storage failure leaves the interface usable. Portalled sheets inherit the root theme.

All literal colours live in src/theme.css; components, graph and SVG use semantic variables/currentColor. Separate frame/reading text, focus, borders, selection, status and mode tokens. Success means recorded proven result, error means recorded failed result, amber means open human review, neutral means unchecked/missing. Light-theme status text uses dark AA variants; dark theme uses lighter variants. Status surfaces are opaque 8% semantic mixes. Selection uses its own interaction token and aria-current/aria-pressed, never a result colour. Mode labels stay visible and use distinct muted role tokens.

Self-hosted Plus Jakarta Sans Variable for prose; JetBrains Mono for IDs, times, code and numbers. Type scale 12/14/16/20/28px; body 14px, line-height 1.5. Spacing 8/16/24/32px, functional controls target 44px, panel radius 12px and control radius 8px. Optical border/icon/focus widths are exceptions. No new font/dependency/CDN.

## Shell and first review path

Solid full-width header; local fixture source is explicit. Independent Navigation and Inspector controls. At >=1200px: 248px navigation, flexible reading area and 320px non-modal inspector. From 768–1199px navigation remains optional; inspector is a sheet. Below 768px both side panels use accessible sheets, one at a time. No fixed bottom tab bar. Desktop preferences survive a breakpoint change without opening mobile sheets.

Overview, Claims, Timeline and Story share the shell and retain existing ?view= links, browser Back/Forward and Client/Developer lenses. Phase A does not add the later renderer-tab lifecycle, source catalog, imports, compare or export actions. No placeholders pretending those features work.

The initial demo overview separates recorded results, claims and approval. Selecting a criterion updates the inspector; when the desktop inspector is closed, selection does not reopen it. Mobile selection opens the criterion sheet. Event/file record actions show exactly referenced records; missing evidence remains missing. Existing shadcn/Radix sheets handle keyboard focus, Escape and return to trigger. Desktop inspection never traps focus. View navigation moves focus only after user navigation, never during initial load or breakpoint changes.

Project preview uses only the actual stored HTML artifact. Sandbox remains opaque, scripts/forms/network blocked, no live URL. Its original styling/bytes remain unchanged. A labelled disclosure bounds the secondary preview instead of forcing a third narrow content column. Iframe itself stays in DOM for regression inspection. Frame and loading surfaces use tokens; responsive canvas sizing never clips a scaled frame and leaves an unintended white area.

## Components — reuse and replacement

Reuse existing MIT shadcn/Radix Button, Badge, Card, Sheet, Tabs, Tooltip; existing RunDoc validator, Overview result/claim derivation, CriterionDetail, Drawer record content, Renderkit, Timeline/Story and graph/Raw fallback. New WorkspaceShell owns panel presentation and ThemeSelect owns the validated theme preference. Existing Header remains a compatibility component; the production App uses the new shell.

Do not import code or instructions from example apps. Agent-Plane 05 has no complete licence/provenance record in the supplied kit: no code copied. Layout ideas and owner-selected colour values are implemented within TruthLens. No foreign event/state/success logic.

## Honesty and data boundary

English UI; recorded contents stay exact. There is no public demo build. The existing recorded demo is now fixtures/demo-run.json, served at /run.json exclusively by Vite local development middleware. Production contains no run fixture, performs no source fetch and shows Not connected until the separately approved local reader exists. No private imports, external run URL, live connector, BFF, audit enqueue, agent controls or approval actions. Separate local reader and D34 decision are deferred. Existing Vercel project/deployment settings remain untouched. Preview links are not delivery evidence; PRs carry screenshots. Toolbar/deployment plumbing remains legacy test infrastructure, considered for later owner-approved removal. Widget remains not connected.

“Signature checked” only if verified === true AND integrity === 'hmac'. Neutral “Hash only · signature not checked” and “Integrity is not approval” remain visible. Browser validates structure/internal label consistency, not signatures. Claims, exit 0, human-confirmed criteria and completed jobs never become passed tests or human approval. Frozen contracts stay unchanged.

## Restrained visual rules

No gradients, glow, glassmorphism, emoji or decorative icons. Icons only identify working controls/records. Clear single primary task per view; content-first lists, fewer boxed groups, consistent whitespace. No invented activity, percentages or marketing copy. Reduced motion disables transitions; no entrance animation.

## Accessibility and regression acceptance

Text >=4.5:1 on its actual surface; functional borders, selection and focus >=3:1 against neighbours. Focus is a 2px opaque surface-appropriate outline with offset; never suppress keyboard focus. No autofocus heading on load. Muted text cannot inherit the frame palette onto paper. Selected status tints must also meet text AA.

Four required browser regressions: actual mobile preview content/canvas; last criterion reachable and hit-testable without nav overlap; all secondary text contrast on both themes; delayed initial loading without heading focus/white frame while keyboard focus remains visible. Vitest guards theme restore/failure and user-only focus changes; full browser review covers real geometry and contrast.

Fast PR CI: build/lint/unit/static guards. Manual release review: Playwright 1440x900 and 390x844, both themes and lenses, four views, criterion/event/file sheets, full axe (serious/critical fixed), keyboard and overflow checks; report incomplete findings honestly. Screenshots and axe summary identify the tested commit. No merge without independent security check and Shu approval.
