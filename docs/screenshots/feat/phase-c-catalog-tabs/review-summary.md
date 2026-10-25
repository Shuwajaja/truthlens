# Phase C catalog and tab review — 25 October 2026

Tested application/test tree: `734a5a496fb46df2d1306f1a52fb3308c714b3bf`.
Only `docs/STATUS.md` and `viewer/DESIGN.md` had pending documentation edits
when the browser runs began; the application and test code matched this commit.
These screenshots use a production build with **synthetic same-origin API responses**.
They demonstrate the browser/adapter boundary, not a live registered run, server
activation, SSH tunnel, separate-UID isolation, signature check or human approval.

The existing pinned Playwright is exercised through Node's test runner:
`cd viewer && npm run build && npm run test:catalog:browser`.
`TZ=UTC` and `TZ=Europe/Berlin` each completed **6 passed, 0 failed, 0 skipped**.
The host needed repo-local Chromium/shared libraries; no system packages were
installed. On this host the browser command also used:

```sh
TMPDIR="$PWD/../.cache/tmp" \
LD_LIBRARY_PATH="$PWD/../.cache/browser-libs/usr/lib/x86_64-linux-gnu" \
PLAYWRIGHT_BROWSERS_PATH="$PWD/../.cache/ms-playwright" \
CATALOG_OUTPUT=../docs/screenshots/feat/phase-c-catalog-tabs/utc \
TZ=UTC npm run test:catalog:browser
```

The Berlin run used the same command with `TZ=Europe/Berlin` and
`CATALOG_OUTPUT=../docs/screenshots/feat/phase-c-catalog-tabs/berlin`.

Witnessed flows: no fetch before explicit Connect; workspace/snapshot identities;
one document read per opened run; renderer dedupe including Claimed vs proven;
actual browser Back/Forward from a legacy renderer-only URL preserving unrelated query/hash; pin/close/restore
and restore focus; metadata-only persistence/reload; storage write failure;
delayed first document after another run is selected; 40-tab open/restore limit
without eviction. At **390×844**, both themes exercised navigation, the final
criterion's center hit test, keyboard activation, inspector sheet and Escape
focus return. Desktop evidence uses **1440×900**.

Each timezone produced seven screenshots and seven **unrestricted axe** scans:
**zero violations and zero page errors**. Each retained seven incomplete rule
results covering 16 nodes: ten clipped-strip text nodes measured at 10.99:1
(Petrol & Porcelain) or 15.20:1 (Cool Graphite), and six inactive modal-background
nodes. These classifications are retained, not counted as automated axe passes.
The source screenshots were visually inspected for wrapping IDs, narrow layout
and the final criterion sheet. This is targeted Chromium review, not a complete
browser/lens/view or assistive-technology certification.

Exact axe results, incomplete-node classifications and screenshots:

- [UTC results](utc/review.json), [desktop catalog](utc/1440-catalog.png),
  [desktop Claims](utc/1440-claims.png),
  [storage failure / late response](utc/1440-unsaved-late-response.png).
- [Mobile light catalog](utc/390-petrol-porcelain-catalog.png),
  [mobile light final criterion](utc/390-petrol-porcelain-last-criterion.png),
  [mobile dark catalog](utc/390-cool-graphite-catalog.png),
  [mobile dark final criterion](utc/390-cool-graphite-last-criterion.png).
- [Berlin results](berlin/review.json), with the same screenshot names.

Earlier attempts are not passes: Chromium initially could not launch because
shared libraries were missing. After repo-local extraction, four specs failed
because the test's init script accessed localStorage in the deliberately opaque
preview iframe; two passed. The harness now initializes only the top-level app
window. All page-error assertions remain in place; the corrected runs above
passed. No production security setting or assertion was weakened.
