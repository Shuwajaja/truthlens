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

## Hosted read-only validation and separate preview setup

VPSMan supplied a read-only check using his own Vercel access; **Shu does not need to authorize another Vercel connection for this review**. His report identifies head `f50485a02c1c3bb39b850ff672cffa61d3420e0b`, deployment `dpl_7br96g1iaNiWRbeLqpBnBzq8Wbv2`, status **READY**, and a build without errors. He reports viewer, docs, Python 3.12/3.13, Vercel and Vercel Preview Comments checks all successful, with a clean mergeable PR. These project/dashboard facts are attributed to VPSMan, not to this agent's restricted API connection.

Codex independently checked the public responses and Chromium behavior without signing in, posting comments or changing settings:

- [Preview deployment](https://truthlens-viewer-idz5uhkum-shuwas-projects-42265d9f.vercel.app) returns **HTTP 200 without login**. No Deployment Protection is enabled according to VPSMan; public reachability was independently observed. This is documented only; no protection or other Vercel setting was changed.
- With browser-style request headers (`Accept: text/html`, `User-Agent: Mozilla/5.0`), the raw Preview HTML contains Vercel's async `feedback.js` script **after `</html>`**, with `data-explicit-opt-in="true"` and the real deployment ID. This confirms platform preview injection is active. The entry bundle is `index-ByJRAUsC.js`, referencing `preview-toolbar--Y4RsgZ5.js`; the lazy chunk contains the hosted loader URL.
- Chromium at **1440×900** and **390×844**, using those headers, loads the real preview and its lazy chunk. After network idle there is **exactly one feedback script and one loader request**, with the original deployment ID, async and opt-in attributes retained. Chromium places the trailing script under **BODY**, where `document.querySelector` finds it. **No second script is inserted; no application-loader fix was needed.**
- A default headless request did not receive platform injection; the application fallback inserted exactly one script into HEAD. This response variation is why the request headers and original deployment attribute are recorded in the reuse check.
- [Production](https://truthlens-viewer.vercel.app), still the main build `index-4429mvGn.js`, returns HTTP 200 with **no feedback.js HTML injection and no preview loader reference in the bundle**. Together with VPSMan's project inspection this supports Preview On / Production Off for the checked deployments; no settings were changed.

A permanent Chromium regression case now appends the async opt-in script with a simulated deployment ID after the real built document's `</html>`, at both required viewports. It verifies one retained script, one request and the deployment/async/opt-in attributes. `npm run check:toolbar -- --browser`, `npm run lint`, and `npm test` (**217 passed**) were rerun for this follow-up. Only the regression script and published evidence changed; the application source and previous 36-state axe/screenshots remain unchanged.

No authenticated comment was created and third-party overlay accessibility was not audited. The prior API 403 was specific to Codex's connection, not a blocker for this review, and no new authorization is requested. Comments are feedback, not ledger approval. Preview provisioning remains separate in `p3/pr-previews`; no deployment workflows/projects/credentials, protection settings, frozen contracts, security code or run data change here. **No merge without Shu's explicit OK.**
