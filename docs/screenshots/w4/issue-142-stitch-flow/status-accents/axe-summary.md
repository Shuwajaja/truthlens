# Semantic status accents — PR143

Before source `c433125707c83b23ef0901dfbe1a180b2075b357`; after source `52ed0975cc12e09e4760d22ac02cb97c17673794`, tree `b2d1af6b60b696d68a3fa0e8f888b5f509daf8e6`. Reports preserve their recorded HEAD and add exact testedSource attribution where source was staged during capture. Publication changes only evidence/STATUS. Main31dbf35 and PR141ec1079a remain the branch bases; no force-push or merge.

KPI cards now have4px semantic left rails, status-coloured numerals and10% opaque tints. Criteria use matching status rails, with no fabricated percentage/progress. Shared recorded-result blocks bring the same treatment to Overview and Claims. Approval OPEN uses the centralized amber tint; unverified/unknown/hash-only/claim finding stay neutral. Emerald active navigation/tabs means selected, explicitly documented as distinct from proof. No gradients, glow, decorative icons, data, schema, approval or trust-text changes. Raw artifact HTML/CSS stays historical. Layout/shell and8px scale retained; optical4px rails are border details.

## Executed verification

- 263 tests/24 files passed, lint/language/hard-colour guard/build passed. New unit acceptance case first failed before implementation, then confirms exported-status mapping. Snapshot changes are only intended status attributes/shared result class.
- 116 contrast pairs:64 AA text pairs, minimum4.7622:1 (>=4.5);52 meaningful UI/focus pairs, minimum3.0819:1 (>=3). New checks cover all status fills, both sides of rails, status dots, neutral control boundaries, nested badges, focus and emerald navigation text/indicators. [Exact ratios](contrast-pairs.json). Rose400 AA text retained. Tints derive solely from central Stitch tokens.
- Actual Chromium156.0.8078.4 checks at1440×900/390×844, both lenses:KPI/criterion rail colours and4px widths, painted tint pixels within1 channel unit of90%surface+10%status, actual selected navigation and all4 evidence tabs.12 real criterion selections verify matching result rails. Existing static-preview safety checks pass. [Computed controls/tint proof](browser-controls.json).
- 28 captures per phase cover all4views/both lenses at both required sizes, mobile sheets and responsive probes;32 core before/after images published below. No horizontal overflow or unexpected browser errors.12 actual keyboard result→criterion→referenced-event paths and12 returns pass;3 additional invalid/error/empty fixtures are explicitly synthetic. [Flow checks](flow-checks.json).
- 36 unrestricted axe4.14.0 scans before and36 after:zero violations,7 keyboard scroll checks each. Exact expected inert-artifact script denials are recorded separately. Incomplete manual follow-up remains:color-contrast24 scans/582 nodes before,24/580 after;aria-hidden-focus20 scans/140 nodes both. No blanket WCAG, hosted or user-study certification. [Before full axe](before/axe-results.json) · [After full axe](after/axe-results.json).

Commands: `npm test`, `npm run lint`, `npm run check:styles`, `npm run build`; `THEME_REPORT=/tmp/accent-contrast.json npm run check:theme`; `P3_LENSES=client,developer P3_SHOTS=/tmp/... STITCH_OUTPUT=/tmp/... npm run review:screenshots`; `A11Y_OUTPUT=/tmp/... node scripts/audit-a11y.mjs`. Existing browser runtime variables apply. The expanded controls checker was rerun after adding its pixel/nav/tab assertions; unchanged UI screenshots/full axe were not repeated unnecessarily. Local React/interface and independent code review found no open issue; no new dependencies.

## 1440×900

| View | Before Client / Developer | After Client / Developer |
|---|---|---|
| Overview | [Client](before/overview-1440-client.png) / [Developer](before/overview-1440-developer.png) | [Client](after/overview-1440-client.png) / [Developer](after/overview-1440-developer.png) |
| Claims | [Client](before/claimed-1440-client.png) / [Developer](before/claimed-1440-developer.png) | [Client](after/claimed-1440-client.png) / [Developer](after/claimed-1440-developer.png) |
| Timeline | [Client](before/timeline-1440-client.png) / [Developer](before/timeline-1440-developer.png) | [Client](after/timeline-1440-client.png) / [Developer](after/timeline-1440-developer.png) |
| Story | [Client](before/story-1440-client.png) / [Developer](before/story-1440-developer.png) | [Client](after/story-1440-client.png) / [Developer](after/story-1440-developer.png) |

## 390×844

| View | Before Client / Developer | After Client / Developer |
|---|---|---|
| Overview | [Client](before/overview-390-client.png) / [Developer](before/overview-390-developer.png) | [Client](after/overview-390-client.png) / [Developer](after/overview-390-developer.png) |
| Claims | [Client](before/claimed-390-client.png) / [Developer](before/claimed-390-developer.png) | [Client](after/claimed-390-client.png) / [Developer](after/claimed-390-developer.png) |
| Timeline | [Client](before/timeline-390-client.png) / [Developer](before/timeline-390-developer.png) | [Client](after/timeline-390-client.png) / [Developer](after/timeline-390-developer.png) |
| Story | [Client](before/story-390-client.png) / [Developer](before/story-390-developer.png) | [Client](after/story-390-client.png) / [Developer](after/story-390-developer.png) |

No merge without Shu’s explicit OK. PR95 untouched.
