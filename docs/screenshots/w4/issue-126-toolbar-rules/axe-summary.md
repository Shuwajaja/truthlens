# Issue 126: preview Toolbar and local UI checks

Evidence captured 2026-10-22 from source commit `3cdd4af13417d8d7d311eed0ef44017a77175371` (Git tree `ff10ac52ff81a4026cb052eb525604880cf6b2a4`). Evidence is published separately without application changes.

## Verified locally

- `npm test`: **217 tests passed**. This includes the toolbar build matrix and 3 loader/reuse tests, alongside existing Viewer acceptance tests.
- `npm run lint`, `npm run check:styles`, `npm run build` and `git diff --check`: passed. The test command also checks English UI.
- `npm run check:toolbar -- --browser`: actual app builds for unset, production, development, staging and preview. Only exact preview contains the loader; no toolbar chunk remains in the other builds. Chromium verified production has **0** loader requests and preview **1** at both exact viewports. Simulated pre-existing platform loader/custom element is reused. An explicitly simulated **HTTP 503** produces a warning while Viewer navigation still works; no uncaught page errors. This validates failure handling, not the hosted comments UI.
- Final `package-lock.json` and dependency versions are unchanged. `npm audit --package-lock-only`: **0 vulnerabilities**. The Apache-2.0 toolbar package was evaluated but not adopted; the small local integration uses Vercel's documented injection-script endpoint without copying package source.
- Manual review of the changed source using the local React/interface checklists: no important findings. No extra React state/effect, no new rendering work, and optional code is a lazy chunk. A separate code review found no important issues.

## Full axe audit

- Playwright 1.64.1 / Chromium 156.0.8078.4 / axe-core 4.14.0.
- Actual `viewer/public/run.json`, no substitute run data. Viewports **1440×900** and **390×844**, scale 1, `en-GB`, `Europe/Berlin`, reduced motion.
- **36 unrestricted axe scans**, `new AxeBuilder({page}).analyze()` without tags/rule filters, against the local production-mode Viewer. Client and Developer lenses; all four views; desktop claim/criterion/evidence/file drawers; mobile run/criterion sheets and trust sheet in each view.
- **0 confirmed violations of any severity**, **0 browser errors**, **7 successful keyboard scroll/focus checks**. Drawers/sheets opened with Enter, closed with Escape, and returned focus to their triggers.
- This does **not** include the third-party authenticated Vercel overlay. The Preview screenshots capture the deliberately unavailable-service case and are not evidence of a working hosted comment flow.

Axe incomplete items remain for manual review (not passes, not confirmed violations):

| Rule | States |
| --- | ---: |
| `aria-hidden-focus` | 20 |
| `aria-prohibited-attr` | 4 |
| `color-contrast` | 28 |

[Per-state axe summary and keyboard evidence](axe-summary.json) · [Toolbar build/browser evidence](toolbar-checks.json)

## Screenshots

Four exact viewport screenshots were visually inspected. Trust boundary wording, neutral integrity notice, layout and mobile navigation remain unchanged. Preview failure screenshots contain no fabricated comments UI.

| Variant | Desktop | Mobile |
| --- | --- | --- |
| Production Viewer; no toolbar loader | [1440×900](production-1440x900.png) | [390×844](production-390x844.png) |
| Preview build; simulated HTTP 503 | [1440×900](preview-1440x900.png) | [390×844](preview-390x844.png) |

## Source and license review

[Full vetting record](../../../../.agents/skills/README.md), [local React rules](../../../../.agents/skills/react-best-practices.md), [local UI review](../../../../.agents/skills/web-interface-review.md), [portable binding pipeline](../../../UI-PIPELINE.md).

`vercel-labs/agent-skills` pinned at `063bee94c3f4df8453406c830b0a7df0f2860278`: React skill header declares MIT; UI-review skill has no declaration; repository metadata/tree has no license file. No skill implementation/rule files or installer is vendored. The local checklists are written for TruthLens. `web-interface-guidelines` pinned at `434b7f91364665f2f733b310ec54809bf8f37937`: explicit MIT license, Copyright (c) 2025 Vercel Labs; notice retained locally. The upstream UI skill's mutable runtime fetch is not adopted.

## Hosted validation limitation and separate preview setup

Read-only Vercel inspection of `truthlens-viewer` returned **403: team scope not authorized**. No project settings or production settings were changed. Authenticated Comments, actual project Preview On/Production Off settings and toolbar overlay accessibility remain unverified. These require access to the existing project; follow the separate `p3/pr-previews` work rather than provisioning again. Comments are feedback, not ledger approval.

The app's production bundle excludes its loader. Vercel's independent toolbar injection and browser extensions are governed by project settings, so the separate project setup must keep **Preview On, Production Off**. No deployment workflows/projects/credentials, frozen contracts, security code or run data change here. No merge without Shu's explicit OK.
