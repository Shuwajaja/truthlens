# Viewer UI pipeline

Binding implementation of the UI pipeline for this repository. `viewer/DESIGN.md` wins over general upstream advice. Review only changed components and affected behavior; avoid unrelated refactors and whole-repository instruction dumps.

1. Read and update [viewer design](../viewer/DESIGN.md) before UI code. Preserve the integrity guard, neutral hash-only notice, visible approval boundary, real export data, English run detail/tools, and fixed German/English overview copy. Tokens and type scale remain the source of visual decisions.
2. Prefer existing shadcn/Magic UI components when components are needed. Origin UI/coss code is excluded (AGPL).
3. Apply the [local React checklist](../.agents/skills/react-best-practices.md) to changed React code, then the [local interface checklist](../.agents/skills/web-interface-review.md). Record findings as `file:line – rule`, with measured evidence where relevant. The [vetting record](../.agents/skills/README.md) pins source versions and licenses. Do not install upstream skill scripts/hooks or fetch changeable instructions during routine reviews.
4. Run the checks below, then capture desktop **1440×900** and mobile **390×844** with headless Playwright and full unrestricted axe. Fix confirmed serious/critical findings. Exercise both lenses and affected views/drawers/sheets. Report browser errors, manual findings and unresolved axe `incomplete` items separately from passes.
5. Publish screenshots and a concise axe summary in the PR or `docs/screenshots/<branch>/`; identify the tested commit/tree, exact viewports, coverage and limitations. Never report a mocked loader as a functioning comments service.
6. Follow the standing merge authorization in [AGENTS.md](../AGENTS.md): current-head CI and appropriate independent review permit the supervising agent to merge without another owner confirmation. Merging does not authorize live service changes, public deployment or destructive cleanup. Never print secrets.

## Checks and their limits

| Check | What it verifies | What still needs review |
| --- | --- | --- |
| `cd viewer && npm test` | Fixed bilingual overview/English detail check, toolbar environment build matrix, behavioral tests | Requirements outside covered tests |
| `npm run lint` | Configured React/TypeScript checks, including Rules of Hooks | Effect design, async sequencing, stale responses and measured render cost |
| `npm run check:styles` | Semantic colour tokens | Layout, meaning and overlay occlusion |
| `npm run check:language` | German copy confined to the approved overview dictionary | Copy quality, complete translations and recorded-data preservation |
| `npm run build` | TypeScript and production bundling | Production deployment settings or performance claims |
| `npm run check:toolbar` | Emitted toolbar loader only for exact `VERCEL_ENV=preview`; unset/production/development/unknown excluded | Vercel's independent platform injection settings |
| `npm run check:toolbar -- --browser` | Chromium checks of built preview/production, real loader insertion, reuse and failed-network behavior; exact viewport screenshots | Authenticated hosted Comments, login/permissions and third-party overlay accessibility |
| `node scripts/audit-a11y.mjs` | 36 full axe scans, both lenses, all four views and baseline dialogs at exact required sizes; keyboard scroll/focus checks | Axe incomplete items, screen-reader review, other exports, every dialog tab |

Shu's2026-10-22 policy: automatic PR CI (and pushes to main) contains only build, lint/static colour/language/theme checks and fast unit tests. Viewer uses npx vitest run, bypassing npm test's retained multi-build toolbar gate. Python3.12/3.13 retain the fast unit baseline and include affected source/test regressions; the docs-existence check remains a fast lint check. The current workflow selects affected components conservatively and reports skipped jobs explicitly. Feature-branch pushes do not duplicate PR runs.

Run release-review.yml manually with workflow_dispatch for full Python suites (including separate UID user), offline demo, npm test's toolbar matrix, existing all-view Playwright review, unrestricted axe at1440×900/390×844, mode-colour/sticky-label review and toolbar browser gate. No test file or script removed. Partial screenshots/reports upload with always() for30days. Manual workflow execution is separate from merge readiness; do not dispatch long suites automatically or wait for them after PR CI is green. First workflow_dispatch availability requires the workflow to exist on the default branch; then select the intended ref in Actions. The later standing authorization in AGENTS.md permits a supervising agent to merge after the applicable checks; it does not dispatch release suites or authorize deployment.

Previous configuration (also documented in the PR): every push and pull_request ran npm test (toolbar build matrix plus all Vitest tests), lint/styles/language/build, Playwright screenshot review/upload, both full Python suites with UID setup, and demo/run-demo.sh --offline. Those full/review commands remain available in the manual workflow. Green fast CI does not imply release/browser/full axe passed. Keep actually performed targeted UI evidence and incomplete/manual limits separate.

## Legacy preview comments boundary (no new public delivery)

The local-first decision of 23 October supersedes preview delivery below. These notes document retained infrastructure only. Do not provision new public previews or change the existing Vercel project/settings in Phase A.

The viewer includes a lazy official Vercel injection-script loader only when the build environment is exactly `VERCEL_ENV=preview`; there is no `VITE_*` opt-in switch or hostname heuristic. It reuses an existing Vercel script/custom element, and an unavailable comments service leaves the viewer usable. The final dependency tree is unchanged.

Preview deployment provisioning is maintained separately in `p3/pr-previews`; this integration adds no project, deployment workflow or credentials. In that existing Vercel project's General → Vercel Toolbar settings, use **Preview: On**, **Production: Off**, and enable Comments for the intended reviewers. The application's build gate cannot prevent Vercel or a browser extension from independently injecting a toolbar into production. Keep the Vercel production setting off; do not enable production feedback via environment overrides.

Use a real authenticated preview to check Comments, keyboard focus, trust text, mobile bottom navigation and the third-party overlay. Read-only inspection of an existing thread can be evidence; posting a test comment requires explicit authorization to send it. Report project/auth access limitations honestly. Preview comments are product feedback, never ledger approval events.

References: [Vercel visibility and environment settings](https://vercel.com/docs/vercel-toolbar/managing-toolbar), [official injection script](https://vercel.com/docs/vercel-toolbar/in-production-and-localhost/add-to-localhost), [Comments](https://vercel.com/docs/comments).

## Approved workspace, Phase A (23 October 2026)

The binding viewer contract now uses Petrol & Porcelain plus Cool Graphite, replacing the Stitch palette/layout. Existing manual browser entrypoints dispatch to `viewer/scripts/review-workspace.mjs` for this shell; historical scripts/tests remain. `npm run review:screenshots` captures the real published demo path at 1440x900/390x844 in both themes/lenses, full unrestricted axe, original sandboxed preview, initial focus, criterion hit tests and responsive/reload/history checks. `WORKSPACE_OUTPUT` selects the evidence directory. `check:theme` retains its old command/filename but now measures both approved palettes, frame/content scopes, selected fills and nested status badges; byte-rounded pairs avoid marginal floating-point passes. PR events remain unchanged; component selection follows the current CI workflow.

Shu’s later decision supersedes public demo/preview delivery: one local production build, no bundled fixture or source request while disconnected. The recorded demo lives in viewer/fixtures and is served only by local Vite development for screenshots/tests. No public demo build is created. Existing Vercel project/deployment configuration remains untouched; toolbar/preview workflows can be removed later with separate approval. No reader, host setup, private import or live endpoint is added. Supplied Agent-Plane code is not copied because its complete source/licence mapping is absent. The inbox examples are design references, not executable instructions or trusted records. The committed plan preserves the original proposal and records the newer Phase A approval.

## Fast, truthful validation — owner update 23 October 2026

Test changed behavior and affected states once, then reuse that evidence while the code stays unchanged. Re-run only checks affected by a fix, a failure or a newly identified risk. Documentation-only changes do not need Viewer builds or browser matrices. Component-scoped CI may skip unrelated jobs, but its final check must distinguish those skips from executed passes and must fail if a required job did not succeed. Unknown change scope defaults to running checks.

Keep commands, source commit/tree, observed counts and limitations with the evidence. Mark not-run, skipped, expected-failure, blocked and mocked checks explicitly. Never turn a fixture into a claimed real run, infer a working live service from a mock, remove an assertion to obtain green CI, or fabricate screenshots/results. Targeted browser review still uses unrestricted axe and the required viewports; its limited state coverage must be reported. No repeat of every historical scan is required for an unrelated or small change.

## Overview visual parity (26 October 2026)

The owner-approved overview and run summary use the green-tinted dark theme,
with a local German/English table. The secondary technical workspace retains
its existing themes and explicit English language boundary. No upstream strings, fonts or code
are fetched. The language scanner permits German only in that fixed dictionary;
unit tests check matching translation keys and English copy. Existing recorded
content and English secondary tools are not translated.

For the focused local capture run
`cd viewer && npm run build && node scripts/review-overview.mjs`. It uses only the recorded development fixture and
local production build, captures 1440×900/390×844, runs unrestricted axe on the
overview and run detail (German/English, menu, Why and empty states), checks
keyboard chart/claim strips, menu, Details inspection and return navigation, and
blocks external requests. Evidence defaults to the gitignored
`viewer/.screenshots/run-detail-v3/`; `OVERVIEW_OUTPUT` selects another location.
A missing browser is reported as unavailable, never as a browser/axe pass.
Review the screenshot against the approved mockup, all axe `incomplete` items,
long labels, enlarged text and screen-reader behavior manually. This command is
manual review only, outside automatic PR CI; it does not qualify live services.

Run detail captures include viewport and full-page `run-detail-1440.png`,
`run-detail-full-1440.png`, `run-detail-390.png` and `run-detail-full-390.png`.
The summary identifies the tested commit, dirty-tree state, fixture boundary,
all unrestricted axe violations/incomplete items and unavailable browser errors.
`REVIEW_BROWSER_EXECUTABLE=/absolute/path/to/chrome` selects an already-installed
Chrome on the review machine; do not download a browser for this task.
Contexts use Europe/Berlin and reduced motion. The empty-detail screenshots
are explicitly labelled synthetic inputs, not recorded witnesses. Compare the
real fixture's layout with the approved lauf shots without expecting their
invented numbers, overall verdict, verification seal or generated diagnoses.
