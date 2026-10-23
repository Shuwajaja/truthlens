# Phase A — local workspace review, 23 October 2026

Tested UI/source commit: `f55dc987ac44d53ef716d70175758ec2096686e2`. Browser Chromium 156.0.8078.4, axe 4.14.0. Final evidence commit adds documentation/screenshots and the adapted legacy toolbar test only; React/CSS/fixture bytes match this tested source.

## Result

- 294 local Vitest tests passed. Final modal-attribute regression: failed first, then 8 affected units passed. Fast CI on tested source: [all four jobs successful](https://github.com/Shuwajaja/truthlens/actions/runs/39945857915).
- Build, lint, English-language and hard-colour guards passed. 210 byte-rounded contrast pairs: minimum text **4.57:1**, minimum functional control/focus **3.35:1**. [Exact pairs](contrast.json).
- **100 unrestricted axe scans: zero violations**, plus four local production/offline scans: zero violations. 1440x900 and 390x844; both approved themes and both lenses. No browser page errors.
- Four main views, unchecked criterion, exact failed-test event, every evidence tab (Overview/Tests/Files/Time), original HTML preview/file and mobile navigation. 32 CDP modal/AX/focus-trap checks; 12 keyboard reachability/visible-focus/native-scroll checks for overflowing recorded content. Reload, Back, cross-breakpoint focus and 320px/720px reflow checks passed.
- 8 viewport/theme/lens regression groups cover initial/loading focus, visible keyboard focus, last-criterion hit testing, original preview bytes and unscaled frame/canvas bounds. 40 selected screenshots are committed; both lenses were tested even where screenshots show Client only.
- Hostile HTML test fixture: scripts, form submission and external image/network denied; opaque/inert iframe; missing blob shows an honest empty state. This synthetic fixture is not recorded evidence.
- Single local production build: **no run fixture, no source fetch/XHR, Not connected**, both themes/sizes. No reader, private source, server or Vercel platform change.

[Machine-readable axe/AX/keyboard/isolation/offline results](axe-results.json). Existing legacy toolbar matrix/reuse/failure tests also passed locally with fixture-free production output ([report](toolbar-checks.json)); no deployment or authenticated comment flow was tested.

## Four UI regressions

| Regression | Witness |
|---|---|
| Mobile preview white/blank | Actual stored HTML body renders; unchanged source bytes, opaque sandbox, no legacy transform, frame fills canvas; preview screenshots below. Original artifact colours stay unchanged. |
| Tabs cover criteria | No fixed bottom bar. Last criterion is scrollable, hit-testable and opens its real detail; mobile sheets restore focus. |
| Small grey text below AA | Both themes, frame/content/selected/nested fills: static pairs plus full axe and composited incomplete review. A reproduced 4.49:1 nested error badge was fixed with a darker light-theme error token. |
| White heading border on load | Loading gate, initial render and breakpoint changes do not focus the heading; keyboard skip-link/focus remains visible. User navigation and record transitions deliberately focus the new content. |

Fresh independent review found desktop focus loss and acceptance checks bypassed by old-shell dispatch. Both were addressed: focus regression tests failed then passed; hostile/AX/tab/overflow checks are executed by the new reviewer. The restored AX check reproduced a missing aria-modal declaration on the new sheet; it is fixed and covered by a failed-then-passed unit assertion.

## Incomplete results and limits

Axe incomplete nodes were reviewed using the retained helpers: 96 inactive modal-background/focus-guard cases (background excluded from AX tree; bidirectional modal Tab trapping checked) and 16 composited CSS-contrast passes, including scroll/occlusion samples. No unresolved or low-contrast helper outcomes. This is browser/AX evidence, **not spoken NVDA/VoiceOver testing** or a claim of WCAG certification.

These screens use the historical development fixture, not a live server run. Fixture SHA-256 `49a4972b98a77f8040f7c245d6f83eb7cca48f1e3441ac8ba0e7279853cad9ff`; bytes identical to the previous committed run.json. D34 and local reader remain deferred. Existing Vercel project/deployment/settings are untouched; screenshots replace preview-link delivery. Independent security check and Shu's explicit merge approval remain outstanding.

## Screenshots

| Theme | Desktop overview | Mobile overview | Mobile evidence | Mobile original preview | Local build |
|---|---|---|---|---|---|
| Petrol & Porcelain | [1440x900](petrol-porcelain-client-1440-overview.png) | [390x844](petrol-porcelain-client-390-overview.png) | [Event](petrol-porcelain-client-390-event.png) | [Preview](petrol-porcelain-client-390-preview.png) | [Not connected](petrol-porcelain-local-build-1440.png) |
| Cool Graphite | [1440x900](cool-graphite-client-1440-overview.png) | [390x844](cool-graphite-client-390-overview.png) | [Event](cool-graphite-client-390-event.png) | [Preview](cool-graphite-client-390-preview.png) | [Not connected](cool-graphite-local-build-1440.png) |

Other committed images cover Claims, Timeline, Story, unchecked criteria and loading at both sizes/themes.

## Reproduction

From viewer/: `npm run build`, the fast checks and `npx vitest run`; manual `npm run review:screenshots` with WORKSPACE_OUTPUT and REVIEW_BROWSER_EXECUTABLE as needed. This reviewer starts only ephemeral 127.0.0.1 development/preview servers and stops them. Local runtime libraries were extracted inside ignored node_modules; no host packages/services changed. PR CI remains build/lint/fast unit; no release workflow dispatched.
