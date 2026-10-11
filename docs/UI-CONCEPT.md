# UI Concept (Week 3)

**Pitch:** TruthLens turns AI work into visible truth — what the agent claimed, what actually happened, what is proven.

This document is the Week 3 web-viewer concept: what a run looks like in the browser, which views exist, and how status and trust map to the frozen schema. It builds directly on [docs/spec/event-schema-v1.md](docs/spec/event-schema-v1.md) and [docs/TRUST-LEVELS.md](docs/TRUST-LEVELS.md).

## Principles

- The viewer renders only what the ledger can prove; nothing is invented beyond the projection.
- A claim is never shown as witnessed. Every green check has a witnessed `test.reported` / `evidence.attached` behind it (`actor.kind = wrapper|system`).
- Plain language first (Client mode), detail on demand (Developer Lens).
- No trust meters, no percentages. Counts and concrete statuses only — a number like "3 of 5" is honest; a percentage overreaches.

## Status colors

Visual direction and colours are defined once in [DESIGN.md](../DESIGN.md) (v2, dark mission-control): green = `met`, yellow = claimed only (`claim_unwitnessed`), red = `unmet`, gray = `unverified` (not claimed), dashed outline = `proposed`. The main view shows plain language and counts only; hashes and IDs appear only in the detail drawer and Timeline/audit. Approved concept mockups: `v2-01-truth-overview`, `v2-02-claimed-vs-proven`, `v2-03-timeline` (Drive `Projekte/truthlens`).

## MVP views

### 1. Truth Overview — Criteria Board (primary, Client mode)

One screen per run, the default view.

- Header: agent, repo, ref, run id, start/end times, ledger anchor (`run.finished.last_hash`).
- **Summary count line** (no percentages): "3 of 5 criteria witnessed, 1 claimed only, 1 unchecked" — witnessed = `met` + `unmet`, claimed only = `claimed`, unchecked = `unverified` + `proposed`.
- Criteria Board: one row per criterion from `requirement.recorded` / `criterion.recorded`.
  - Each row: status dot (color from the table above), plain-language sentence, witnessed evidence count, claim count, review state.
  - Plain-language phrasing per Client Lens: "You asked for X — done, witnessed by Y", "claimed, not witnessed", "not done", "review required".
- Clicking a row opens the artifact/evidence detail drawer.
- "Review required" banner when `review_required` trust or unconfirmed `proposed` criteria exist (D7).

### 2. Claimed vs Proven (signature view: "What your agent said vs. what we saw")

The split panel that makes the pitch visible.

- Left column: everything the agent claimed (`agent.claim` events).
- Right column: everything the wrapper actually witnessed (`test.reported`, `evidence.attached`, `action.executed`).
- A claim is linked to a witness when a witnessed event covers the same `criterion_ids`; otherwise it is flagged `claim_unwitnessed`.
- Every claim row carries an explicit badge: **Supported** or **Claimed only**.
- This view is what separates a real proof from a status report (TRUST-LEVELS.md principle: claimed ≠ witnessed).

### 3. Run Timeline

- Vertical timeline ordered by `seq` (D13), one row per event, grouped into: requests/requirements, capture, approvals, execution, tests, finish.
- Each row: event type, `actor.kind` with label, timestamp, hash prefix; click to see the raw event JSON.
- End anchored at `run.finished`; a torn tail renders as an error row "torn tail / repair required".
- Approval gate is legible: block event → `approval.granted` → `action.executed` chain, with the action hash binding (D16).

### Artifact / evidence detail drawer

One drawer, opened from any view.

- Artifact: path, media type, renderer, size, sha256, provenance (`original | imported | derived`), trust badge, review state.
- Evidence: kind (`document`, `source_visited`, `message_sent`, `file_changed`, `command_run`, `test_run`, …), `refers_to`, link to the producing event.
- One tab per renderer: markdown, diff, code, image, json, raw; unknown kinds render as raw (D21).
- Cross-links: which criteria this artifact/evidence covers (`criterion_ids`).

## Later / cut

Out of the Week 3 MVP, deferred or cut:

- **Evidence graph** — force-directed graph of criteria / evidence / artifacts with full path coverage. Nice-to-have; the flat board already answers "is it proven".
- **Provenance tree** — visual `derived_from` / runner graph for every artifact. Cut first if behind schedule.
- **Client / Builder / Audit mode switch** — a three-way persona switch (plain language, technical, raw audit). v1 keeps a global two-lens toggle instead.
- **Trust meters / percentages** — deliberately never planned; counts are truthful, percentages overreach.

Cut order: provenance tree → evidence graph → mode switch. Integrity indicators are never cut.
## Post-v1 ideas (concept mockups v3/v4, not scheduled)
- **Markdown proof margin** – rendered markdown report with a margin marking each sentence as proven / claimed / failed (v3-01).
- **Claim extraction in markdown** – highlight claims inside an agent's markdown answer and link each to its criterion (v4-02); markdown diff as a story (v4-01).
- **Evidence graph** – criteria ↔ evidence ↔ artifacts (v3-02); charts over runs, counts only (v3-03).
- **File provenance** – per file: who/what created or changed it, from which run (v3-04).
- **Artifact gallery** – visual grid of produced artifacts with their status (v4-03).
