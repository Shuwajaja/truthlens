# DESIGN.md – visual direction v2 (binding for viewer, mockups, application page)

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
