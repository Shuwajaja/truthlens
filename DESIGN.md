# DESIGN.md – TruthLens viewer, P2

The owner approved the P2 overview reference on 2026-10-22: mountain header, left navigation, measured status cards, exported runs, code diff, evidence graph, criterion evidence, recorded timeline and collapsible Navigator. This updates the earlier v2 layout/palette rules. TruthLens only; no other product themes or workspace mock data.

## Visual system

- `viewer/src/theme.css`: only the supplied base tokens and TruthLens overrides, exposed to Tailwind. Dark green surfaces, subtle borders, 8/12px corners, system fonts. No remote fonts or assets.
- Header mountain and shield/eye artwork reuse the supplied local SVG design. The mountain gradients belong to that approved artwork; other surfaces stay solid.
- Four compact overview cards contain actual RunDoc values/counts. No invented history, sparklines, percentages, scores or trust meters. Show only the one exported run. Missing content has a neutral empty state.
- Main layout follows the reference with 16px gaps, 20/24px content padding, 220px desktop navigation and a 300px Navigator when expanded. Mobile navigation and content stack; code/tables scroll inside their containers.
- Preserve the four existing views and Client/Developer lens. Navigation labels and recorded text remain as before; new overview labels and required trust warnings follow the German reference.

## Recorded data and trust

- Renderers display exported data only. Criterion status, claim finding, `verified` and `integrity` never change in the UI. Counts are counts of exported records, not a new verdict.
- Criterion badges show plain language plus the exact schema status. Claims stay separate from proof, including `supported` claims; a related criterion may independently have status `met`.
- HMAC checked requires both `verified === true` and `integrity === 'hmac'`. No verification label or green check for unsigned exports. Hash-only exports say **“Nur Hash · HMAC nicht geprüft”**.
- **“Integrität ≠ fachliche Freigabe”** and the fixed browser limitation remain visible: the browser checks internal consistency only and does not verify signatures. Integrity does not establish human acceptance. Agent Story always retains its Review required notice.
- Display recorded headlines, criterion explanations and claim findings without inventing statements. IDs/hashes belong in detail/audit views; timestamps are absolute with a zone.
- Graph edges require recorded links between exported nodes. An unwitnessed claim remains isolated. Node selection opens the existing recorded evidence content.
- Navigator is UI only: static suggestions and a disabled input explicitly labelled “Navigator kommt später”. No AI or network requests.

## Interaction and review

Real buttons/links, labelled icon controls, visible focus, semantic landmarks and one h1 per view. Status has text as well as colour. Drawers move/trap focus, close with Escape and restore focus. Text contrast meets AA. Respect reduced motion; colour/opacity transitions only.

Use `.agents/skills/no-slop-ui/` and `.agents/skills/web-interface-review.md` for the final check. Explicit P2 reference choices (mountain artwork, metric cards and Navigator) take precedence over generic pattern restrictions. Snapshot changes must identify the intended visual change; isolated renderer baselines stay unchanged unless that renderer is deliberately updated.
