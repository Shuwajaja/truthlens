# Full axe CI and accessibility review — issue146

Tested source `c71cd28743e514d1b2bdae23fdad5118965bfa39`, tree `73618565c78d09c0b04f9a2ba08f2c6014e9e94f`, based on main6c66473. Later publication changes only STATUS/evidence. JSON preserves its recorded HEAD and adds the exact tested source/tree. Original recorded run data, layout, colours, trust labels and frozen contracts are unchanged.

## Confirmed defect fixed

The Drawer trapped focus and hid background content, but omitted aria-modal. Chromium exposed it as modal:false. The new AX check failed on this actual DOM before the fix; adding aria-modal=true changes no visible layout and now yields modal:true in32 checked dialog/tab states. Only3 snapshot attributes changed. [Original AX node](before-modal-ax.json) · [Original partial failing audit](before-modal-failure.json). That failing report contains2 scans and is diagnostic evidence, not a passed full baseline. Axe alone did not identify this missing modal declaration.

Focus return after Escape is asynchronous: the audit now waits for the actual trigger to regain focus (maximum2s) instead of asserting during the intervening unmount frame. A small reproduction observed immediate:false followed by successful restoration; no product focus-timing workaround was added.

## Executed checks

- 268 tests/25 files, lint, hard-colour/language checks,116 existing text/control/focus contrast pairs and build pass.5 new policy tests cover complete48-state coverage, a duplicate/missing mobile state, even a minor violation, browser/keyboard failures, and retention of incomplete evidence.3 negative regression cases first failed before validator implementation. Workflow YAML parses; full audit and always-upload steps present.
- 48 unrestricted axe4.14.0 scans in Chromium156.0.8078.4:zero violations. Both lenses at1440×900/390×844, all4views, all existing baseline dialogs plus Tests/Files/Time on each criterion drawer/sheet. No withTags/withRules/exclude/disableRules filters. aria-prohibited-attr passes all48 scans.9 overflowing-record keyboard reachability/focus-visible/arrow-scroll checks pass.
- 32 modal states: dialog name/role/modal flag, selected tab and matching named panel, and exclusion of the background skip link are checked via actual Chromium AX nodes.530 Tab/Shift+Tab events stay in their dialogs;12 ArrowRight transitions select the intended tabs. Escape returns to the real opening trigger.32 selected screenshots below include every view and all criterion tabs at both sizes/lenses.
- Technical incomplete triage retains every original rule/node.205 active text-node occurrences pass composited CSS contrast (minimum6.9128:1 in this subset, not the whole app minimum).892 occurrences are inactive aria-hidden modal background:656 color-contrast and236 aria-hidden-focus. Each modal state separately verifies background AX exclusion and focus containment.16 clipped-text scroll samples become hit-test reachable and original scroll positions are restored. No unresolved/unsupported category occurred in this run; future ones remain explicit in JSON.
- Existing actual-export preview checks remain unchanged. Expected inert-artifact script denials are recorded separately; no unexpected browser errors. Independent code review found no open issue.

[Full axe + AX/focus/contrast/scroll evidence](axe-results.json) · [Compact review counts](review-summary.json)

## Review decisions and limits

| Item | Review / decision |
|---|---|
| aria-hidden-focus incomplete | Background and Radix focus sentinels belong to the inactive modal state. AX background exclusion, both keyboard directions and trigger restoration are verified. No suppression or removal of raw nodes. |
| aria-prohibited-attr | No incomplete/violation in this current export; passes48 full scans. Dialog/tab/panel names and modality additionally inspected through AX. |
| color-contrast incomplete | Browser geometry/occlusion and scrolling inspected separately from CSS compositing. Active text passes the required ratio; modal background is inactive and excluded from AX/focus.16 scroll samples are reachable. |
| Visual/keyboard inspection | Desktop Tests and mobile Files screenshots reviewed: selected tab has visible focus, panel matches its label, empty Files is honest, trust notices remain readable. All32 states have AX/focus evidence. |
| Actual spoken screen reader | **Not performed.** Chromium AX-tree evidence is not an NVDA/VoiceOver spoken-output or human usability test. This remaining AT step stays open in STATUS.md. |
| Overall accessibility | No blanket WCAG/other-export/hosted certification. Synthetic policy fixtures test the gate, not user-facing run evidence. |

CI now runs the same script as a required viewer step after build. Missing coverage, any axe violation, browser errors or failed keyboard/AX checks fail it. The JSON writer runs in finally, retaining partial failure state. Artifact upload uses always() and explicit review/a11y paths for30 days. The older screenshot review remains separate and runs after build even if the full audit fails. CI status for the final head is in the PR; no agent merge.

Commands: `cd viewer && npm test && npm run lint && npm run check:styles && npm run build`; `A11Y_OUTPUT=/tmp/truthlens-full-a11y node scripts/audit-a11y.mjs`. Use the usual local Playwright browser/library variables, or REVIEW_BROWSER_EXECUTABLE for system Chrome.50 diagnostic captures are generated (48 states +2 legacy Overview aliases);32 selected images are published below. The explicit failing-modal report demonstrates local failure evidence retention; it is not a fabricated CI-failure run.

## 1440×900

| View/state | Client | Developer |
|---|---|---|
| Overview | [Client](overview-1440-client.png) | [Developer](overview-1440-developer.png) |
| Claims | [Client](claims-1440-client.png) | [Developer](claims-1440-developer.png) |
| Timeline | [Client](timeline-1440-client.png) | [Developer](timeline-1440-developer.png) |
| Story | [Client](agent-story-1440-client.png) | [Developer](agent-story-1440-developer.png) |
| Criterion Overview | [Client](criterion-drawer-1440-client.png) | [Developer](criterion-drawer-1440-developer.png) |
| Criterion Tests | [Client](criterion-drawer-tab-tests-1440-client.png) | [Developer](criterion-drawer-tab-tests-1440-developer.png) |
| Criterion Files | [Client](criterion-drawer-tab-files-1440-client.png) | [Developer](criterion-drawer-tab-files-1440-developer.png) |
| Criterion Time | [Client](criterion-drawer-tab-time-1440-client.png) | [Developer](criterion-drawer-tab-time-1440-developer.png) |

## 390×844

| View/state | Client | Developer |
|---|---|---|
| Overview | [Client](overview-390-client.png) | [Developer](overview-390-developer.png) |
| Claims | [Client](claims-390-client.png) | [Developer](claims-390-developer.png) |
| Timeline | [Client](timeline-390-client.png) | [Developer](timeline-390-developer.png) |
| Story | [Client](agent-story-390-client.png) | [Developer](agent-story-390-developer.png) |
| Criterion Overview | [Client](criterion-sheet-390-client.png) | [Developer](criterion-sheet-390-developer.png) |
| Criterion Tests | [Client](criterion-sheet-tab-tests-390-client.png) | [Developer](criterion-sheet-tab-tests-390-developer.png) |
| Criterion Files | [Client](criterion-sheet-tab-files-390-client.png) | [Developer](criterion-sheet-tab-files-390-developer.png) |
| Criterion Time | [Client](criterion-sheet-tab-time-390-client.png) | [Developer](criterion-sheet-tab-time-390-developer.png) |

PR95 untouched. No merge without Shu’s explicit OK.
