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
- `requirement.recorded` {requirement_id, text, source}; `criterion.recorded` {criterion_id, requirement_id?, text, source}
- `artifact.recorded` {artifact_id, sha256, path, manifest_ref, criterion_ids?}
- `test.reported` {suite, passed, failed, skipped, report_artifact_id, criterion_ids?} — **witnessed**: only written by the wrapper from a test run it executed itself (`actor.kind = wrapper`)
- `evidence.attached` {evidence_id, sha256, kind, refers_to, criterion_ids?}
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
D1 ULID ids with prefixes, one ledger per run · D2 HMAC optional · D3 `request_id` in v1 · D4 no floats · D5 plain `[REDACTED]` · D6 approval timeout 10 min = deny · D7 Client Lens shows "Review required" · D8 run manifest is itself an artifact · D9 torn tail fails verify, manual `repair` only · D10 single writer lock · D11 fsync per event · D12 unknown types ok, unknown envelope fields rejected · D13 order by `seq` only · D14 optional `hmac_key_id` · D15 last hash anchored in `run.finished` + manifest · D16 approval consumed implicitly via `action.executed` · D17 `approval.granted` only by human via CLI outside sandbox · D18 payload ≤ 64 KiB, no inline blobs · D19 acceptance traceability via `requirement.recorded`/`criterion.recorded` + `criterion_ids` · D20 `agent.claim` separate from witnessed evidence; unwitnessed claims flagged.

