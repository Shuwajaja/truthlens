# Inventory & provenance (Week 0, updated at schema freeze)

All listed repos are the owner's reusable code pool. WERKAgent UI components are coupled to internal modules (`unifiedActionRegistry`, `ActionBar`, `MediaVisualizer`, `reviewVerdict`) and need 2–3 days of decoupling before reuse. Default branches: agent-control-plane `master`, WERKAgent `goose-refine` — record the commit SHA when porting.

Source repos (all owned by Shuwajaja) were shallow-cloned read-only on 2026-10-11. Nothing was copied into TruthLens in this commit.

## License situation (checked: LICENSE files + pyproject/package.json)
| Repo | LICENSE file | Declared | Note |
|---|---|---|---|
| werktools | yes, AGPL-3.0 | `AGPL-3.0-or-later` | Copyleft. Ported code would make TruthLens a derivative work. |
| CrewTYY | **no** | `MIT` in pyproject.toml only | Public repo; add a LICENSE file to make MIT unambiguous. |
| WERKCommander | **no** | none | Unlicensed (all rights reserved by owner). `events.py` says it was "adapted from WERKAgent_Runtime events.py + store.py" — upstream origin to confirm. |
| ai-agent-workspace | **no** | none | Unlicensed. `core/ledger.py` header: adapted from WERKCommander `events.py` @ 8103cebc. |
| agent-control-plane | **no** | none | Unlicensed. |
| WERKAgent | **no** | none | Unlicensed. |

Since the owner wrote the unlicensed repos, he can relicense them — provided no third-party or AI-tool-copied code from elsewhere is inside. The AGPL in werktools is also the owner's choice, but anything already published under AGPL stays available under AGPL; a port into a differently-licensed TruthLens is only clean if the owner is the sole author of that code.

## Components
| # | Component | Path | Purpose | LOC | Tests | License | Decision | Why |
|---|---|---|---|---|---|---|---|---|
| 1 | Hash-chain event store | WERKCommander `src/werkcommander/events.py` | JSONL append, SHA-256 chain, optional HMAC (`WERK_LEDGER_SECRET`), redaction before hash, schema_ver 1–3 | 490 | test_ledger_hmac (6), test_verify_ledger, test_doctor_ledger, parity tests | none | **Port (adapt)** canonical JSON, chain hash, HMAC, redaction | Most mature crypto path; but skips corrupt lines silently → replace with fail-closed from #2 |
| 2 | Hardened ledger | ai-agent-workspace `core/ledger.py` | Rewrite of #1: corruption fatal, cross-process single writer, idempotency by request_id, evidence store | 593 | test_contract_ledger (20), test_telemetry_ledger (20) | none | **Port (base)** | Best robustness semantics; 36-type taxonomy is dropped in favour of Schema v1 |
| 3 | Projection rebuild | agent-control-plane `packages/projection/python/projection/replay.py` | Double-verify ledger, build fresh SQLite in temp file, validate references, atomic replace | 805 | test_replay (9) | none | **Port (adapt)** | Exactly the "projections of truth"; must be rewritten against Schema v1 (depends on `acp_contracts` events) |
| 4 | Projection DB schema | agent-control-plane `.../projection/database.py` | Versioned SQLite schema, drift detection, FK enforcement | 192 | test_database (8) | none | **Port** | Small, generic |
| 5 | ACP event ledger | agent-control-plane `packages/ledger/python/ledger/event_ledger.py` | Chain + DuplicateEventError + external schema validation | 214 | test_event_ledger (6) | none | **Skip** (ideas only) | Superseded by #1/#2 |
| 6 | Approvals + gateway ledger | werktools `src/werktools/hub/approvals.py`, `ledger.py`, `hub/ledger.py` | One-use argument-bound approvals, deny-by-default policy, fcntl/msvcrt lock | 461 + 167 + 64 | test_hub_approvals, _server, test_ledger, test_hub_ledger | **AGPL-3.0** | **Reusable pool (evaluate/reuse)** | Owner's own code; part of the owner's reusable code pool per mission (2026-10-11). Reuse only code the owner authored himself; note AGPL origin in the port header. |
| 7 | UI components | WERKAgent `src/components/v2/projections/` (DiffSurface 98, TableSurface 90, InboxSurface 556, SearchRenderer 258), `ArtifactCanvas.tsx` 353, `src/data/evidence.ts` 66 | Diff/table/inbox surfaces, artifact canvas, evidence projection | ~1,420 | component tests present | none | **Port selectively** (DiffSurface, TableSurface, ArtifactCanvas ideas) | Coupled to WERKCommander bridge + design system; strip to plain props |
| 8 | Event store | CrewTYY `crewtty/event_store.py` | Append-only JSONL, monotonic IDs, best-effort lock, **no hash chain** | 176 | in 462-test suite | MIT (undeclared file) | **Skip** | No integrity features; nothing #1/#2 lacks |

## Event-model differences (why Schema v1 is a new contract)
- **WERKCommander:** `event_id`, `ts`, `actor`, `prev_hash`, `hash`, `schema_ver` (1/2/3); 12→18 mission-centric types (`mission.*`, `task.*`, `mission.result.decided`); HMAC optional.
- **ai-agent-workspace:** adds `seq` and `request_id` (idempotency), `schema_ver` 1, 36 types, evidence refs that must exist before reference.
- **agent-control-plane:** `event_id` + `event_hash`/`prev_hash`, event factories in `acp_contracts`, entities request→mission→slice→evidence.
- **werktools:** generic records with `hash`/`prev_hash`, no schema, no types.
- **CrewTYY:** domain `EventType` enum, monotonic ids, `SCHEMA_VERSION`, no chain.

Naming of hash fields, sequence numbers, entity model and taxonomy all differ. TruthLens defines its own run-centric Schema v1 and adapts ported logic to it rather than merging models.

## Rule for porting
Every ported file: header with source repo, commit SHA, path, and what changed; commit message `port(<area>): from <repo>@<sha>:<path>`. werktools code may be reused (owner-authored only), with AGPL origin noted in the header.

## Workspace upgrade dependencies (2026-10-16)

The workspace implementation reuses TruthLens's own verifier, manifest checks,
redaction and existing React text/Markdown/Diff views. No WERKAgent,
WERKCommander or CrewTYY code was copied: their candidates remain reference-only
pending full license/dependency review. Base backend runtime dependencies remain empty.

Viewer dependency `dompurify` 3.4.17 (lockfile pinned; upstream license
`MPL-2.0 OR Apache-2.0`, Apache-2.0 option) removes executable/navigation markup
before HTML enters the separate opaque sandbox. This dependency is justified by
untrusted HTML preview safety rather than a custom regex sanitizer. The sandbox
also applies restrictive CSP and strips navigation/resource URL attributes.

## Optional MCP Apps adapter (2026-10-16)

The `app` Python extra pins the official `mcp` SDK 1.30.0 (MIT) for protocol
negotiation, schema validation, Streamable HTTP and transport origin protection.
It is optional so capture/verifier/legacy stdio users retain the dependency-free
base package. SDK transitive dependencies are installed only with this extra.

The widget uses `@modelcontextprotocol/ext-apps` 2.0.3 (MIT) for the standard
App/AppBridge protocol; its local preview uses `@modelcontextprotocol/client`
2.3.1 and its transitive `@modelcontextprotocol/core` 2.3.1 (Apache-2.0) to call
the real server. `vite-plugin-singlefile` 2.3.3 (MIT, build-only)
inlines the React widget and local preview into separate HTML resources, avoiding
external script/font hosting and a hand-written postMessage transport. The npm
lockfile records exact versions. The normal workspace entry does not import
these host/bridge modules. Artifact views reuse TruthLens's own existing renderers.

## RenderKit v6 and owner branding (2026-10-16)

The shared RenderKit, scope/tab shell and versioned render projection are original
TruthLens implementation; no code from the v6 reuse candidate repositories was
copied. Existing React, DOMPurify and MCP SDK dependencies suffice; this increment
adds no runtime dependency. Heavy editor/chart/animation candidates remain optional.

The owner supplied `1000053904.jpg` (mark) and `1000053903.jpg` (wordmark) directly
for this app on 2026-10-16. They are stored unchanged in `viewer/src/assets/` as
`truthlens-mark.jpg` and `truthlens-wordmark.jpg`. This records their supplied
provenance/use authorization, not an independent trademark ownership audit.

## Design-loop frontend reuse (2026-10-16)

- `lucide-react` **1.58.0**, ISC (with upstream Feather attribution retained in its
  license): selected static React icon imports replace hand-drawn navigation
  glyphs. Source: https://github.com/lucide-icons/lucide .
- `react-json-view-lite` **2.5.0**, MIT: collapsible, keyboard-navigable recorded
  JSON in the artifact renderer and source inspector. Large/deep records fall
  back to plain text; no remote data or executable UI is accepted. Source:
  https://github.com/AnyRoad/react-json-view-lite .

Both packages are exactly pinned in the lockfile, have no additional runtime
package dependencies beyond the existing React peers, and keep upstream licenses
in their installed packages. shadcn/ui, assistant-ui, CopilotKit and Microsoft
AutoGen were reviewed as candidates. No code from those projects was copied or
runtime installed; their component/agent stacks do not supply TruthLens's scoped
recorded-evidence contract. AutoGen code and documentation have separate licenses;
GitHub's top-level license badge alone is not a code reuse authorization.

License texts for the new icon/JSON dependencies are also distributed in
`viewer/public/THIRD_PARTY_NOTICES.txt`. Motion/renderer research additionally
checked Motion (MIT), Pierre Diffs (Apache-2.0), Streamdown (Apache-2.0), Shiki
(MIT), React Flow (MIT) and Animate UI (MIT plus Commons Clause). No code/runtime
from those candidates is included. Current animation uses native Web Animations
and CSS; a richer syntax engine remains contingent on actual widget size/CSP needs.


## Reader composition dependencies (2026-10-16)

The web reader uses `@json-render/core` and `@json-render/react`0.21.1
(Apache-2.0) with Zod4.3.6 (MIT) for the closed presentation catalog. The adapter
resolves existing TruthLens records; no upstream demo agent/runtime or generated
HTML/JavaScript execution is copied. Markdown uses react-markdown/remark-gfm
(MIT); bounded optional diagrams use Mermaid (MIT). Package lock records the
installed dependency versions. Original TruthLens trust contracts remain local.
