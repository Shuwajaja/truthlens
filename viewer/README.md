# TruthLens viewer

React/TypeScript viewer for a local exported RunDoc. Node >=22.19 is required; CI uses Node 24. Run `npm ci`, `npm test`, `npm run lint`, and `npm run build` here. The browser loads only the local `/run.json`; it checks internal consistency, not signatures.

## UI foundations

`src/theme.css` contains the approved base and TruthLens token overrides. Tailwind aliases use those tokens; fonts fall back to system fonts without remote requests. No other product themes are included.

`src/components/ui/` contains source components adapted from [shadcn/ui](https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/new-york-v4/ui), under the adjacent MIT license. Radix supplies keyboard/focus behaviour for Sheet, Tabs, Tooltip, ScrollArea and Separator. Motion is limited to colour/opacity; no animation package is required.

Use `StatusBadge` with exported criterion status, claim finding, or both integrity fields. Semantic variants are private: a caller cannot request an HMAC badge directly. HMAC checked requires `verified === true` **and** `integrity === 'hmac'`; hash-only is always labelled “Nur Hash · HMAC nicht geprüft”. Claims stay visually separate from witnessed criteria. Technical integrity never implies human acceptance.

## Optional screenshots

After building, `npm run screenshots` captures existing views in both lenses under `.screenshots/` (ignored). Playwright is a dev dependency; its Chromium binary and any required local libraries stay inside this clone. See the root README for browser setup. Screenshots are not required by CI.

## Recorded overview (P2)

The header SVGs reuse the supplied TruthLens reference artwork locally. Overview shows one exported run, exported criterion counts and claim findings, and the first actual exported unified diff through RenderKit. Embedded diff snippets in JSON or command logs do not become a diff panel. Missing diff/criteria/events show neutral empty states. Timeline events and criterion buttons open their original recorded detail targets. Full Timeline also exposes native keyboard buttons and absolute UTC times.

The six full-App snapshots deliberately change for the mountain header, responsive navigation, trust warning, overview layout, separate claim badges and accessible Timeline. The four isolated diff/Markdown/plain-text/drawer baselines and three Agent Story snapshots remain unchanged at this step. The optional screenshot script also checks Overview at 1280px and 360px for horizontal overflow.

## Evidence graph and Sheet (P2)

`src/graph/evidence-graph.ts` builds a deterministic, read-only model from exported claims, criteria, evidence/test/artifact events and artifact records. Edges cite their recorded field: criterion evidence IDs, event criterion IDs, exact artifact IDs or exact recorded content hashes. Unknown or ambiguous endpoints are omitted. `claim_unwitnessed` nodes are always isolated; even a `supported` claim has no edge if its criterion has no exported witness. Findings/status remain unchanged.

React Flow displays that model without editing or connecting nodes. Keyboard-accessible node buttons and a complete expandable list open the same recorded details. Claims or files without a matching event show their exported projection and a neutral missing-event/content notice; no event is invented. Graph zoom and the list support inspecting larger exports.

The existing drawer now uses the source Sheet component. It traps focus, supports Escape and restores the actual trigger. Close and the trust notice stay outside the scrolling content. Step 3 intentionally updates two Overview snapshots for Graph and three drawer-shell snapshots for Sheet; the snapshots clone the portal into a fragment so diff/Markdown text stays covered. Plain text and the three Agent Story baselines remain unchanged. jsdom lacks layout/ResizeObserver, so unit tests shim only that API; screenshots verify actual nodes/edges and keyboard activation in Chromium.

The screenshot check exercises desktop mouse clicks, mobile touch taps, all four node kinds by keyboard, focus containment and restoration. Drawer captures use the viewport rather than a full-page image so fixed overlays appear in their real viewport position. React Flow/D3 are bundled separately with their dependencies to keep both JavaScript chunks below the build warning threshold; browser startup is also checked.

## Static Navigator (P2)

The right Navigator can collapse to a rail. Its suggestions, composer and Send button are disabled, with the visible note “Navigator kommt später”. It has no transport, model or generated replies. Collapse state stays in memory. At tablet widths up to 1100px it moves below the content; at phone widths the navigation and content also stack. Narrow criterion cards place badges below their text. The left rail keeps sticky navigation controls on long runs.

Step 4 deliberately changes the six full-App snapshots for the Navigator and the sticky navigation wrapper. All isolated renderer/Sheet and Agent Story snapshots are retained. Screenshots check both Navigator states at 1280, 1024, 900, 768, 701 and 360px, plus scrolled navigation visibility. Other views and drawer interaction remain covered in both lenses.

The main trust notice stays visible while scrolling recorded content; the optional browser check asserts this as well as sticky navigation. The Sheet keeps its own pinned notice above the evidence body.

## P3 review contract

[DESIGN.md](DESIGN.md) is the binding viewer reference. `npm run review:screenshots` captures Overview, Claimed vs Proven, Timeline and Agent Story at 1440px and 420px and checks axe contrast, browser errors and page overflow. Images stay in ignored `.screenshots/review/`. CI publishes them as a `viewer-screenshots-<commit>` artifact for each PR; the PR description links the run and archive. The docs-first PR records the existing UI as a baseline; the following P3 branches apply the design in order. No screenshots or temporary reports are added to source history.

P3 fonts are bundled locally with the build (Inter and JetBrains Mono, SIL OFL via the fontsource packages); viewing a run makes no font request to an external host. The theme defines the five text sizes and uses the information token for general focus and links. Component typography is normalized in the dedicated type-scale branch.

`contracts/` preserves the unchanged RunDoc export vocabulary and fail-closed validator. Its legacy wire card names are data fields, not presentation colours. UI colours are semantic tokens only. `npm run check:styles` rejects colour literals outside theme.css and legacy palette classes in src; CI runs it too.

The P3 screenshot check also inspects computed text sizes and weights in every view. Graph zoom never shrinks text below its declared 12px minimum; pan or the equivalent record list exposes the rest of a large graph.

P3 shell uses the supplied mountain and shield SVG shapes inline so their paints share theme.css. The desktop navigation is 200px; the evidence rail is 300px with real export events, and the static Navigator sits below. No generated response or extra run is implied. Mobile-specific navigation follows in p3/mobile.

Status cards count criteria by their exported result: met, unmet, or still proposed/unverified. They do not count failing runs or infer human acceptance from exit 0. This single-run format has no trend series, so no sparkline is drawn. Run duration comes from the recorded start/end timestamps; missing ends stay missing. Times use local time with a zone abbreviation.
