# Event Schema v1 — FROZEN (v1, 2026-10-11)

Changes after freeze require a new schema version or an explicit decision record in this file.

## Envelope
| Field | Type | Req | Notes |
|---|---|---|---|
| `schema_version` | int | yes | `1` |
| `id` | string | yes | `evt_` + ULID (D1) |
| `seq` | int | yes | 1-based, gap-free per ledger |
| `ts` | string | yes | RFC 3339 UTC, ms precision; wall clock, informational only — ordering is defined solely by `seq` (D13) |
| `run_id` | string | yes | `run_` + ULID; one ledger per run (D1) |
| `actor` | object | yes | `{kind: agent|human|system|wrapper, id, name?, version?}` |
| `type` | string | yes | see below |
| `payload` | object | yes | redacted before hashing |
| `prev_hash` | string | yes | hex SHA-256 of previous event, `"0"*64` for genesis |
| `hash` | string | yes | SHA-256 over canonical JSON of the event without `hash` and `hmac` |
| `hmac` | string | no | HMAC-SHA256(key, same bytes); key from env, never stored (D2) |
| `hmac_key_id` | string | no | identifies the HMAC key for rotation; required if `hmac` present (D14) |
| `request_id` | string | no | idempotency key: same id + same payload → no-op; different payload → error (D3) |

## Canonical JSON
UTF-8, keys sorted, separators `,` and `:`, no insignificant whitespace, no NaN/Infinity, integers only — floats anywhere in an event are rejected (D4), strings NFC-normalized. One event per line.

## Initial types
- `run.started` {repo, ref, command, agent}; `run.finished` {exit_code, status, last_hash} — `last_hash` = hash of the last event before it; anchors the chain end (D15)
- `requirement.recorded` {requirement_id, text, source}; `criterion.recorded` {criterion_id, requirement_id?, text, source: `user|derived`, derived_by?} — `derived_by` (actor of the agent that derived it from the user's request) required when `source = derived`
- `criteria.confirmed` {criterion_ids} — `actor.kind = human` only, via CLI/UI, written before the run starts. Derived criteria without confirmation are `proposed` and never count toward `met` (D22).
- `artifact.recorded` {artifact_id, sha256, path, manifest_ref, criterion_ids?}
- `test.reported` {suite, passed, failed, skipped, report_artifact_id, criterion_ids?} — **witnessed**: only written by the wrapper from a test run it executed itself (`actor.kind = wrapper`)
- `evidence.attached` {evidence_id, sha256, kind, refers_to, criterion_ids?} — `kind` is an open string; registered v1 kinds: `document`, `source_visited` (url), `message_sent`, `file_changed`, `command_run`, `test_run`. Unknown kinds are valid and rendered generically (D21).
- `agent.claim` {claim_id, kind, text, criterion_ids?} — what an agent *says* (e.g. "all tests green"); `actor.kind = agent`. Never evidence by itself.
- `action.requested` {action_hash, action}; `action.blocked` {action_hash, policy, reason}
- `approval.granted` / `approval.denied` / `approval.expired` {action_hash, approver, expires_at}
- `ledger.repaired` {removed_bytes, removed_sha256, last_valid_seq}
- `action.executed` {action_hash, approval_event_id, result}

Rule: `action.executed` for a blocked action is only valid if a prior `approval.granted` exists with an identical `action_hash`, unexpired and not yet consumed (one use). Consumption is implicit: a granted approval is consumed by the first `action.executed` referencing it via `approval_event_id`; verify rejects a second reference (D16). `approval.granted` requires `actor.kind = human` and is only written by the CLI `truthlens approve`, run outside the agent sandbox (D17). Agent/policy decisions are recorded as `actor.kind = agent`; automated test approvals carry `payload.simulated = true` and never count as human approval. Approval timeout default 10 min; expiry = deny (`approval.expired`) (D6). `action_hash` = SHA-256 of canonical JSON of the full action (command, args, cwd, target files).

## Claimed vs witnessed
A claim is **supported** only if a witnessed event (`test.reported` / `evidence.attached` by `wrapper|system`) covers the same `criterion_ids` (for test claims: a `test.reported` with `failed = 0`). Projections and `verify --claims` flag unsupported claims as `claim_unwitnessed`; this is a finding, not an integrity failure.

## Redaction
Before hashing: values of keys matching `(?i)(secret|token|password|api[_-]?key|authorization)` and string values matching known key patterns (e.g. `sk-…`, `ghp_…`, `Bearer …`) → plain `"[REDACTED]"` (no hash hint — a short secret's hash prefix is brute-forceable) (D5). Redaction is irreversible; the original is never written.

## Verification
Fail-closed: unparseable line, seq gap, prev_hash mismatch, hash mismatch, HMAC mismatch (if key given), unknown envelope field, float value, payload > 64 KiB, `run.finished.last_hash` mismatch, approval rule violation → report line number and reason; exit non-zero; further appends are refused.

- **Torn tail (D9):** a partial last line after a crash is a verify failure. It is only removed by the explicit manual command `truthlens repair`, which truncates to the last valid line and appends a `ledger.repaired` event {removed_bytes, removed_sha256, last_valid_seq} with `actor.kind = human|system`. Never automatic.
- **Truncation (D15):** a ledger whose run has `run.finished` is anchored; the manifest also stores `last_hash`. A missing tail is detected against the anchor. An unfinished run without anchor is reported as `unanchored` (warning, not verified-complete).

## Writing
- Single writer per ledger via exclusive `fcntl` lock file `<ledger>.lock` (D10).
- Every append is flushed and `fsync`ed before returning (D11).
- Payload max 64 KiB canonical bytes; files/blobs are never inline — store content-addressed and reference by sha256 (D18).

## Evolution (D12)
Unknown event `type`s are allowed (verified by chain, ignored by projections). Unknown envelope fields are rejected.

## Decision record (adopted 2026-10-11)
D1 ULID ids with prefixes, one ledger per run · D2 HMAC optional · D3 `request_id` in v1 · D4 no floats · D5 plain `[REDACTED]` · D6 approval timeout 10 min = deny · D7 Client Lens shows "Review required" · D8 run manifest is itself an artifact (superseded by D28) · D9 torn tail fails verify, manual `repair` only · D10 single writer lock · D11 fsync per event · D12 unknown types ok, unknown envelope fields rejected · D13 order by `seq` only · D14 optional `hmac_key_id` · D15 last hash anchored in `run.finished` + manifest (close order: D28) · D16 approval consumed implicitly via `action.executed` · D17 `approval.granted` only by human via CLI outside sandbox · D18 payload ≤ 64 KiB, no inline blobs · D19 acceptance traceability via `requirement.recorded`/`criterion.recorded` + `criterion_ids` · D20 `agent.claim` separate from witnessed evidence; unwitnessed claims flagged · D21 evidence/artifact kinds generic and open (not code-specific); Client Lens is the primary view · D22 derived criteria need human `criteria.confirmed`, else `proposed`.


## Decision record – post-freeze review fixes (2026-10-11, independent review on #9/#11; agent decisions, not human approval)
- **D23 Criterion authorship.** `criterion.recorded` with `source = user` is valid only with `actor.kind = human`. Any other actor must use `source = derived` (+ `derived_by`). Verify rejects violations. A criterion counts toward `met`/`unmet` only if it is `source = user` (human) or confirmed by `criteria.confirmed`.
- **D24 IDs unique, references resolvable, confirmation bound to text.** `requirement_id` and `criterion_id` are unique per ledger (second `*.recorded` with the same id = verify error). `criterion.recorded.requirement_id`, `criterion_ids` in any event and `criteria.confirmed` entries must reference an earlier recorded id. `criterion.recorded` carries `text_sha256` (SHA-256 of NFC UTF-8 `text`); `criteria.confirmed` becomes `{criteria: [{criterion_id, text_sha256}]}` and confirms exactly that text. Re-defining a criterion requires a new `criterion_id`.
- **D25 Evidence result.** `evidence.attached` gets `result: pass | fail | info`. Only `wrapper|system` evidence with `pass`/`fail` can decide `met`/`unmet`; `info` never does. Actor rule applies to all witnessed types: `test.reported` and decisive `evidence.attached` must have `actor.kind ∈ {wrapper, system}` (verify error otherwise).
- **D26 Claim support is per criterion and per result.** A claim is supported only if, for **every** criterion in its `criterion_ids`, the latest witnessed decisive event is passing. A claim with missing **or empty** `criterion_ids` is never supported (`claim_unwitnessed`).
- **D27 "Tests green".** A `test.reported` is passing only if `failed = 0` **and** `passed > 0`. `skipped > 0` is shown, never counted as passed; a run with only skipped tests is `unverified`.
- **D28 Run close order (fixes manifest hash cycle, amends D8/D15).** Order: last regular event → `run.finished {last_hash = hash of previous event}` → manifest written **after** the ledger is closed, with `ledger_last_hash = hash(run.finished)`. The manifest is **not** recorded inside the ledger; it is bound to the ledger by `ledger_last_hash` and verified by checking that value against the verified ledger and every listed `sha256` against the content store. No events after `run.finished` except `ledger.repaired`. **Manifest content is never trusted:** every `artifacts[]` entry must equal an `artifact.recorded` event of the ledger (`artifact_id`, `path`, `sha256`, `criterion_ids`; `provenance`/`kind`/`renderer` are either in that event payload or derived), and `acceptance` is recomputed from the ledger by verify/projections; any difference = `verification_failed`.
- **D29 Redaction key list (amends D5 wording).** Key names matching secret words (secret, password/passwd/pwd, api/access/private key, authorization, credential(s), cookie, session id, token) are redacted, **except this closed list of token counters** (case-insensitive, `-`≡`_`): `tokens`, `max_tokens`, `max_token`, `num_tokens`, `total_tokens`, `input_tokens`, `output_tokens`, `prompt_tokens`, `completion_tokens`, `max_completion_tokens`, `tokens_used`, `token_count`. CLI flags (`--password x`, `--token=x`), `NAME=value` assignments, URL credentials and `Basic`/`Bearer` values are redacted regardless of length.
- **D30 Approval checks in verify (amends D16/D17).** `action.executed` always needs a non-empty `action_hash`; if an `action.blocked` with that hash exists, `approval_event_id` is mandatory. Approvals with `simulated = true` or `expires_at` before the executing event never authorize. Without HMAC, `actor.kind = human` is self-declared; D17 is enforced only when the ledger is HMAC-signed with a key held outside the agent sandbox (then `approval.granted`/`criteria.confirmed` must carry `hmac`).
- **D31 Canonical lines.** Each ledger line must be byte-identical to the canonical JSON of its parsed event; duplicate keys are rejected.

- **D33 Read-only audit boundary (plan v1.2, agent implementation; not human approval).** A separate auditor may derive contradiction/support findings from existing verified records and referenced bytes. Findings never amend event payloads, D26/D27 projections, criteria confirmation, approval gates or run data. Hash-only authentication is not checkable; a positive scoped audit is neither acceptance nor approval. See [audit-verifier-v1.md](audit-verifier-v1.md). D1–D32 are unchanged.
