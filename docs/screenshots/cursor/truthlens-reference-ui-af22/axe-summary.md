# Reference surface axe, 26 October 2026

Chrome `/opt/google/chrome/chrome` against Vite at `http://127.0.0.1:4179`.
Viewports 1440×900 and 390×844. Unrestricted axe. Demo catalog `?demo=1`.

Fifteen scans, zero violations: Übersicht, run detail, Prüfdetails,
Nachweise, Doctor, settings, the empty runs page, search, the check dialog
and the recheck dialog. Mobile scans of the four main states are included.

Incomplete `color-contrast` remains on the logo letter where the desktop
sidebar is visible, because axe says the text is too short to judge. Search
and dialog scans also leave links behind the overlay incomplete because
their background is covered. Those items are not confirmed failures.

Browser exercise on the same origin: Control+K opened search and landed on
`/runs/run_8f3a21?demo=1`; JSON export downloaded `run_8f3a21.json` with
`demo: true`; Erneut prüfen stayed fail-closed and named
`truthlens runs recheck`; the status filter `refuted` showed only FALSE
pills (25 rows); the MCPDeck chip left 6 rows; the mobile menu opened
Prüfdetails. The CLI screenshot is a PTY transcript of the banner, init,
workspace doctor and runs list. The list result is UNKNOWN. JSON output was
checked in pytest and still stores `unclear`.
