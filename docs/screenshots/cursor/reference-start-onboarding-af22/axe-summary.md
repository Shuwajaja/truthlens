# Guided start axe, 26 October 2026

Chrome `/opt/google/chrome/chrome` against `vite preview` of the production
build. Code under test was `e7f7b90`. `git status` was clean when the
script started. Viewports 1440×900 and 390×844. Unrestricted axe.
`prefers-reduced-motion: reduce`.

Ten scans, zero violations:

- empty `/runs` start
- demo Übersicht after clicking “Beispiel ansehen”
- empty Prüfdetails
- a hash-only run-view file whose stored summary is confirmed
- the evidence workspace with no loaded runs

Each state was scanned at both viewports. No page errors. No horizontal
overflow (`scrollWidth` equals the viewport).

The script checked the behaviour it captured. The start shows the three
steps, no Beispieldaten badge, and no `.tl-pill.confirmed`. The demo click
removes the welcome heading, shows the runs table and the Beispieldaten
badge, and still has no confirmed pill. The loaded hash-only file shows
UNKNOWN, “Geladene Datei · kein Live-Audit”, and no demo badge. The
workspace empty state has no `figure` and no element whose text is only
TRUE. The HMAC words on the start are the explanation, not a result.

Incomplete `color-contrast` remains on `.tl-mark` in the four 1440
reference scans (one node each). The 390 scans and both workspace scans
did not report it. That incomplete result is not a recorded violation.

The demo catalog in `viewer/public/reference-demo.json` is labelled
Beispieldaten. The file screenshot is a review JSON file with
`integrity: hash-only`. The browser did not check a signature and did not
run an audit.
