# DESIGN.md – product design contract

## Brand palette update — 2026-10-16

Owner requested that the result studio match the original logo: neutral black,
white and vivid green. This supersedes the warm-paper/blue/apricot recommendation.
Default is dark logo-green; light Paper uses a darker accessible green. Saved
personal appearance choices remain respected. Widget light/dark surfaces use the
same brand direction; semantic failed/unchecked statuses remain distinct.

## Current owner direction — 2026-10-16

This section supersedes conflicting historical style rules below, including the
fixed dark palette, two-column navigation, system-font-only and card prescriptions.
The owner rejected the existing workbench and granted freedom over layout, color,
typography and animation. The original logo assets remain unchanged.

TruthLens is for people who want to understand their AI-created work, not only
engineers. Lead with the result, then explain what needs attention. Technical
records, IDs, hashes, transport names and raw data belong in contextual details.
Keep original source values available there; never rewrite recorded facts.

Selected implementation direction: **Result studio** (agent recommendation, not
a claim of owner visual approval). Give the actual result the largest useful
area, with an adjacent readable check summary on desktop and a stacked flow on
mobile. Use real exported content or an explicit unavailable-preview state.
A failed requirement describes what was expected, not what actually happened;
label expectation and observed outcome separately.

Dynamic flows follow recorded state: work with failed checks leads to open
points; unchecked work explains the missing checks; empty work offers a real
import path; damaged records stay isolated with an understandable explanation.
No animation, generated view or model inference creates evidence or approval.
Short spatial transitions may explain selection and navigation; reduced motion
disables them. No framework is required solely for decoration.

### Persistent feedback

- Rejected: recoloring the same dashboard and calling it a redesign. Structure
  and user tasks must improve, not only tokens.
- Rejected: duplicate navigation/logos and a screenful of metadata before work.
- Rejected: developer terminology and terminal setup as the everyday entry flow.
- Retained: the original logo, truthful source distinctions, accessible controls,
  existing working renderers, and technical depth on request.
- Review method: `.agents/skills/frontend-review-loop.md`. Independent agent
  review is a simulation; only real people provide human usability evidence.

## GitHub reference package — 2026-10-16

These are inspected design references, not newly installed dependencies or a
claim that the upstream applications passed our browser review. Repository
metadata, READMEs and license files were checked; ShadcnStore and Shadcn Admin
screenshots were visually reviewed. The MagicPath project
`TruthLens · GitHub references & design system` holds the reference board and
the proposed user journey. It is a planning canvas, not the deployed app.

| Reference | Pattern to reuse | Boundary |
|---|---|---|
| [ShadcnStore](https://github.com/shadcnstore/shadcn-dashboard-landing-template) | Result list/detail layout, task filtering, responsive settings | MIT template; linked premium blocks separate. Adapt mechanics to our existing React app. |
| [Shadcn Admin](https://github.com/satnaing/shadcn-admin) | Compact navigation, search and settings | MIT; upstream explicitly does not describe it as a starter template. |
| [Langfuse](https://github.com/langfuse/langfuse) | Work selection, readable observation, optional source/JSON detail | MIT core; exclude commercially licensed enterprise source. |
| [LibreChat](https://github.com/LibreChat-AI/LibreChat) | Familiar question, answer and artifact interaction | MIT; optional navigator, not a mandatory chat-only workspace. |
| [Novu](https://github.com/novuhq/novu) | Workflow steps and event inbox | MIT and enterprise-specific licensing; not an MCP renderer. |
| [React Flow](https://github.com/xyflow/xyflow) | Optional map of recorded relationships | MIT core, separate Pro examples; retain current graph unless replacement improves an actual task. |
| [json-render](https://github.com/vercel-labs/json-render) | Composition of approved app/widget views | Apache-2.0; strict TruthLens validation remains necessary. Not a data-verification system. |

Selected combination: ShadcnStore list/detail mechanics, Langfuse progressive
explanation, and LibreChat's approachable question/result interaction. Proposed
primary destinations are Results, History and Connections; this is the next
layout direction. The implemented shell keeps Home and Checks as direct actions
alongside Results and Connections; History is direct on desktop and under More
on mobile to preserve the compact five-target navigation.

The shared journey is **view result → notice open points → read explanation →
inspect original source if needed**. Desktop keeps result and explanation beside
each other. Mobile uses a focused detail view with a reliable back action. Chat
widgets present one useful result with expandable details and no duplicated app
navigation. Original logo and black/white/green tokens remain authoritative.
Animation should explain selection, opening details and workflow progress;
recorded events must never look like newly executing work.

The implemented desktop home now uses a visible work library beside the result;
mobile uses a compact native selector. Dates distinguish repeated task titles.
Checks stack below the result at medium widths and sit beside it when space
allows. The failed-check action remains above the preview in both cases.

Apply through the existing frontend review loop: reuse working renderers, review
the actual desktop/mobile/widget screenshots, exercise the main user tasks, then
fix concrete findings. Do not import a whole template or add multiple UI runtimes
merely to imitate its screenshots. Keep upstream attribution when copying code.

## Historical directions (context, not current style constraints)

Direction approved by the owner on 2026-10-11 (concept mockups `v2-01-truth-overview`, `v2-02-claimed-vs-proven`, `v2-03-timeline`, kept by CodexChat, Drive `Projekte/truthlens`): **dark mission-control**. The first screen answers one question in plain language: *what did the agent say, and what is actually proven?*

## Main view (Truth Overview)
- Large plain-language headline: **"Your agent said: Done. Here's what's actually proven."** – only when the run contains an `agent.claim`. Without a recorded claim the headline is neutral ("Here's what this run actually proves."); the UI never invents a statement.
- A neutral **"Review required"** badge is visible in the main view by default (D7, TRUST-LEVELS): integrity is verified, human acceptance is still open.
- One sentence of counts below it: "2 of 3 things are proven. 1 is only claimed." Counts, never percentages, scores or trust meters.
- One colour card per criterion: icon + short plain title + one plain sentence ("Proven – the test passed.") + the schema status as a small label.
- One callout for the biggest gap ("Your agent said 'All tests passed'. Mobile was never tested.").
- **No hashes, IDs, seq numbers or paths in the main view.** They live in the detail drawer and the audit/timeline view (Developer Lens).

## Card colours (dark first)
| Card | When | Colour (dark) | Schema label shown |
|---|---|---|---|
| green – proven | `met` (witnessed evidence passes) | `#3fb950` | `met` |
| yellow – claimed only | criterion `unverified` **and** an agent claim covers it | `#d29922` | `unverified` + "claimed" |
| red – failed | `unmet` (witnessed evidence fails) | `#f85149` | `unmet` |
| gray – not checked | `unverified` and not claimed | `#8b949e` | `unverified` |
| outline only | `proposed` (awaiting human confirmation) | border `#8b949e`, dashed | `proposed` |

Card colour = the **criterion status** only. The claim finding (`supported` / `claim_unwitnessed`) is a separate label in "Claimed vs Proven": a claim on an `unmet` criterion stays a red card and its claim is shown as `claim_unwitnessed` next to it – the two are never merged.

Colour is never the only signal: every card has an icon and text. Human approval / confirmation is shown as a neutral "confirmed by you" line, not a separate colour. Trust badges (`integrity_verified`, `review_required`, …) stay neutral outline badges in the detail view.

## Rules (kept from v1)
- No glassmorphism, no decorative gradients, no glow, no transform hover effects, no marketing hero.
- Dark surfaces: bg `#0d1117`, surface `#161b22`, border `#30363d`, text `#e6edf3`, muted `#8b949e`. Light theme optional later, same tokens.
- Layout: left nav (Overview · Claimed vs Proven · Timeline) + content column. Cards only for criteria; lists/tables elsewhere.
- Type: system UI sans; headline 36–40 px bold (it states the run's result, it is not a marketing hero), body 15–16 px; monospace only in detail/audit for hashes, ids, paths.
- Spacing 4/8/12/16/24/32; radius 8 px; at most a 1 px border, no heavy shadows.
- UI labels English; schema values shown exactly as in the schema next to the plain-language words.
- Mockups carry a visible "Concept" badge until they show a real recorded run.

## Review
Before a UI PR: check against `.agents/skills/no-slop-ui/` and `.agents/skills/web-interface-review.md`; `DESIGN.md` wins on conflict.

## Workspace v6 direction (owner assets, 2026-10-16)

The supplied v6 concept and the owner's two original JPEGs extend the older
single-run layout to a workspace: compact icon rail, project/workspace navigator,
scoped work tabs and an optional evidence inspector. Results and recorded sources
remain primary; graphs and timelines display only recorded relationships/events.
The original single-run viewer retains its existing layout.

`viewer/src/assets/truthlens-mark.jpg` and `truthlens-wordmark.jpg` are the
owner-supplied brand originals, used unchanged. Their black canvas is cropped
only in the display box. Green/white branding identifies TruthLens; it does not
mark a run verified. Semantic criterion colors and textual trust axes remain
independent of theme/accent. The concept's synthetic counts are not app data.
The newly supplied assets supersede the package's missing-logo prerequisite;
additional unseen reference images are not claimed as reviewed.

## Review-led workbench (owner direction, 2026-10-16)

The owner requested a complete visual rethink and explicitly rejected generic
AI-dashboard styling. The workspace entry now begins with recorded work that
needs inspection, a single review action and a compact work register. Code
previews belong in the result view; raw provenance and event detail are progressive
disclosures. Failed checks appear first in evidence presentation without changing
recorded event order or source data. Mobile uses five persistent navigation targets
and a full-width source inspector. Connections provides separate guided paths for
local preview, Codex and ChatGPT without claiming a connection is installed.

Obsidian, Midnight and Paper are complete surface/text/accent palettes. Presets
reuse the versioned local appearance profile; semantic colors remain separate.
Lucide supplies consistent outline icons. Recorded JSON uses a bounded interactive
tree with plain/raw fallback. Both are presentation dependencies, not evidence or
agent execution frameworks. Review claims and sources remain the product focus.

The owner's subsequent motion request permits short spatial transitions: 180 ms
content reveals, a 240 ms modal entrance, and a one-shot trace of selected recorded
graph edges. They explain navigation/selection, never imply active verification.
No repeating particles or animated trust values. All spatial effects stop under
`prefers-reduced-motion`; keyboard selection and modal focus return remain intact.
