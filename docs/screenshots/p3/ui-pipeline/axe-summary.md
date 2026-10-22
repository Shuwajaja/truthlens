# Main baseline: UI pipeline trial

Static review evidence captured on 2026-10-22. This is a baseline audit, not an accessibility approval.

- Tested main commit: `25e6201d66ce54c170eda92babc5c9796f1a16d9`.
- Fresh production build: `cd viewer && npm run build` — passed.
- Headless Playwright 1.64.1, Chromium 156.0.8078.4, axe-core 4.14.0 (`@axe-core/playwright` 4.14.0).
- Desktop **1440×900**, mobile **390×844** CSS pixels; device scale factor 1; local `en-GB`, `Europe/Berlin`; reduced motion enabled.
- Existing `viewer/public/run.json`; no substitute data or document changes.
- Both **Client** and **Developer** lenses, all four views; desktop claim/criterion/evidence/file drawers; mobile run/criterion sheets and each view's trust sheet. Drawers/sheets opened with keyboard Enter and closed with Escape.
- **36 completed full axe scans**, using `new AxeBuilder({page}).analyze()` with no rule or tag restriction. **0 browser errors**.
- Screenshots show the Client Overview at the two exact viewport sizes, captured before the audit; both images were visually inspected. They are viewport screenshots, not full-page captures.

## Confirmed axe findings

**Baseline fails: 2 serious rule IDs, 0 critical findings.** 32 of 36 scanned states have confirmed violations. This documentation-only PR leaves the tested viewer unchanged. Serious findings need correction in subsequent UI work under the new pipeline.

| Rule | Impact | States affected | Element occurrences across scans |
| --- | --- | ---: | ---: |
| `label-content-name-mismatch` | serious | 26 | 200 |
| `scrollable-region-focusable` | serious | 6 | 7 |

Element occurrences include the same elements encountered again in another lens or state; these are **not unique defect counts**.

- `label-content-name-mismatch`: visible button text is not included in the accessible name. Examples: graph result buttons (`.graph-result-fail`, `button[title="Mobile layout works"]`), event buttons, the mobile "Claims" tab (`aria-label="Claimed vs proven"`), and an evidence button inside the mobile run/trust sheet (`aria-label="Evidence #7: evidence.attached"`).
- `scrollable-region-focusable`: scrollable code/text regions in drawers and the Developer criterion sheet lack keyboard focusability. Example selector: `.mb-3 > pre` in the evidence drawer.

### Confirmed element occurrences by state

Each cell counts serious element occurrences, including both rule IDs. A dash means that viewport does not have that state in this trial.

| State | Desktop Client | Desktop Developer | Mobile Client | Mobile Developer |
| --- | ---: | ---: | ---: | ---: |
| overview | 28 | 28 | 20 | 20 |
| claims | 6 | 6 | 1 | 1 |
| timeline | 19 | 19 | 14 | 14 |
| agent-story | 6 | 6 | 1 | 1 |
| claim-drawer | 0 | 1 | — | — |
| criterion-drawer | 0 | 1 | — | — |
| evidence-drawer | 1 | 2 | — | — |
| file-drawer | 0 | 1 | — | — |
| overview-trust-sheet | — | — | 1 | 1 |
| run-sheet | — | — | 1 | 1 |
| criterion-sheet | — | — | 0 | 1 |
| claims-trust-sheet | — | — | 1 | 1 |
| timeline-trust-sheet | — | — | 1 | 1 |
| agent-story-trust-sheet | — | — | 1 | 1 |

## Manual review still required

Axe returned `incomplete` results for the following rules. These are neither confirmed violations nor passes:

| Rule | States requiring review |
| --- | ---: |
| `aria-hidden-focus` | 20 |
| `aria-prohibited-attr` | 4 |
| `color-contrast` | 28 |

An automated axe scan and two screenshots do not establish full accessibility compliance. This trial did not exercise every drawer tab, alternate run data, loading/error states, or assistive technologies.

## Screenshots

[Desktop, 1440×900](desktop-1440x900.png) · [Mobile, 390×844](mobile-390x844.png)
