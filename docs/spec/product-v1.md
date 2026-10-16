# TruthLens product specification v1

Status: implementation target requested by the owner, 2026-10-16. This document
specifies release acceptance; its existence is not a release certification.
Existing ledger, HMAC, redaction, approval and artifact-manifest contracts remain
unchanged. Additive decisions follow workspace-v1.md D50.

## Product and audience

TruthLens makes recorded AI work understandable through results, sources and
explicit checks. It is a projection/evidence layer for existing harnesses, not a
harness, task executor or substitute for human approval. Ordinary users see
results first. Technical identifiers, raw events and hashes are disclosures.
Original TruthLens logo remains unchanged; green is brand identity, not proof.

## D51 Release boundary

The local release must work with the user's own supplied files, a scoped local
catalog and MCP clients. The private static website is a demonstration/import
surface, not a connected backend. Hosted connected release additionally requires
an authenticated HTTPS service, project authorization, durable storage, bounded
uploads and end-to-end validation in the target client. Local checks do not certify
ChatGPT installation or a remote production service. Existing example data stays
explicitly identified. A release cannot pass by substituting examples for missing
user data. Unsupported connectors disclose their actual supported import/setup path.

## D52 Ingestion and connection

Start: choose an existing export or configure a supported local source. The
connection screen distinguishes available imports, local MCP setup and future
hosted connectivity. Source configuration grants only named roots/project scope.
An artifact path is a label, never an instruction to read arbitrary local files.
Memory comes from an explicit supported export with source, capture time, scope,
access policy and optional revision links. No hidden agent memory is inferred.

Acceptance:
- A user can import a valid own-work snapshot and open its result in two actions
  after import; prior project state and pending model responses cannot leak across.
- Invalid or oversized input displays a useful error; previous data is not silently
  replaced by examples. Source adapter errors remain visible.
- File/media data is displayed only when actually embedded or provided through an
  authorized bounded retrieval route. A path or remote URL alone is not content.
- Local catalog refresh and browser reload/refresh behavior are documented and
  exercised with a changed source. No heartbeat is inferred from an old snapshot.

## D53 Projections and navigation

A Discord-inspired channel is a saved perspective over existing scoped records,
not an execution room. It has a name and bounded selection/filter/view definition.
Workspace overview remains default. Channels must never copy/reclassify evidence,
create cross-project access, or claim live agent execution. Agent presentation
commands can select only allowed views and canonical records. Users can navigate
without an LLM, account token or model API key. Presentation state may be persisted
locally, with invalid/stale IDs rejected or clearly marked unavailable.

Desktop shows a workspace navigator and selected perspective. Mobile shows one
content surface; explicit tabs accompany gestures. Horizontal document/table/graph
interaction must not trigger a channel change. Navigation returns without losing
selected work. Single result, check summary and source disclosure take precedence
over simultaneous dashboard panels.

## D54 Shared renderer contract

Use existing RenderKit and truthlens.render/1 for canonical identity and provenance.
Web and MCP share components where host capabilities permit; HTML uses the existing
web isolation policy and a readable host fallback. Model-authored presentation never
supplies replacement evidence or truth fields. json-render is an optional adapter
above the catalog, not a separate authority. Raw generated UI/code is not executed.

Required local reader capabilities:
1. Readable Markdown including headings, lists, tables, task lists and source text.
   Raw HTML is not executed and remote assets are not fetched implicitly.
2. Recorded diagrams with readable failure/raw fallback; renderer failure cannot
   prevent inspecting the original document. Graphs expose recorded relationships
   only and offer a linear alternative.
3. Results: code diff, JSON, text, bounded table/chart/timeline and embedded images.
   Before/after requires an explicit pair; never guess two files are revisions.
4. Memory: readable statements, source, recorded dates and revision links; missing
   values explicit. Recorded revisions do not establish current truth or resolve
   contradictions automatically. Technical graph/data details are optional.
5. Large/empty/malformed content has a bounded, understandable state; failed-integrity
   content remains withheld. Unsupported PDF/audio/video is disclosed, not faked.

## D55 Readiness gates

- Real local path: supplied source -> catalog -> scoped snapshot -> web result ->
  evidence/source -> local MCP view, with known source changes reflected explicitly.
- No foreign project/workspace records in views, searches, memory or selected IDs.
- No promotion of imported status to cryptographic verification/human acceptance.
- All essential actions keyboard reachable; dialogs restore focus; no page overflow
  at 360px; reduced-motion respected. Selected flows have no critical/serious axe
  findings. Automated checks are not a claim of complete accessibility compliance.
- Independent agent visual/task review at mobile and desktop, clearly distinguished
  from human acceptance. Screenshots/reports outside repository.
- App/widget production build, lint and relevant contract tests pass; source tree
  committed on feature branch. No main merge without applicable repository review.
- README/setup commands and docs/STATUS.md accurately describe delivered features,
  known omissions and remote-release blockers. No unfinished capability called ready.

## Explicitly later / optional

Native mobile packaging, audio/video transcription, general PDF annotation, 3D/maps,
universal filesystem discovery, automatic extraction of unreviewed memory, arbitrary
agent execution and a custom workflow engine are not prerequisites for the local
reader release. Hosted multi-user service and universal harness adapters require
separate implementation and verification, not merely UI switches.


## D56 Local projection recipe and file-import delivery

The first saved perspective contract is `truthlens.projection/1`, exact keys:
`schema_version,id,title,project_id,workspace_id,view,query`. IDs max200, title80,
project/workspace512, query500 characters; workspace nullable; view one of Results,
Activity, Knowledge, Evidence. Maximum20 unique-ID recipes in browser storage.
Knowledge requires null workspace because memory has only project scope. Unknown
fields, payload/trust/action injection, foreign/stale scope are rejected/unavailable.
This is user-importable agent presentation JSON, not a remote persistence API.

`import-files` packages only explicitly named files in a new output directory.
Structured JSON objects/arrays stay structured through redaction and become JSON
text after the final catalog redaction pass. No native witness/HMAC semantics
change. Bundle publication is complete on successful CLI return; it is not a
transactional directory API for concurrent observers. The data remains IMPORTED.

Text-only flowchart rendering is a web capability. Host widgets retain original
source and do not load the full Mermaid engine. This deliberate host fallback
satisfies D54 without claiming all diagram dialects or hosts are supported.

## D57 Dedicated project-memory MCP view

`truthlens_list_memory` reads authorized project/public notes with snapshot-bound
pagination (maximum50 per page). `truthlens_compose_view(view="project-memory")`
selects at most100 notes within a512KiB note budget; `memory_total` retains the
full authorized count. Run/artifact selectors are rejected for project memory.
Other widget views carry no memory. The shared reader shows statements, recorded
sources and revision links; no statement becomes verified merely by being shown.

## D58 Explicit image comparison

Results permits explicit selection of two different embedded raster artifacts
from the current filtered project/workspace results, capped at200 candidates.
Failed-integrity content, remote URLs and SVG are excluded. The two images retain
original proportions and independent provenance. Selection order is labelled
First/Second, never inferred chronological Before/After or proof of improvement.
Missing/deleted selections resolve against the current records and stop rendering.

## D59 Bounded agent-composed perspective

The optional web adapter uses json-render's actual `root`/`elements` model with
`truthlens.composition/1`, `project_id` and nullable `workspace_id`. One Perspective
root contains1–6 leaf sections: Overview, Result, Checks, Timeline or Memory.
Result takes canonical runId/artifactId; Checks/Timeline take runId; others empty
props. No nested/repeated/unreachable sections, arbitrary props, expressions,
actions, URLs, payloads or trust overrides. Memory requires All workspaces.

The advanced browser disclosure accepts at most20000 characters, validates exact
scope and unique existing references before invoking the rendering engine, and
revalidates against current data on render. Every section reuses authoritative
RenderKit components. The recipe is temporary local presentation state, not a
saved remote channel, an LLM connection or a new evidence record. No API key is
required. MCP fixed views remain their own bounded delivery contract.
