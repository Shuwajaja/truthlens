# Read-only audit verifier — plan v1.2 contract

This implementation follows `truthlens-pruef-agent-plan-v1.2.md`, revision 1.2,
tasks 1–6. The referenced `TruthLens-Pruef-Agent-SPECC-v1.0.md` was unavailable.
The outcome enum, report shape and rule grouping below are explicit provisional
choices derived from that plan, not a claim of conformance with the missing
SPECC's 18 acceptance criteria. D33 adds this independent boundary; existing
ledger, manifest, approval and D26/D27 projection contracts remain unchanged.

## Inputs and command

`truthlens audit RUN_DIR --json [--hmac-key-file PATH] [--expect-last-hash HEX]`.
No key is read from the environment. HEX is a lowercase SHA-256 digest. Optional
key files must be external, regular, non-symlink, owned by the executing user,
without group/other permissions or multiple hardlinks, and 1–4096 bytes before
whitespace stripping. Empty stripped keys fail. Invalid key configuration yields
a fixed `not_checkable` JSON report, without reflecting key contents or paths.
Argument errors use stderr and exit 2. Without `--json`, only the conclusion is
printed. Existing verify/report commands retain their behavior.

POSIX descriptor-relative reads reject symlink parents, traversal, nonregular
files and unstable inputs. The reader opens no output files and performs no
repair, execution or network call. It hashes every referenced top-level payload
`sha256` and `report_artifact_id`, including evidence and test reports omitted
from manifest artifact lists. Strict JSON rejects duplicate keys and noninteger
numbers. Core chain verification and manifest recomputation are reused.

Default limits: ledger 67,108,864 bytes; manifest 8,388,608 bytes; 100,000 events;
20,000 unique blob references; 536,870,912 total unique input bytes. Reads are
bounded, including a single overflow-detection byte. Final checks reopen the
root and each consumed path and compare identity, metadata and digest. These
checks do not provide an atomic filesystem snapshot against an active same-UID
attacker. Supply a read-only snapshot outside worker permissions. Resource,
permission and unsupported-platform gaps fail closed.

## Findings and exits

Each check carries `rule_id`, `outcome`, `required`, fixed `message`, safe
`event_ids`/`criterion_ids`, and optional integer/digest `expected`/`actual`.
Outcomes: `supported`, `contradictory`, `not_checkable`. Findings omit source text,
stdout, paths, commands, actor names and exception details. Recognized output IDs
are prefixed ULIDs or short letter-plus-number fixture IDs; other source IDs are
omitted, without changing internal evidence correlation.

| Rule | Checked scope |
|---|---|
| TL-AUD-001 | Strict ledger structure, chain, bounded and stable inputs |
| TL-AUD-002 | Every referenced blob exists and matches its content digest |
| TL-AUD-003 | Supplied-key HMAC authentication; hash-only remains a gap |
| TL-AUD-004 | Complete run close and recomputed manifest |
| TL-AUD-005 | Optional external anchor; verifier provenance/configuration |
| TL-AUD-006 | Exact integer, nonnegative test counters; integer exit code |
| TL-AUD-007 | Recorded pass/fail counts versus exit code contradictions |
| TL-AUD-008 | Skipped-only, empty or no-tests execution is not passing |
| TL-AUD-009 | Exact first wrapper command/exit header versus recorded exit |
| TL-AUD-010 | XML totals without a bound parsed XML source remain optional/unverified |
| TL-AUD-011 | Changed test files are informational, not proof of forgery |
| TL-AUD-012 | Completion claim versus latest confirmed criterion evidence |

Exact command matching includes multiline suites; later stdout resembling exit
headers is inert. No arbitrary test stdout is interpreted as a verified result.
A non-completion claim is explicitly not semantically verified. An honest
failed run keeps its recorded `unmet` result: failure alone is not forgery or
support for completed work. Inconsistent test metadata cannot support a claim,
but the original projected `met`/`unmet` value is never rewritten. An empty or
unconfirmed claim scope is not supported. Optional unbound XML checks alone do
not prevent an otherwise scoped supported result.

Exit precedence: any contradiction → 1 (`contradictory`); otherwise any required
gap → 2 (`not_checkable`); otherwise → 0 (`supported_within_scope`). No fabricated
missing evidence, missing HMAC, skipped-only execution or empty coverage becomes
success. Integrity is not approval.

## Deterministic report

Sorted compact JSON includes `audit_version` (1), `ruleset_version` (1.0.0),
installed `verifier_version`, `conclusion`, `integrity`, `authentication`,
`run_id`, `criteria`, `claims`, sorted `checks`, `input_digests` and fixed `limits`
statements. Integrity is `hmac`, `hash-only`, `failed` or `not_checkable`.
Authentication uses the check outcome enum. Criteria preserve projected status
and safe evidence IDs; claims expose projected and audit findings separately.
Invalid integrity never exports positive content conclusions.

`input_digests.run` contains consumed run-relative paths and SHA-256 digests;
`input_digests.verifier` hashes actual installed verifier and reused core source
files, not bytes from the run. No wall clock or synthetic report ID is included.
This is provenance of the bytes read, not attestation of a protected executable.

## Integration boundary and missing evidence

Tasks 7–9 are not live-connected here. The inspected pinned Agent Zero ACP
wrapper (`vps-system`, blob `8943f4296c486f5a8d5127235c13a18639d5acd9`)
has no verified TruthLens capture/snapshot registration path, and its ACP
`authenticate` handler alone does not establish an external principal. A trusted
supervisor, immutable snapshot, external anchor/key custody, authenticated
principal/session binding and actual Mausbot/skill entry point must be identified
before production bridging. Model text, heartbeat and completion messages cannot
substitute for witnessed events. No routing, deployment or host configuration is
changed. Widget and bridge mocks must never be described as working live capture.

Still unavailable: companion SPECC's exact report contract/outcomes, twelve-rule
mapping, full 18-criterion inventory, and HTTP requirements 9/10. These must be
reconciled when that source is provided. No live ACP/Mausbot/widget or independent
CodexChat security acceptance is claimed by this core implementation.

## Verification scope

Issue #152's deterministic command is
`python -m pytest -q tests/test_audit.py tests/test_audit_inputs.py`.
The new units are included in fast Python PR CI; browser/axe/full release suites
remain in the existing manual release-review workflow. No test files are removed.
Historical `demo-2` is copied and audited without its unavailable original key;
it stays unauthenticated and cannot produce a positive scoped conclusion.
