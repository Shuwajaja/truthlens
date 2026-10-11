# Event Schema v1 — DRAFT (awaiting approval)

## Envelope
| Field | Type | Req | Notes |
|---|---|---|---|
| `schema_version` | int | yes | `1` |
| `id` | string | yes | `evt_` + ULID |
| `seq` | int | yes | 1-based, gap-free per ledger |
| `ts` | string | yes | RFC 3339 UTC, ms precision |
| `run_id` | string | yes | `run_` + ULID |
| `actor` | object | yes | `{kind: agent|human|system|wrapper, id, name?, version?}` |
| `type` | string | yes | see below |
| `payload` | object | yes | redacted before hashing |
| `prev_hash` | string | yes | hex SHA-256 of previous event, `"0"*64` for genesis |
| `hash` | string | yes | SHA-256 over canonical JSON of the event without `hash` and `hmac` |
| `hmac` | string | no | HMAC-SHA256(key, same bytes); key from env, never stored |
| `request_id` | string | no | idempotency key: same id + same payload → no-op; different payload → error |

## Canonical JSON
UTF-8, keys sorted, separators `,` and `:`, no insignificant whitespace, no NaN/Infinity, integers only (no floats in hashed fields), strings NFC-normalized. One event per line.

## Initial types
- `run.started` {repo, ref, command, agent}; `run.finished` {exit_code, status}
- `artifact.recorded` {artifact_id, sha256, path, manifest_ref}
- `test.reported` {suite, passed, failed, skipped, report_artifact_id}
- `evidence.attached` {evidence_id, sha256, kind, refers_to}
- `action.requested` {action_hash, action}; `action.blocked` {action_hash, policy, reason}
- `approval.granted` / `approval.denied` / `approval.expired` {action_hash, approver, expires_at}
- `action.executed` {action_hash, approval_event_id, result}

Rule: `action.executed` for a blocked action is only valid if a prior `approval.granted` exists with an identical `action_hash`, unexpired and not yet consumed (one use). `action_hash` = SHA-256 of canonical JSON of the full action (command, args, cwd, target files).

## Redaction
Before hashing: values of keys matching `(?i)(secret|token|password|api[_-]?key|authorization)` and string values matching known key patterns (e.g. `sk-…`, `ghp_…`, `Bearer …`) → `"[REDACTED:<sha256-prefix-8>]"`. Redaction is irreversible; the original is never written.

## Verification
Fail-closed: unparseable line, seq gap, prev_hash mismatch, hash mismatch, HMAC mismatch (if key given) → report line number and reason; writes are blocked.

## Open questions
See README / parent report.
