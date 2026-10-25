# Phase D browser evidence — local synthetic review

Application and test commit: `f6f057b` (tree `8c387cd76598ea41f121e74cafb28db45cbad8e7`). Both browser runs started with no tracked dirty files. The later commit changes only documentation and published evidence, including removal of the obsolete compare-deferred sentence in `viewer/DESIGN.md`. No source behavior changed after these checks.

Chromium, production Vite build, synthetic same-origin read-API responses only. Each timezone ran **1440×900** and **390×844**, each in **Petrol & Porcelain** and **Cool Graphite**. These are UI acceptance fixtures, not cryptographic, live private service, SSH, separate-UID or real human approval evidence.

| Timezone | Node/Playwright specs | Unrestricted axe scans | Screenshots | Axe violations / page errors | Review of axe incomplete nodes |
| --- | --- | --- | --- | --- | --- |
| UTC | 4 passed; 0 failed/skipped | 44 | 44 | 0 / 0 | 876 CSS contrast passes; 12 inactive modal background nodes |
| Europe/Berlin | 4 passed; 0 failed/skipped | 44 | 44 | 0 / 0 | 876 CSS contrast passes; 12 inactive modal background nodes |

The violation count is zero across all impacts, including serious and critical. Axe still returned `color-contrast` and `aria-hidden-focus` incomplete results. The repository's existing DOM/CSS review classified those nodes as contrast passes or inactive modal backgrounds; full details remain in each JSON report. This is automated incomplete-node classification, not a human screenreader or blanket WCAG acceptance claim.

## Witnessed flows

- No request before explicit Connect; GET-only synthetic responses from the existing read routes.
- Intact (checked within scope), contradictory (check failed), and mixed supported/unchecked (partially checked) stored chain reports. No invented link-level diagnosis. Neutral unchecked vs red failed labels/surfaces.
- Coverage with unchecked stored results and a referenced event. Gated actions with a recorded not-applicable result and an honest no-gate-events state.
- Original event Inspector on desktop and Sheet on mobile, Escape and focus return to its event button.
- Missing diff blobs remain empty. A loaded captured unified diff renders in Changes; its event record opens through the Inspector/Sheet. Mobile Escape restores the diff trigger.
- Existing Claimed vs proven renderer through Phase C navigation.
- Comparison of loaded snapshots: independent source/run/head and distinctly named trust notices on both sides, with independently captured diff/empty states.
- No document-width overflow at every captured state; no browser page errors.

Unit/integration regressions additionally cover audit source/run/head rejection, malformed and oversized reports, outcome coercion, all chain summary outcomes, absent report/references, literal gate actor and simulation fields, renderer failure with safe raw fallback, comparison identity for equal run IDs, eviction, late audit response, retry, deduplicated source/run/view tabs and metadata-only persistence. The mocked renderer-error test proves that failure boundary only.

## Reproduce

From `viewer/`, after `npm run build`, with this host's already-existing repo-local cache:

```sh
TMPDIR="$PWD/../.cache/tmp" \
LD_LIBRARY_PATH="$PWD/../.cache/browser-libs/usr/lib/x86_64-linux-gnu" \
PLAYWRIGHT_BROWSERS_PATH="$PWD/../.cache/ms-playwright" \
EVIDENCE_OUTPUT=../docs/screenshots/feat/phase-d-evidence-compare/utc \
TZ=UTC npm run test:evidence:browser
```

Repeat with `TZ=Europe/Berlin` and output ending `/berlin`. No browser or OS packages were installed for this task. The browser cache and extracted shared libraries already existed from Phase C.

[UTC report](utc/review.json) · [Berlin report](berlin/review.json).

Representative images: [mobile chain](utc/390-petrol-porcelain-intact-chain.png), [mobile partial chain](utc/390-petrol-porcelain-partial-chain.png), [mobile failed chain](utc/390-petrol-porcelain-broken-chain.png), [desktop Compare](utc/1440-cool-graphite-compare.png), [mobile stored diff](utc/390-cool-graphite-stored-diff.png), [mobile diff Inspector](utc/390-cool-graphite-diff-inspector.png).

## Remaining limits

No real stored private audit, other browser engine, screenreader, live connection or host isolation acceptance was performed. No assertion that every incomplete axe result has human confirmation. A malformed or wrong-run/head audit is unavailable/unchecked, not a tampering diagnosis. A document failing the existing fail-closed validator remains unavailable rather than becoming a synthetic chain display. Broken/unbound audits without a matching registered run/head cannot be presented as bound reports. Comparison reads only already loaded snapshots and reconstructs no before-file. No arbitrary imports/downloads or new write APIs. Agent Zero remains status-only. No push, PR, merge, deployment or host setup.
