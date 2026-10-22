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

Additional local checks from the pinned Web Interface Guidelines review (2026-10-22)
- Accessible button names include the visible label, statuses and metadata. Overflowing text/code must be reachable with Tab and scroll with native keys.
- Check focus stays visible above sticky navigation and third-party overlays; dialogs restore it after Escape. Use native button/link keyboard behavior before adding custom handlers.
- Preserve paste, browser zoom and normal touch gestures. Provide keyboard and tap alternatives to drag-only actions. Use appropriate autocomplete/inputmode and announce asynchronous form errors/status changes when those features exist.
- Images declare intrinsic dimensions; long IDs/text fit narrow containers. Check safe areas, mobile navigation and both empty and error states for changed flows.
- Defer optional scripts; avoid repeated layout reads/writes during rendering. Investigate costly lists using measurements, without hiding evidence from keyboard or assistive-technology users.
- Apply `viewer/DESIGN.md` first: English UI, exact tokens, recorded content unchanged, existing motion limits and truth boundaries. Upstream advice to change casing/locales, animate transforms, or synchronize every tab to the URL is not a mandate to redesign this viewer.

Verification: run `npm test`, `npm run lint`, `npm run check:styles`, `npm run check:language`, `npm run build`, and `node scripts/audit-a11y.mjs` at 1440×900 and 390×844. The axe script is unrestricted, unlike CI's older contrast-only screenshot check. Review `incomplete` results manually; keep unresolved items visible in the PR. Manual layout, focus, copy and performance checks remain required for the changed flow. Screenshots and automated passes are not a blanket accessibility claim.

Sources and licensing are recorded in [README.md](README.md). No upstream skill, runtime fetch instructions or executable installer is adopted.
