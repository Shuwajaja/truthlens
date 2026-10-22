# Viewer UI pipeline

Binding implementation of the UI pipeline for this repository. `viewer/DESIGN.md` wins over general upstream advice. Review only changed components and affected behavior; avoid unrelated refactors and whole-repository instruction dumps.

1. Read and update [viewer design](../viewer/DESIGN.md) before UI code. Preserve the integrity guard, neutral hash-only notice, visible approval boundary, real export data and English UI. Tokens and type scale remain the source of visual decisions.
2. Prefer existing shadcn/Magic UI components when components are needed. Origin UI/coss code is excluded (AGPL).
3. Apply the [local React checklist](../.agents/skills/react-best-practices.md) to changed React code, then the [local interface checklist](../.agents/skills/web-interface-review.md). Record findings as `file:line – rule`, with measured evidence where relevant. The [vetting record](../.agents/skills/README.md) pins source versions and licenses. Do not install upstream skill scripts/hooks or fetch changeable instructions during routine reviews.
4. Run the checks below, then capture desktop **1440×900** and mobile **390×844** with headless Playwright and full unrestricted axe. Fix confirmed serious/critical findings. Exercise both lenses and affected views/drawers/sheets. Report browser errors, manual findings and unresolved axe `incomplete` items separately from passes.
5. Publish screenshots and a concise axe summary in the PR or `docs/screenshots/<branch>/`; identify the tested commit/tree, exact viewports, coverage and limitations. Never report a mocked loader as a functioning comments service.
6. No merge without Shu's explicit OK and green CI. Do not restart services, delete files or print secrets.

## Checks and their limits

| Check | What it verifies | What still needs review |
| --- | --- | --- |
| `cd viewer && npm test` | English check, toolbar environment build matrix, behavioral tests | Requirements outside covered tests |
| `npm run lint` | Configured React/TypeScript checks, including Rules of Hooks | Effect design, async sequencing, stale responses and measured render cost |
| `npm run check:styles` | Semantic colour tokens | Layout, meaning and overlay occlusion |
| `npm run check:language` | Known non-English UI strings | Plain English wording and recorded-data preservation |
| `npm run build` | TypeScript and production bundling | Production deployment settings or performance claims |
| `npm run check:toolbar` | Emitted toolbar loader only for exact `VERCEL_ENV=preview`; unset/production/development/unknown excluded | Vercel's independent platform injection settings |
| `npm run check:toolbar -- --browser` | Chromium checks of built preview/production, real loader insertion, reuse and failed-network behavior; exact viewport screenshots | Authenticated hosted Comments, login/permissions and third-party overlay accessibility |
| `node scripts/audit-a11y.mjs` | 48 unrestricted axe scans, both lenses, all four views/baseline dialogs/all criterion tabs at1440×900/390×844; keyboard scrolling/trapping/return, dialog/tab AX semantics and incomplete-node CSS contrast review | Unknown incomplete cases, real spoken screen-reader output, other exports and every tab of every possible record |

CI runs the full audit above as a required viewer-job step after a successful build, in addition to tests/lint/styles/language and screenshot review. Coverage gaps, any axe violation, browser errors and failed keyboard checks fail the job. No rules/tags are filtered. Screenshots/raw JSON (including incomplete nodes and partial failure evidence) upload with `always()` for30 days. CI green certifies these executed checks, not a blanket WCAG pass or spoken screen-reader review. Do not repeat successful checks unless code, environment or an unresolved concern changed.

## Preview comments boundary

The viewer includes a lazy official Vercel injection-script loader only when the build environment is exactly `VERCEL_ENV=preview`; there is no `VITE_*` opt-in switch or hostname heuristic. It reuses an existing Vercel script/custom element, and an unavailable comments service leaves the viewer usable. The final dependency tree is unchanged.

Preview deployment provisioning is maintained separately in `p3/pr-previews`; this integration adds no project, deployment workflow or credentials. In that existing Vercel project's General → Vercel Toolbar settings, use **Preview: On**, **Production: Off**, and enable Comments for the intended reviewers. The application's build gate cannot prevent Vercel or a browser extension from independently injecting a toolbar into production. Keep the Vercel production setting off; do not enable production feedback via environment overrides.

Use a real authenticated preview to check Comments, keyboard focus, trust text, mobile bottom navigation and the third-party overlay. Read-only inspection of an existing thread can be evidence; posting a test comment requires explicit authorization to send it. Report project/auth access limitations honestly. Preview comments are product feedback, never ledger approval events.

References: [Vercel visibility and environment settings](https://vercel.com/docs/vercel-toolbar/managing-toolbar), [official injection script](https://vercel.com/docs/vercel-toolbar/in-production-and-localhost/add-to-localhost), [Comments](https://vercel.com/docs/comments).
