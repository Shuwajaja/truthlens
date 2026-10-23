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

Shu resolved the older full-CI wording: PR CI remains build/lint/fast units;
full suites belong to manual workflow_dispatch or the explicit release label
before the owner merges. The checks above are scoped local evidence, not a production isolation,
Mausbot, bridge, widget, browser or release acceptance.

A separate local review copied real `demo-2` into an external workspace and
checked the original copy, appended-invalid-JSON copy and missing-report copy.
All returned exit 1 with authentication not checkable; the intact copy's genuine
completion claim contradicts the recorded failure (TL-AUD-005), rather than
being evidence of tampering. Before/after file digests matched for each audited
copy and the repository source. No original key was available or fabricated.

## Server-only admission for integration (D34, owner decision after PR153)

Shu restricts stage two to runs generated directly on the server by our own
pipeline. Uploads, external runs and unsigned runs are rejected, not imported as
lower-trust audit jobs. This admission rule belongs to the bridge/supervisor
boundary; the independently useful read-only CLI keeps its existing ability to
report hash-only inputs as not checkable. A standalone CLI result never creates
a bridge registration.

### Authoritative origin and initiator

The authoritative registration is created by a trusted server-side pipeline
completion path, never a public HTTP endpoint, model response, ACP prompt,
request body, uploaded manifest or client-supplied path. A claimed `origin`,
`pipeline_id`, `initiator` or `signed` field inside run data is not proof.
HMAC validity is necessary but insufficient: an externally signed or uploaded
copy has no eligible local pipeline registration and is rejected.

The protected server registry must bind:

- opaque registration ID and exact ledger run ID;
- configured pipeline identity and its trusted invocation/receipt ID;
- authenticated initiating principal and session, recorded at server dispatch;
- the actor that requested dispatch, if different from that principal;
- server-owned capture location and immutable final snapshot identity;
- externally obtained final ledger anchor and every captured input digest;
- server capture completion receipt, registration time and snapshot-close time;
- installed verifier digest and ruleset version used for the queued audit.

Initiator records are evidence of who initiated the server dispatch, not human
approval. Model claims about a user never establish identity. The registry,
private keys and authoritative reports must be outside worker write access,
with distinct OS permissions or equivalent verified isolation. Running two
processes under the same unrestricted UID is insufficient. Startup must fail
closed when that isolation or caller authentication cannot be established.
No actual ownership/authentication deployment is asserted by this contract.

### Admission order and refusals

1. Authenticate the caller through the actual deployed gateway; ignore identity
   headers unless a verified trusted proxy strips and replaces them.
2. Resolve the opaque run ID in the protected local pipeline registry. Reject
   unknown IDs, upload/external origin, missing trusted initiator binding,
   foreign principal/session or absent authorized session transition. No direct
   paths, commands, URLs, key IDs or anchors are accepted from the caller.
3. Require the registered server capture and immutable final snapshot to match
   the completion receipt, exact run ID, stored input digests and external
   close anchor. A worker-modified registration or changed snapshot is refused.
4. Require the installed verifier to check the server-controlled HMAC key. No
   key, unsigned input or failed authentication means admission refused; do not
   enqueue a job whose failure could later be presented as successful admission.
5. Queue once per registered run/final anchor/ruleset/verifier digest. Automatic
   enqueue is triggered by trusted capture completion, not the agent's "done".
   A user `/audit check` can only retrieve/request that same authorized job.

Collecting events may be visible only for an already server-registered live
capture authorized to the caller. They remain provisional. A collecting run is
not eligible for a final audit until the trusted final receipt and stable
snapshot exist. A missing completion hook stays `audit pending`.

Unknown and foreign run IDs return the same fixed public denial, without host
paths, keys or existence disclosure. Authentication/authorization failures are
not a domain contradiction and never an audit pass. Full denial metadata stays
in the protected supervisor record; public messages disclose only a fixed
reason suitable for that caller. Browser links contain no credentials.

### New launcher and remaining operational boundary

Shu's 23 October decision explicitly authorizes creating the missing trusted
capture path in TruthLens itself. `pipeline.py` reads a fixed root-only profile;
`pipeline_agent.py` supervises the fixed sudo/env-i tl-agent process while the
unchanged wrapper witnesses it. `registry.py` and `pipeline_jobs.py` implement
protected dispatch, immutable snapshot registration and automatic persistent
queueing. `registry_view.py`, the ACP handler and separate compact widget expose
read-only data ports. All files are in one TruthLens PR; vps-system is unchanged.

The root helper quiesces real/effective tl-agent UID processes before privileged
pre-run reads and before the wrapper resumes post-agent reads. Failure to confirm
cleanup aborts only its still-bound launcher parent rather than returning into
unsafe privileged reads. Protected profile versions and launcher PID bind the
private helper; sudoers does not grant callers its `_agent` command. Until the
unchanged wrapper provides a secure per-test lifecycle hook, profiles may contain
at most one witnessed test invocation (which may execute a whole test suite).
A second copy phase is refused before launch. Test descendants are also quiesced
before finalization/another run. No existing wrapper code or frozen schema is
changed to implement these guards. Snapshot files and directory entries are
fsynced bottom-up before the captured registry record is committed.

Host inspection found no installed TruthLens, key, run directory or active
capture pipeline. The supplied ACP wrapper has no principal source. Therefore
host setup is NOT CONNECTED and requires Shu's separate approval. Runtime code
and templates do not establish deployed gateway authentication or Mausbot
session correlation. Current codex is root-equivalent (sudo/docker), so no D34
worker isolation is claimed for existing codex runs; only a separately prepared
and reviewed tl-agent boundary is eligible. Administrative Codex initiating in
Shu's Auftrag remains inside the trusted administrative boundary, never a
separately isolated worker. No profile is enabled and no service/user/key/port is
created by this PR. See [server prerequisites](../../deploy/server/README.md).

PR CI remains build/lint/fast units. Shu explicitly resolved the older full-CI
wording: full suites/browser/axe belong to manual `workflow_dispatch` or a
`release`-label review before the owner merges. Neither stage-one security
review nor fast CI proves stage-two gateway/capture isolation.


### Read projection contract

`registry_view.events(store, run_id, uid, server_session, after_seq, before_seq)`
is a privileged in-process read port, not deployed HTTP authentication. The
future verified gateway may map it to the fixed same-origin event route, after
authorizing the actual principal and server session. Initial cursor0 returns the
last five signed snapshot events; `before_seq` requests at most five older
records. The response includes the separately derived audit summary, seq/hash,
actor kind, recorded timestamp and safe evidence references/counters. Status
never registers or enqueues. No raw output, key or host path is exposed.

The ACP handler defaults to no identity and only emits Not connected. Its
in-process session resolver cannot be configured through model/ACP fields.
No claims of existing native Mausbot plugin/cards are added. `widget.html` uses
that read-route contract, credentials on the same origin and no imports/uploads;
it remains disconnected until the host and genuine gateway exist. Final audit,
transport connection and human approval remain separate. Unit fixtures and
manual browser route simulations are explicitly not deployment evidence.


### PR155 review followup: bounded worker and separate report storage

The tl-agent sudo-policy check accepts only the explicit C-locale no-permission
message, whether sudo returns0 or1; empty, mixed, granting or unknown output is
refused. This covers sudo1.9.16's zero exit for an empty policy without weakening
the privileged-group/subordinate-ID checks.

The worker inspects journal metadata before admission: an existing queued,
running or terminal audit prevents historical snapshot revalidation on a timer
tick. Only new pending captures and pending jobs are processed. The inactive
timer template uses one minute. Interrupted attempts remain recorded and permit
at most one retry; exhausted/failed attempts cannot loop indefinitely. Explicit
`admit` reports the requested audit's real state.

Complete reports (bounded at8MiB) are atomically published to root-only
`/var/lib/truthlens/audits`, with mode0400 and fsynced file/directory metadata.
The32MiB append-only registry records just the relative report path and SHA-256,
not a multi-megabyte report body. Reads bind the path to the audit ID, reject
symlinks/traversal, bound input bytes and check the digest before exposing a
finding. Existing inline completion records remain readable; no journal rewrite,
automatic deletion, host activation or gateway-identity change is introduced.
