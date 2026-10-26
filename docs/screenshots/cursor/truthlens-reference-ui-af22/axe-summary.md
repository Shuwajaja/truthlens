# Reference surface axe, 26 October 2026

Chrome `/opt/google/chrome/chrome` against the Vite dev server. Code under
test was `e1d42a8`. The working tree was dirty only because these screenshot
files were not committed yet. Viewports 1440×900 and 390×844. Unrestricted
axe on the application pages.

Fourteen scans, zero violations: empty `/runs`, demo Übersicht, hash-only
run detail (`run_8e40fa`, stored confirmed), the recheck dialog, Prüfdetails,
Nachweise, and an HMAC file loaded in the browser. Mobile scans of those
states are included. The HMAC page is a review file whose `integrity` field
is `hmac`. The browser did not check a signature.

The script checked the behaviour it captured: the empty page has no
Beispieldaten badge; the demo catalog has no `.tl-pill.confirmed`; the
hash-only detail pill reads UNKNOWN; the recheck dialog names
`truthlens runs recheck run_8e40fa` and does not offer to create a revision;
the loaded HMAC file shows a confirmed TRUE pill and “Geladene Datei”.

Incomplete `color-contrast` remains on the logo letter `.tl-mark` at 1440,
because axe says the text is too short to judge. Mobile scans did not report
it. That is not a measured contrast failure.

`cli-1440.png` is the captured stdout of the banner, `workspace doctor` and
`runs list` with `TRUTHLENS_REFERENCE` unset, rendered in a page for the
picture. It is not an application axe scan. `runs show` and `workspace init`
in that transcript exit 2. The raw text is `cli-transcript.txt`.

Older pictures of search, the check dialog, the status filter and the framed
doctor were removed from this folder so they are not read as the current
surface.
