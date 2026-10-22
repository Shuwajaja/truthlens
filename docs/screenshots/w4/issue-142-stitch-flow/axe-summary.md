Latest owner follow-up: [Anti-AI-slop evidence](anti-slop/axe-summary.md), source2becee2,262 tests and36 full axe scans without violations. Earlier report below is historical.

# Unified Stitch components and review flow — issue142 / PR143

Source `740d3af2f79ecb45471e7bbc83dd0824bba7343f`, tree `d50de87e71712947f77db3e458c7958ff25d85f7`. Before: local integration commit `edb3d07d0f914d99dd8568a729300e77697ba239`, tree `27d46e0071cf1fd1725fa38f08be1c1fdf99afa1`, combining exact PR141 head ced8516 and PR139 head3cb51cc. This before commit was local, not a main or hosted deployment; parents are published. Their snapshot overlap retained Client-results markup with the opaque Stitch focus-ring classes. Final source has those dependency heads as parents.

Raw after axe preserves local scan-start integration HEAD, then attributes the exact staged UI tree to the published source commit. Later publication changes only evidence/STATUS. PR139 and PR141 remain separate/open, unchanged by this task. Main29e930b and PR95 untouched.

## Scope

DESIGN.md lists actions/cards/badges/tabs/properties/empty/loading/error/heading/drawer implementations and explains UX3–8 individually. Shared PageHeading, shadcn Card (including semantic article/list variants), Button and Empty/ViewState; Plus Jakarta Sans/JetBrains Mono and central Stitch spacing/type/palette tokens. Shared Header/navigation, one main content column, one existing Drawer. Permanent duplicate EvidenceRail/Navigator removed from shell; shared EvidenceTabs, real event/file access and run-wide details retained. Overview keeps its approved three-column workspace.

Main path: real-data outcome sentence and three outcome-card actions -> first actual matching criterion -> selected detail focus/scroll -> exact referenced event drawer. Empty categories disabled. Selected criterion-list buttons use the same path. Other views offer Review criteria, with heading focus restored; global Run details makes original evidence available everywhere. Drawer title identifies selected criterion/event/claim/file/run while retaining stable dialog kind names and trust notices.

No event schema, raw export, approval/signature/integrity changes. No fabricated graph, timing, story or evidence. Client/Developer retain original event identity and chronology. Point7 narrative rewriting and point9 URL persistence remain separate work; no user-study or speed claim.

## Executed validation

- 258 tests/24 files passed. Nine new flow cases: all three real result categories, empty-category disabled actions, common shell/return path, loading/invalid/error states, immediate drawer-close->review focus regression. Existing Client-data, drawer/tab and Story tests retained; snapshots updated for intentional shared components/retired duplicate rail/context title/focus.
- Lint, styles, language,72 token contrast pairs and build passed. No new libraries or non-token colours.
- Chromium156.0.8078.4:28 baseline screenshots before and28 after including sheets, intermediate responsive widths and exact1440×900/390×844. Published32 comparisons cover all four views and both lenses. Existing real-preview/selection/sandbox checks passed.
- **36 unrestricted axe-core4.14.0 scans before and36 after, zero violations in either**. Both lenses/all4views and affected drawers/sheets; seven keyboard scroll checks per phase. No unexpected browser errors; exact expected artifact sandbox script denials retained separately.
- Focused real-data browser run:12 keyboard result->criterion->evidence paths (3categories×2sizes×2lenses),12 return actions with shared run-drawer access, real reference checks, selected-object drawer title, Escape focus return and no overflow. Synthetic empty/invalid/malformed-JSON fixtures are explicitly labelled in JSON; they are testing only, not published as demo data/screenshots. They verify state handling and overflow, not an additional full axe certification of every loading/error state.
- Independent review found a desktop return-action focus gap, fixed and tested. Real browser then witnessed delayed drawer close stealing the newer view focus; corrected so trigger restoration does not override deliberate external focus. Regression unit and12 browser return sequences passed afterward. Reviewer rechecked with no new blockers.
- Manual samples visually inspected: mobile Story and failed-criterion focus, desktop Timeline. Automated focus, overflow, colour/type and contrast checks cover all required viewports. No blanket WCAG or hosted-validation claim.

Incomplete follow-up: before color-contrast24 scans/546 node occurrences, after24/574; aria-hidden-focus20/140 in each phase. These are manual-review items, not confirmed violations.

[Before full axe](before/axe-results.json) · [After full axe](after/axe-results.json) · [Focused real paths + labelled fixtures](flow-checks.json) · [Stitch checks](stitch-check.json)

| View / viewport | Before | After |
|---|---|---|
| overview 1440 client | [Before](before/overview-1440-client.png) | [After](after/overview-1440-client.png) |
| overview 390 client | [Before](before/overview-390-client.png) | [After](after/overview-390-client.png) |
| claimed 1440 client | [Before](before/claimed-1440-client.png) | [After](after/claimed-1440-client.png) |
| claimed 390 client | [Before](before/claimed-390-client.png) | [After](after/claimed-390-client.png) |
| timeline 1440 client | [Before](before/timeline-1440-client.png) | [After](after/timeline-1440-client.png) |
| timeline 390 client | [Before](before/timeline-390-client.png) | [After](after/timeline-390-client.png) |
| story 1440 client | [Before](before/story-1440-client.png) | [After](after/story-1440-client.png) |
| story 390 client | [Before](before/story-390-client.png) | [After](after/story-390-client.png) |

Developer images use the same filename with -developer suffix. [Focused desktop criterion](failed-criterion-1440.png) · [Focused mobile criterion](failed-criterion-390.png). No merge without Shu’s explicit OK.
