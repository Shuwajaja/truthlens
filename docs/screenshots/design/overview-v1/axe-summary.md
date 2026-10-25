# Overview v1 browser evidence

Tested commit: `45d61a3cee33b28f69e704bed1e60c19c6c40428`, clean application/test tree.
Application and unit-test content: `e25d92070e0db01b6cc03d4e92f6506d7d71b5e6`.
Timezone: Europe/Berlin. Chromium, reduced motion enabled.

Command from `viewer/`, selecting repo-local browser tooling, libraries and
temporary profiles for this qualification:

```sh
TMPDIR="$PWD/../.cache/t" \
LD_LIBRARY_PATH="$PWD/.browsers/libs/root/usr/lib/x86_64-linux-gnu" \
PLAYWRIGHT_BROWSERS_PATH="$PWD/.browsers" TZ=Europe/Berlin \
node --test e2e/overview.pw.mjs
```

8 scenarios passed: 1440×900 and 390×844, Petrol & Porcelain and Cool Graphite
shells, Client and Developer lenses. 32 unrestricted axe scans cover the
disconnected empty state, catalog with no loaded documents, four loaded synthetic
documents, and the existing run review after keyboard opening. There were zero
axe violations, browser errors, external page requests or horizontal page overflow.
Reopening a run used its existing cached document; Back restored the run review.

Axe marked 20 rule occurrences incomplete. The existing `reviewIncomplete`
helper checked their computed foreground/background contrast; all returned
`css-contrast-pass`, with no unresolved outcome. This is a CSS/geometry check,
not a screen-reader test or blanket accessibility certification.

The 40 PNGs include exact viewport captures and a separate full-page capture of
each loaded overview. Selected views:

- [Desktop overview](1440-cool-graphite-loaded.png)
- [Full desktop overview](1440-cool-graphite-loaded-full.png)
- [Mobile overview](390-cool-graphite-loaded.png)
- [Full mobile overview](390-cool-graphite-loaded-full.png)
- [Empty state](390-cool-graphite-empty.png)
- [Developer overview](1440-cool-graphite-developer-loaded.png)
- [Scan findings and measured contrast](axe-summary.json)

Manual inspection of desktop/mobile captures checked readable labels and wrapped
IDs, scoped green/grey semantics, visible trust limits and access to the latest
runs below the charts. Product data came only from synthetic reader-response
fixtures in the manual script. These screenshots establish rendered UI behavior;
they do not establish real run verdicts, signature validation, D34 admission,
SSH/reader isolation, live service behavior or human approval. Other browsers,
spoken screen readers and the historical full release matrix were not run.
