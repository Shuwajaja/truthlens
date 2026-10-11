# Web interface review checklist (TruthLens viewer)

Own-words checklist; idea credit: Vercel Web Interface Guidelines (MIT). Report findings as `file:line – rule`.

Accessibility
- Every interactive element is a real `<button>`/`<a>`/`<input>`; icon-only buttons have `aria-label`.
- Visible focus ring (`:focus-visible`), never `outline: none` without replacement.
- Status is never colour-only: each status badge also shows its text (`met`, `unmet`, …).
- Text contrast ≥ 4.5:1; headings in order; one `h1` per page.
- Drawer/dialog: focus moves in, `Esc` closes, focus returns to the trigger.

Forms
- Label above every field, `type`/`autocomplete` set, errors shown next to the field in text.

Content & data
- Counts, not percentages ("3 of 5 criteria"). Timestamps absolute with zone, relative only as extra.
- Long hashes/ids: monospace, truncated with full value on copy/title.
- Empty, loading and error states exist for every list.

Layout & motion
- Works at 360 px width; no horizontal page scroll; tables scroll inside their container.
- Respect `prefers-reduced-motion`; transitions 100–200 ms opacity/colour only.
- Dark mode via `prefers-color-scheme` uses the same status colours (tokens, not literals).
