# UI Concept (Week 3)

**Pitch:** TruthLens turns AI work into visible truth — what the agent claimed, what actually happened, what is proven.

This document is the Week 3 web-viewer concept: what a run looks like in the browser, which views exist, and how status and trust map to the frozen schema. It builds directly on [docs/spec/event-schema-v1.md](docs/spec/event-schema-v1.md) and [docs/TRUST-LEVELS.md](docs/TRUST-LEVELS.md).

## Principles

- The viewer renders only what the ledger can prove; nothing is invented beyond the projection.
- A claim is never shown as witnessed. Every green check has a witnessed `test.reported` / `evidence.attached` behind it (`actor.kind = wrapper|system`).
- Plain language first (Client mode), detail on demand (Developer Lens).
- No trust meters, no percentages. Counts and concrete statuses only — a number like "3 of 5" is honest; a percentage overreaches.

## Status colors

One status list only: the schema's criterion `status`. Each value maps to exactly one color.

| Status | Color | Meaning |
|---|---|---|
| `met` | green | witnessed evidence passes the criterion |
| `unmet` | red | witnessed evidence fails the criterion |
| `unverified` | gray | no witnessed evidence yet |
| `proposed` | amber | derived criterion awaiting human `criteria.confirmed` (D22) |
| `claimed` | blue | `agent.claim` only, no witness covers it (D20) |
| `human-approved` | violet | a human explicitly confirmed it (`criteria.confirmed` / `approval.granted`, `actor.kind = human` (D17)) |

No second status list. Trust-level labels (`imported`, `integrity_verified`, `review_required`, `verification_failed`) are shown as an adjacent trust badge per artifact — they never replace a criterion's status color.

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

### 2. Claimed vs Witnessed (signature view)

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