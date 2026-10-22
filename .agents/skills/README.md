# Agent skills (vetted)

Skill files are instructions to coding agents, so every file here was read in full before adoption
(2026-10-11, supervisor agent – not a human approval). Rejected: anything that fetches instructions at
runtime, installs hooks/shims, needs network or write permissions beyond the issue's `Allowed paths:`.

| Skill | Source | License | Decision |
|---|---|---|---|
| `no-slop-ui/` | [LeoStehlik/no-slop-ui](https://github.com/LeoStehlik/no-slop-ui) @ `3c8f9e5` | MIT (copy in folder) | Vendored verbatim: `SKILL.md`, `references/`. Scripts, examples, CI not vendored. |
| `python-conventions.md` | Inspired by [trailofbits/skills](https://github.com/trailofbits/skills) `modern-python` | CC BY-SA 4.0 upstream | **Not vendored** (ShareAlike + SessionStart hook installs PATH shims for `pip`/`python` → rejected). Rules written in our own words, adapted to this repo. |
| `react-best-practices.md` | [React skill](https://github.com/vercel-labs/agent-skills/blob/063bee94c3f4df8453406c830b0a7df0f2860278/skills/react-best-practices/SKILL.md) | Skill header declares MIT; repository has no LICENSE/NOTICE | Not vendored. Project-specific checklist in our own words; no copied rule files, examples, installer or scripts. |
| `web-interface-review.md` | [UI review skill](https://github.com/vercel-labs/agent-skills/blob/063bee94c3f4df8453406c830b0a7df0f2860278/skills/web-design-guidelines/SKILL.md) | No license declaration in this skill; no repository license file | Skill not vendored or installed. Its runtime fetch of mutable instructions is rejected. This corrects the older blanket MIT attribution. |
| `web-interface-review.md` | [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/434b7f91364665f2f733b310ec54809bf8f37937/command.md) | MIT, Copyright (c) 2025 Vercel Labs; [upstream LICENSE](https://github.com/vercel-labs/web-interface-guidelines/blob/434b7f91364665f2f733b310ec54809bf8f37937/LICENSE), [notice retained locally](licenses/vercel-web-interface-guidelines-LICENSE) | Local own-words checklist; guideline source and license read in full. No runtime instructions fetched. |

Rechecked 2026-10-22 by Codex (agent review, not human approval). GitHub's repository metadata returned no license for `agent-skills`; its recursive pinned tree contains no LICENSE/NOTICE/COPYING. The React skill's `license: MIT` header does not establish a blanket license for all other skills. The table records observed declarations, not a legal opinion. Recheck source and license explicitly before any future vendoring.

Toolbar: npm metadata for `@vercel/toolbar@0.2.7` declares Apache-2.0. The package was evaluated but is **not a project dependency**: its transitive tree introduced high-severity npm audit findings. The viewer instead uses Vercel's documented injection-script URL with a small local preview-only loader; no upstream package source is copied. Vercel's hosted service and authentication remain external dependencies.

Use order for UI work: `DESIGN.md` (project decisions, wins on conflict) → `no-slop-ui` (style) → `react-best-practices.md` (changed React code) → `web-interface-review.md` (final check).
