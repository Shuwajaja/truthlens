# Phase F local qualification — 25 October 2026

Tested application and browser harness: `b7912564231c29e8f1c950396834878888a92ae2`.
Both browser reports recorded an empty tracked diff. Later commits publish
documentation/evidence only. Base: `9667c9d082ce9e1782b4e720aefc6420ae149d56`.
All inputs are synthetic; no live service, SSH session, agent broker or human
approval is established. No deployment or host configuration occurred.

| Check | Observed result |
| --- | --- |
| Python full suite, UTC | 493 passed, 2 skipped, 1 xfailed, 15 subtests passed |
| Python full suite, Europe/Berlin | 493 passed, 2 skipped, 1 xfailed, 15 subtests passed |
| Viewer full suite, UTC | 422 passed / 44 files; language, styles, theme and toolbar build matrix passed |
| Viewer full suite, Europe/Berlin | 422 passed / 44 files; same static/build gates passed |
| Ruff / Viewer lint / production build | Passed; build includes TypeScript |
| Targeted Chromium, each timezone | 6 specs passed; 102 unrestricted axe scans; zero violations and page errors |
| Incomplete axe review, each timezone | 10 incomplete rule results; 78 CSS contrast classifications, all passing; no unresolved classifications |

The two Python skips need dedicated host users/sudo. The expected failure
documents the accepted same-UID key-access risk. None proves OS isolation.
Viewer jsdom reports its existing unimplemented `scrollTo` diagnostic; tests
passed. Coverage percentage was not measured; no coverage tool is installed.

Commands, from the repository root (all caches and temporary files repo-local):

```sh
umask 022
PATH="$PWD/.venv/bin:$PATH" TMPDIR="$PWD/.cache/tmp" TZ=UTC .venv/bin/python -m pytest -q -rs --basetemp=.cache/fu3
PATH="$PWD/.venv/bin:$PATH" TMPDIR="$PWD/.cache/tmp" TZ=Europe/Berlin .venv/bin/python -m pytest -q -rs --basetemp=.cache/fb2
.venv/bin/ruff check src tests
.venv/bin/python -m compileall -q src
npm --prefix viewer run lint
npm --prefix viewer run build
cd viewer
TMPDIR="$PWD/../.cache/tmp" TZ=UTC npm test
TMPDIR="$PWD/../.cache/tmp" TZ=Europe/Berlin npm test
TMPDIR="$PWD/../.cache/tmp" PLAYWRIGHT_BROWSERS_PATH="$PWD/../.cache/ms-playwright" LD_LIBRARY_PATH="$PWD/../.cache/browser-libs/usr/lib/x86_64-linux-gnu" TZ=UTC node --test e2e/green-deck.pw.mjs
TMPDIR="$PWD/../.cache/tmp" PLAYWRIGHT_BROWSERS_PATH="$PWD/../.cache/ms-playwright" LD_LIBRARY_PATH="$PWD/../.cache/browser-libs/usr/lib/x86_64-linux-gnu" TZ=Europe/Berlin EVIDENCE_OUTPUT='../docs/screenshots/feat/phase-f-green-deck/berlin' node --test e2e/green-deck.pw.mjs
```

The harness generates synthetic signed audit bytes and projects every fixture
through the real Python status projection. Chromium routes simulate the human
GET service. Both widget and viewer show that same DTO; JavaScript has no audit
pass/fail reducer. The local CLI is separately tested against real synthetic
ledger/blob files with network/process calls forbidden and unchanged-input
digests checked. Browser fixtures alone do not prove a live read service.

Browser scope: 1440×900, 390×844 and 320×844; Petrol & Porcelain and Cool
Graphite; normal text and 200% text enlargement. The harness doubles computed
CSS font sizes, preserving viewport width; it does not exercise native browser
zoom. Each configuration checks disconnected/no automatic request, passed,
failed, not_checkable, running, error, interrupted, unavailable and loading
clearing a previous pass. The viewer Chain view shares the deck and retains
its neutral hash-only notice. All requests are GET, no event route is used,
and widget output excludes the run ID and evidence details. Basic focus is
checked; spoken screenreader behavior is not tested.

Real-browser RED: 320px/200% viewer controls overflowed to 368px. The mobile
header now wraps controls in flow. Both affected theme probes and final full
matrix passed without relaxing layout/axe assertions. Self-review visually
inspected the final narrow viewer and dark widget screenshots. The 320px viewer
screenshots are scrolled to the affected deck; widget screenshots crop the
compact main area. Eight PNGs per timezone; each report is below 150 KiB.

Published reports: [UTC](utc/review.json), [Berlin](berlin/review.json).
Example screenshots: [320px viewer, 200% text](utc/320-petrol-porcelain-viewer-passed-2x.png),
[dark widget, 200% text](utc/1440-cool-graphite-widget-passed-2x.png).

Self-review and independent Codex review resolved missing/unmet criterion
evidence, absent test-rule coverage, input-digest mismatch, embedded lifecycle
states and CLI usage-error reflection. Final independent review at `b791256`
found no blocker; it inspected diffs and reused witnessed tests, without
claiming another suite run. HMAC-adjacent CLI scope retains the
`needs-codex-review` classification in the untracked PR body. Existing auditor,
key reader, frozen contracts and legacy MCP remain unchanged.

Earlier failed attempts are not passes: the copied repo-local editable install
pointed at Phase E and caused two subprocess import failures; correcting its
local `.pth` path fixed them. A concurrent Python UTC/Berlin attempt caused
four fixed-port fixture errors; final suites ran sequentially. Initial browser
matrix: four passes and two 320px failures, followed by the fix above. Raw logs
remain in ignored `.cache/` under the user constraint forbidding writes outside
this repo. No screenshots or reports from failed probes are presented as final.

Not run: native zoom, other browser engines, spoken screenreader, live
SSH/private services, separate-UID isolation, human acceptance, Phase G agent
broker/tool qualification, remote CI or release/deployment. There is no claim
that these synthetic checks complete those operational acceptance steps.
