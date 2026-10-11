# DESIGN.md – visual direction (binding for viewer, mockups, application page)

Goal: calm, factual, trustworthy. Think GitHub / Linear. The UI shows evidence, it does not sell.

## Rules
- No glassmorphism, no decorative gradients, no hero section, no KPI tile grid, no glow, no transform hover effects.
- Layout: fixed left nav (240 px, 1 px border) + content column; tables and lists over cards.
- Type: system UI sans (`ui-sans-serif, system-ui`), 14 px body, monospace for hashes/ids/paths.
- Spacing scale 4/8/12/16/24/32. Radius 6 px (controls) / 8 px (panels). Shadow max `0 2px 8px rgba(0,0,0,.08)`.
- Neutral palette (GitHub-like): bg `#ffffff` / dark `#0d1117`, surface `#f6f8fa` / `#161b22`, border `#d0d7de` / `#30363d`, text `#1f2328` / `#e6edf3`.
- Numbers are counts ("3 of 5 criteria witnessed"), never percentages, scores or trust meters.
- UI labels in English; status values shown exactly as in the schema.

## Status colours (one list, = schema criterion `status` + human approval)
| Status | Token | Light | Dark | Meaning |
|---|---|---|---|---|
| `met` | `--st-met` | `#1a7f37` | `#3fb950` | witnessed evidence passes |
| `unmet` | `--st-unmet` | `#cf222e` | `#f85149` | witnessed evidence fails |
| `unverified` | `--st-unverified` | `#6e7781` | `#8b949e` | no witnessed evidence |
| `proposed` | `--st-proposed` | `#9a6700` | `#d29922` | derived, awaiting human confirmation |
| `claimed` | `--st-claimed` | `#0969da` | `#58a6ff` | agent claim only, no witness |
| `human-approved` | `--st-human` | `#8250df` | `#a371f7` | confirmed by `actor.kind = human` |

Badges always show text + colour (never colour alone). Trust badges (`integrity_verified`, `review_required`, …) are neutral outline badges next to the status, never a replacement.

## Review
Before a UI PR: check against `.agents/skills/no-slop-ui/` and `.agents/skills/web-interface-review.md`; `DESIGN.md` wins on conflict.
