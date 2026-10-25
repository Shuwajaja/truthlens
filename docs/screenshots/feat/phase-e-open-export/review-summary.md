# Phase E browser evidence — local synthetic review

Application and manual browser test commit: `bbb9ef4ea26130553467b459d83335ca12f2fcdb`. Both final browser runs recorded no tracked dirty files. Later changes publish documentation/evidence only. Production Vite build; existing cached Chromium headless shell 156.0.8078.4; synthetic repo-local folders and deliberately unavailable read-service responses. No live private data, signature authentication, D34 admission or human approval is established.

Each timezone exercised **1440×900** and **390×844**, each in **Petrol & Porcelain** and **Cool Graphite**. Client and Developer lenses and the existing Inspector/mobile Sheet were exercised.

| Timezone | Playwright specs | Unrestricted axe scans | PNG screenshots | Axe violations / page errors | Completed original downloads |
| --- | --- | --- | --- | --- | --- |
| UTC | 4 passed; 0 failed/skipped | 28 | 8 | 0 / 0 | 12 byte-equal; sources unchanged |
| Europe/Berlin | 4 passed; 0 failed/skipped | 28 | 8 | 0 / 0 | 12 byte-equal; sources unchanged |

Four derived RunDoc downloads per timezone also passed filename, provenance and forced hash-only trust assertions. All screenshot/report files are individually below 1 MiB; each JSON report is about 70 KiB. Screenshots cover only rejected-folder and original/derived-download controls; other reviewed states are represented by axe/results rather than additional pictures.

Axe returned 14 incomplete rule groups per timezone. The existing repository DOM/CSS classifier recorded **66 CSS contrast passes and 6 inactive modal background nodes** in each run. These classifications are retained in the JSON reports, not silently converted into axe passes. No low-contrast finding remained. They are automated incomplete-node classifications, not human screenreader or blanket WCAG acceptance.

## Witnessed behavior

- Initial production Not connected makes no service request. An explicit Connect receiving 503 retains that fallback.
- Chromium omits a required synthetic symlink blob from directory file selection; opening fails closed with “Referenced blob is missing.” Damaged ledger input is rejected without download controls.
- The real browser directory file input loads original bytes, derives a local source/run tab, ignores authentication claims and displays not authenticated/hash-only. The native OS folder-picker dialog is not exercised by this test.
- Original ledger, pretty-printed manifest and CRLF evidence downloads compare byte-for-byte with their synthetic sources. Source bytes compare unchanged after each download.
- The derived RunDoc filename includes `derived`; its provenance is derived and its trust metadata stays `verified: false`, `integrity: hash-only`.
- Existing criterion evidence opens the original event Inspector/Sheet. Mobile Escape closes the Sheet and returns focus to Inspector. Developer lens, Changes and unchecked Chain reuse Phase C/D views.
- Two local folders with the same run ID but different source identities coexist in Runs and Compare. No API request follows local opening, navigation, comparison or downloads. Persisted navigation contains no evidence/body content. Reload clears local content and returns to Not connected.
- No page-width overflow in any scanned state; no browser page errors.

## Reproduce

From the repository root after `npm --prefix viewer run build`, using the already-existing repo-local cache:

```sh
TMPDIR="$PWD/.cache/tmp" \
LD_LIBRARY_PATH="$PWD/.cache/browser-libs/usr/lib/x86_64-linux-gnu" \
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" \
TZ=UTC npm --prefix viewer run test:local:browser

TMPDIR="$PWD/.cache/tmp" \
LD_LIBRARY_PATH="$PWD/.cache/browser-libs/usr/lib/x86_64-linux-gnu" \
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" \
EVIDENCE_OUTPUT=../docs/screenshots/feat/phase-e-open-export/berlin \
TZ=Europe/Berlin npm --prefix viewer run test:local:browser
```

Use canonical absolute TMPDIR: the earlier `$PWD/../.cache/tmp` from the Viewer directory caused generic and application Blob downloads to be cancelled in this Chromium environment. A standalone nine-byte Blob probe reproduced that failure; changing only TMPDIR to its canonical absolute repo-local path restored the probe and the unchanged application assertions. No browser or system packages were installed for this task. Full Chrome could not start with the existing cache because Pango was missing; the successful review uses headless shell.

[UTC report](utc/review.json) · [Berlin report](berlin/review.json).

Representative images: [desktop dark downloads](utc/1440-cool-graphite-downloads.png), [mobile light downloads](utc/390-petrol-porcelain-downloads.png), [mobile dark rejection](utc/390-cool-graphite-rejected.png).

## Limits

The tested symlink case is a required blob omitted by Chromium, followed by importer refusal. File/handle APIs expose no `lstat`; browsers may omit or dereference links before application code receives a selection. This does not prove rejection of every OS symlink or behavior in other browser engines. Explicit non-file/link descriptors, traversal, size/count limits, giant PNG headers, forged trust fields and manifest/ledger/blob corruption have separate unit/adapter tests.

No native OS directory-picker UI, throttled/very slow download, full release matrix, other-browser engine, screenreader, real read service/SSH, private run, independent signature verification or human approval was tested. Download object URLs expire after 30 seconds or component cleanup; byte equality is claimed for the observed completed downloads. No push, PR, merge, deployment or host setup occurred.
