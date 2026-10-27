# Reference mockup gap axe, 26 October 2026

Chrome `/opt/google/chrome/chrome` against `vite preview` of the production
build of `12218b17a0f56a3debf58fa8252943a2f8368071` (`main-CVHqS4Hn.js`,
260.60 kB). The review script was not committed. Viewports 1440×900 and
390×844. Unrestricted axe. `prefers-reduced-motion: reduce`. Time zone
Europe/Berlin.

Six scans, zero violations:

- empty `/runs` start
- `/runs?demo=1`
- `/runs/run_8f3a21?demo=1`

Each state was scanned at both viewports. No page errors. No horizontal
overflow (`scrollWidth` equals the viewport).

Checked on that build: the runs subtitle is the mono source label
“Beispieldaten (Demo)”; the dashed Beispieldaten badge stays; the text does
not contain `/srv/`. The sidebar footer reads Einstellungen and Doctor, and
Doctor has a green dot whose accessible name says isolation is not checked.
Suchen shows a ⌘K chip. The open run quotes „Alle 42 Tests laufen grün durch“
and shows Alle 42 Tests from the recorded `42 passed` line. The pytest
sentence is not shown. Zeitablauf measures 480px at 1440 and stacks at 390
(358px). The HMAC line is inside `details.tl-dev`, which is closed, and it
is not in the title row. The logo square measures 32px at 1440. The first
run pill is `widerlegt`. The logo is hidden at 390 until Menü opens the
sidebar; that open menu is `mockup-menu-390.png`.

Incomplete `color-contrast` remains on `.tl-mark` in the three 1440 scans
(one node each). The 390 scans did not report it because the sidebar is
closed. That incomplete result is not a recorded violation. The logo
gradient is the one gradient the design contract allows.

`terminal-compare-1440.png` is a rendering of real stdout from
`truthlens doctor --root /tmp/tl-doc-root --key-env TRUTHLENS_HMAC_KEY`
(exit 1, `entries=0`) and
`truthlens setup --agent cursor --root /tmp/tl-doc-root --key-env TRUTHLENS_HMAC_KEY --print`
(exit 0). The key value is not in the output. `/workspace/review-tl/vorlage/`
was not on this machine, so these shots are the app and the terminal, not a
mockup overlay.

The labelled demo catalog is `integrity: hmac`. The browser did not check a
signature and did not run an audit. `run_8f3a21` stays widerlegt.
