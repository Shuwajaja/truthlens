# Frontend review loop

Project workflow requested by the owner on 2026-10-16. Read DESIGN.md first.
This is persistent project guidance, not a claim that a model has been retrained.

## One outcome per iteration

Name the user task, the actual data it uses, and an observable completion condition.
Inspect the current rendered screen and existing components before editing.
Reuse working renderers and contracts. A build passing is not visual acceptance.

Use separate roles when delegation is available and authorized:
- Implementer: changes the selected flow and preserves data semantics.
- Visual reviewer: inspects actual desktop/mobile captures; checks hierarchy,
  readable typography, spacing, empty/error states and the chosen design direction.
- User-task simulator: attempts the tasks below in the browser without relying
  on source-code knowledge to explain the interface. Records actual actions,
  confusion and outcomes. Clearly labels observations as agent simulation.

A reviewer must not mark their own implementation as independently reviewed.
Human testing means a real person performed the tasks. Never rename an agent
"human tester", fabricate user quotes, or record agent review as human approval.

## Five tasks

| Task | Observable completion condition |
|---|---|
| Find what was created | Open an actual result in at most two deliberate actions from Home, or see why no preview exists. |
| Decide what still needs checking | Distinguish passed, failed and unchecked without opening technical details; never infer human acceptance. |
| Find an open issue | See the expected requirement separately from the observed check outcome; missing observations remain explicit. |
| Understand the reason | Follow the issue to its recorded source and return without losing the selected work. |
| Bring in my own work | Find an available import path; distinguish developer setup and unavailable hosted connections. |

Action counts are targets until measured. Do not invent completion times or
infer comprehension from a successful selector-based browser script.

## Repeatable sequence

1. Capture the current flow at 390 and 1280 pixels using actual local data.
2. Implement the highest-impact structural change. Prefer useful content above
   navigation chrome and technical vocabulary. Keep the original logo unchanged.
3. Run the relevant build and existing focused smoke once. Example:
   `python viewer/scripts/visual_review.py --url http://127.0.0.1:4188 --output /tmp/truthlens-review`
   Playwright and Chromium are prerequisites; optional `--axe /path/axe.min.js`.
4. Inspect new screenshots directly. Exercise the changed flow with keyboard,
   mobile viewport and reduced motion. Check relevant empty/error data states.
5. Independently review the five tasks. Store observations with screenshot paths,
   actual click paths, severity and evidence outside the repo under
   `/workspace/projects/truthlens-runs/`. Mark untested tasks as untested.
6. Fix the three most important remaining obstacles, then recapture only affected
   screens and rerun only relevant checks. Repeat if a concrete blocker remains.
7. Persist accepted/rejected design rules with reasons in DESIGN.md. Update
   docs/STATUS.md honestly. A reviewer recommendation is not owner acceptance.

## Release gates

No misleading verification/acceptance claim; failed-integrity content stays
isolated. No page overflow at 360px. Core actions reachable with keyboard;
modal focus returns; reduced motion respected. No new critical/serious automated
accessibility findings in checked states. Result and primary action visible
without a screenful of setup/navigation. A pleasing screenshot cannot excuse a
broken task; successful automation cannot certify visual quality or usability.

Real-person feedback can use the same five tasks without coaching. Record only
observed difficulties and explicitly supplied preferences, then fix the highest
impact issue. Do not add analytics or upload private screenshots implicitly.
