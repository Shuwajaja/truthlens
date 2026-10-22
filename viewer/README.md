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
