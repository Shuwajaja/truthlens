# Read-only audit verifier — plan v1.2 contract

This implementation follows `truthlens-pruef-agent-specc-v1.2.md` (22 October
2026), sections 4–8, and implementation-plan revision 1.2 tasks 1–6. SPECC v1.2
was supplied after the initial PR; it replaces the provisional missing-SPECC
assumptions. D33 adds this independent boundary; existing ledger, manifest,
approval and D26/D27 projection contracts remain unchanged.

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
Outcomes: `supported`, `contradictory`, `not_checkable`, `not_applicable`. Findings omit source text,
stdout, paths, commands, actor names and exception details. Recognized output IDs
are prefixed ULIDs or short letter-plus-number fixture IDs; other source IDs are
omitted, without changing internal evidence correlation.

| Rule | Checked scope |
|---|---|
| TL-AUD-001 | Canonical ledger, chain/HMAC/anchor and recomputed manifest; input gaps separate |
| TL-AUD-002 | Every required referenced blob exists and matches its digest |
| TL-AUD-003 | Independent supplied-key HMAC authentication; hash-only remains a gap |
| TL-AUD-004 | Missing/empty claim coverage or unconfirmed derived criteria |
| TL-AUD-005 | Completion claim contradicts latest decisive failure |
| TL-AUD-006 | Positive test result versus nonzero exit; inconsistent counts/exit |
| TL-AUD-007 | Invalid, negative or noninteger counters (including booleans) |
| TL-AUD-008 | Exact wrapper command/exit header contradicts recorded exit |
| TL-AUD-009 | Unknown report, missing essential fields or optional missing bound XML |
| TL-AUD-010 | Skipped-only/empty execution provides no positive test evidence |
| TL-AUD-011 | Recorded `test_files_changed` is informational, including protected configuration files, not proof of forgery |
| TL-AUD-012 | Reused existing ledger approval-rule checks; no execution = not applicable |

The current wrapper restores protected tests/configuration in its separate witnessed
test copy; an edit notification alone does not establish which inputs were executed
or prove forgery. TL-AUD-011 preserves that distinction and its source event.

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
`run_id`, `ledger_last_hash`, `criteria`, `claims`, sorted `checks`,
`input_digests` and fixed `limitations`
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

The supplied SPECC now provides the report/outcome contract, all twelve rule
meanings, the 18 core acceptance cases, and integration/widget sections 9/10.
Live integration remains unverified for the source/authentication reasons above;
receipt of a spec is not operational evidence. Independent CodexChat security
acceptance is still required.

## Verification scope

Issue #152's deterministic command is
`python -m pytest -q tests/test_audit.py tests/test_audit_inputs.py`.
The new units are included in fast Python PR CI; browser/axe/full release suites
remain in the existing manual release-review workflow. No test files are removed.
Historical `demo-2` is copied and audited without its unavailable original key;
it stays unauthenticated and cannot produce a positive scoped conclusion.

### SPECC v1.2 core acceptance coverage

These are local test mappings, not a claim of live integration acceptance.

| Case | Test in `tests/test_audit.py` unless noted |
|---|---|
| 1 Consistent closed run | `test_signed_and_hash_only_authentication`, `test_specc_v12_report_contract` |
| 2 Hash-only | `test_signed_and_hash_only_authentication`, CLI private-key test |
| 3 Bad key/tamper | `test_bad_key_or_tamper_blocks_content_verdicts` |
| 4 Missing evidence/test blob | `test_all_referenced_blobs_must_exist` |
| 5 Positive count/bad exit | `test_positive_count_and_bad_exit_are_contradictory` |
| 6 Exit 5/skips/no tests | `test_only_skips_or_exit5_never_pass` |
| 7 Original header/later forged exit | `test_report_header_cannot_be_overridden_by_stdout`, multiline-suite test |
| 8 Missing original XML | `test_missing_xml_is_optional_limit`, report contract test |
| 9 Honest failure | `test_honest_failure_is_unmet_not_forgery` |
| 10 False completion | `test_false_completion_points_to_latest_failure` |
| 11 Unconfirmed derived scope | `test_unconfirmed_or_empty_claim_is_not_supported` |
| 12 Later valid pass | `test_later_pass_supersedes_failure_by_seq` |
| 13 Unbound foreign report | Wrong-command case in `test_report_header_cannot_be_overridden_by_stdout`; missing references fail closed |
| 14 Unsafe/oversized/changing inputs | `tests/test_audit_inputs.py`: traversal/symlink/FIFO, limits, rewrite/replacement/root swap |
| 15 Determinism/exit agreement | `test_exit_codes`, `test_conclusion_precedence_and_optional_limits`, deterministic report and CLI tests |
| 16 Empty coverage | `test_empty_coverage_is_not_work_acceptance` |
| 17 No input writes/network/execute | `test_audit_never_writes_executes_or_connects`, historical demo copy digest comparison |
| 18 Inert instructions/HTML | `test_evidence_instructions_and_html_are_inert` |

The plan and SPECC mention a full automatic CI suite. Shu's later binding rule
limits PR CI to build/lint/fast units and puts full suites in release review.
The existing CI triggers are left unchanged; this discrepancy is reported to
Shu. The checks above are scoped local evidence, not a production isolation,
Mausbot, bridge, widget, browser or release acceptance.

A separate local review copied real `demo-2` into an external workspace and
checked the original copy, appended-invalid-JSON copy and missing-report copy.
All returned exit 1 with authentication not checkable; the intact copy's genuine
completion claim contradicts the recorded failure (TL-AUD-005), rather than
being evidence of tampering. Before/after file digests matched for each audited
copy and the repository source. No original key was available or fabricated.
