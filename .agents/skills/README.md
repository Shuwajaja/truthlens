# Agent skills (vetted)

Skill files are instructions to coding agents, so every file here was read in full before adoption
(2026-10-11, supervisor agent – not a human approval). Rejected: anything that fetches instructions at
runtime, installs hooks/shims, needs network or write permissions beyond the issue's `Allowed paths:`.

| Skill | Source | License | Decision |
|---|---|---|---|
| `no-slop-ui/` | [LeoStehlik/no-slop-ui](https://github.com/LeoStehlik/no-slop-ui) @ `3c8f9e5` | MIT (copy in folder) | Vendored verbatim: `SKILL.md`, `references/`. Scripts, examples, CI not vendored. |
| `python-conventions.md` | Inspired by [trailofbits/skills](https://github.com/trailofbits/skills) `modern-python` | CC BY-SA 4.0 upstream | **Not vendored** (ShareAlike + SessionStart hook installs PATH shims for `pip`/`python` → rejected). Rules written in our own words, adapted to this repo. |
| `web-interface-review.md` | Inspired by [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `web-design-guidelines` | MIT | **Not vendored**: upstream skill fetches its rules from a URL at every run (remote, changeable instructions → rejected). Checklist written in our own words. |

Use order for UI work: `DESIGN.md` (project decisions, wins on conflict) → `no-slop-ui` (style) → `web-interface-review.md` (final check).
