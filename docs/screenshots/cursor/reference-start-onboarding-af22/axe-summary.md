# Mockup match axe, 26 October 2026

Chrome `/opt/google/chrome/chrome` against `vite preview` of the production
build of the working tree on top of `9a76d3e`. The review script was excluded
from the dirty list. Viewports 1440×900 and 390×844. Unrestricted axe.
`prefers-reduced-motion: reduce`.

Six scans, zero violations:

- empty `/runs` start
- `/runs?demo=1`
- `/runs/run_8f3a21?demo=1`

Each state was scanned at both viewports. No page errors. No horizontal
overflow (`scrollWidth` equals the viewport).

The script checked the captured text. The demo sidebar reads Läufe 128,
Prüfberichte 96, Agenten 3, Quellen. The tiles read 128, 1.204, Ø 9,4,
81 %, and 9 % widerlegt · 10 % unklar. The first row is `run_8f3a21` and
its pill is `widerlegt` because that labelled run is `integrity: hmac` and
its stored summary is refuted. The detail breadcrumb is TruthLens / Läufe /
run_8f3a21, the meta line is Agent Zero · Projekt MCPDeck · heute 16:41 ·
Dauer 6 Min 29 s · run_8f3a21, the four tiles are 7 / 5 / 1 / 1, Zeitablauf
is open, and the developer disclosure is closed. The empty start has no
Beispieldaten badge and no `.tl-pill.confirmed`. The demo page does show
one green `bestätigt` pill, on a signed run whose stored summary is
confirmed.

Incomplete `color-contrast` remains on `.tl-mark` in the three 1440 scans
(one node each). The 390 scans did not report it. That incomplete result is
not a recorded violation.

The labelled demo catalog is `integrity: hmac` so the mockup colors can be
reproduced. Its source label stays “Beispieldaten (Demo)”. The browser did
not check a signature and did not run an audit. Hash-only files stay
`unklar`. `run_8f3a21` is widerlegt, not the mockup’s unklar title, because
one refuted claim on an HMAC run stays widerlegt. Agent Zero’s refuted
count is 45, not the mockup’s 14: 9 % of 1.204 claims cannot leave a
three-agent unique leader at 14. The week-over-week line is +18,5 %.
