# Architecture

TruthLens records what an agent did, checks the recorded evidence, and lets a
human compare claims with witnessed results. The Python core uses the standard
library; the viewer uses React, TypeScript and Vite. The optional status MCP
adapter uses the pinned SDK extra. Start with the
[offline walkthrough](../README.md#try-it-in-1-minute) for a runnable example;
[STATUS](STATUS.md) records measured checks and remaining limits.

## Capture and evidence

```text
agent command -> wrapper -> ledger.jsonl (hash chain, optional HMAC)
                    |          |
                    |          +-> manifest.json (criteria, claims, artifact references)
                    +-> blobs/sha256/ (redacted content, addressed by hash)

verified run -> report / export / SQLite projection -> human evidence review
completed run -> read-only audit -> checks, conclusion and provenance
```

1. `truthlens run` records the start, criteria and before snapshot, then starts
   the agent with a filtered environment. The HMAC key is withheld from that
   child environment; OS isolation is still needed to prevent file access.
2. Gated actions are requested by the agent. A human approves the exact action
   hash; the gate executes once from the approved snapshot. Agent decisions do
   not become human approval or criterion-confirmation events.
3. Capture stores redacted artifacts, witnessed tests, agent claims and the run
   finish. The manifest derives criteria and claim support from those events.
4. Evidence consumers verify the ledger and check manifest consistency before
   deriving reports, exports or projections. A keyless hash-chain check is
   **hash-only**, not signature verification. The audit additionally checks
   bounded captured inputs and produces its own checks and provenance; the
   viewer's criterion summary is not that audit verdict.

| Source | Responsibility |
|---|---|
| [wrapper.py](../src/truthlens/wrapper.py), [gate.py](../src/truthlens/gate.py) | Capture, filtered environment, restored-test witnessing and approval-bound execution. |
| [ledger.py](../src/truthlens/ledger.py), [canonical.py](../src/truthlens/canonical.py), [redaction.py](../src/truthlens/redaction.py) | Canonical events, chain by `seq`, optional HMAC, fail-closed verification and redaction before hashing. |
| [store.py](../src/truthlens/store.py), [manifest.py](../src/truthlens/manifest.py) | Content-addressed blobs and recomputed criteria/claim support. |
| [projection.py](../src/truthlens/projection.py), [export.py](../src/truthlens/export.py) | Rebuildable SQLite and viewer JSON with integrity metadata. |
| [audit.py](../src/truthlens/audit.py), [audit_inputs.py](../src/truthlens/audit_inputs.py) | Read-only audit of completed captures using bounded, safe input reads. |

The [event schema](spec/event-schema-v1.md),
[manifest contract](spec/artifact-manifest-v1.md) and
[trust levels](TRUST-LEVELS.md) define the frozen contracts.
Witnessed test success means the restored test command reported success;
code in the tested process can still forge its own result.

## Protected pipeline and separate readers (Phases B–G2)

The server pipeline uses operator-controlled profiles, protected registration,
captured snapshots and stored audit jobs. Its caller and status-reader roles
are distinct. Adding a status reader grants no run, admit or approval rights.

```text
operator profile -> protected pipeline -> registered snapshot -> stored audit
                                                                  |
human -> separate fixed-view reader -> published evidence           |
                                                                  v
agent -> agent-status / mcp-status -> fixed Unix socket -> protected broker
       <- {status} only           <-                    <- authorized projection
```

The human reader and agent broker are separate access paths. The broker checks
kernel peer identity, per-run authorization and stored report/digest bindings;
it uses the existing Phase F status projection. Its agent result is exactly
`{"status":"passed"}`, `{"status":"failed"}` or
`{"status":"not_checkable"}`. Run IDs are request inputs, never result fields.
Events, evidence, paths, IDs, counts, free text and keys never enter that result.
Unavailable or inconsistent evidence fails closed to `not_checkable`.

| Source | Responsibility |
|---|---|
| [registry.py](../src/truthlens/registry.py), [pipeline.py](../src/truthlens/pipeline.py), [pipeline_jobs.py](../src/truthlens/pipeline_jobs.py) | Protected registration, capture orchestration and stored audit jobs. |
| [read_projection.py](../src/truthlens/read_projection.py), [read_service.py](../src/truthlens/read_service.py), [viewer/](../viewer/) | Separate human evidence publication and fixed-view reader; local-folder/export viewing is also supported. |
| [status_projection.py](../src/truthlens/status_projection.py) | Phase F projection from authenticated audit context to the fixed status vocabulary. |
| [status_broker.py](../src/truthlens/status_broker.py), [status_wire.py](../src/truthlens/status_wire.py), [status_client.py](../src/truthlens/status_client.py) | G1 protected status source, bounded Unix transport and unprivileged client. |
| [mcp_status.py](../src/truthlens/mcp_status.py), [agent_status.py](../src/truthlens/agent_status.py), [agent_setup.py](../src/truthlens/agent_setup.py) | Status-only MCP/CLI and G2 human diagnostics/client configuration helpers. |

The legacy [mcp.py](../src/truthlens/mcp.py) (`truthlens mcp --root`) exposes
reports and events for trusted human evidence workflows. It is **not
D34-compatible**, must not be connected to agents, and is never a fallback for
`mcp-status`. See [SELFHOST-MCP](SELFHOST-MCP.md) for G1's threat model and
[AGENT-SETUP](AGENT-SETUP.md) for G2 interfaces and synthetic-demo limits.

Human text may also show `TRUE`, `FALSE`, or `UNKNOWN`.
[display_labels.py](../src/truthlens/display_labels.py) maps those words for
the report and for `truthlens audit status` text. JSON, the ledger, and the
agent tool stay on the stored and D34 vocabularies. Hash-only report text uses
`UNKNOWN`. A green unit test or `demo-status` is not a production `passed`.

## Inspect the CLI offline

From the repository root, with Python 3.12+ and TruthLens installed as described
in the [reviewer guide](REVIEWER-GUIDE.md), these commands only print help. They
do not start a broker, connect a client, read a key or configure the host.

```bash
python3 -m truthlens --help
python3 -m truthlens audit --help
python3 -m truthlens mcp-status --help
```

[The documentation check](../tests/test_architecture_docs.py) executes these
examples from the checkout using the test interpreter. It also checks this
guide's inline local links against tracked files or directories containing
tracked files, and checks heading fragments against the target document.
External links are not fetched. Help output proves CLI availability, not a
working service or qualified MCP client.
The agent-facing `agent-status` deliberately has no help output: malformed
arguments return `not_checkable` with exit code 2. Its usage belongs in the
human-facing [agent setup guide](AGENT-SETUP.md).

## Reference workspace and run views

Human commands `truthlens workspace` and `truthlens runs` project an existing
ledger into a run view. They do not replace `truthlens init LEDGER`, the
read-only `truthlens doctor`, or the legacy human tool `truthlens mcp --root`.
`truthlens workspace doctor` and `truthlens runs list` run without a feature
flag. `TRUTHLENS_REFERENCE` defaults to off for the other new commands. Only
the exact value `1` enables workspace init, unlink, test and repair, and
runs show, recheck and import. Unset, empty, `0` and every other value exit
2 for those commands and leave ledgers in place. The projection is not a
second ledger, audit, or D34 status. Human TRUE and FALSE require integrity
`hmac`; hash-only text stays UNKNOWN.

| Source | Responsibility |
|---|---|
| [run_view.py](../src/truthlens/run_view.py) | Fail-closed review summary, claim and timeline projection. |
| [workspace_store.py](../src/truthlens/workspace_store.py), [workspace_cmd.py](../src/truthlens/workspace_cmd.py) | Project file, init, unlink, read-only doctor, local synthetic test, repair. |
| [runs_cmd.py](../src/truthlens/runs_cmd.py), [run_catalog.py](../src/truthlens/run_catalog.py) | List, show, recheck and quarantined import. |
| [capture_lifecycle.py](../src/truthlens/capture_lifecycle.py) | Does not open a ledger and does not read qualification from workspace.toml. |
| [human_io.py](../src/truthlens/human_io.py) | `--json`, `--quiet` and `--no-color` for the new commands. |
| [schemas/](../schemas/) | Draft run-view, workspace-config and diagnostic-report schemas. |
| [view-projections-v1.md](spec/view-projections-v1.md) | Projection rules. Event-schema decisions stay in the frozen spec. |
| [viewer/src/reference/](../viewer/src/reference/) | Reference routes `/runs`, `/reports`, `/agents`, `/sources`, `/settings`, `/doctor`. |

The viewer route `/` remains the evidence workspace. Reference routes are an
additional surface. A labelled demo catalog is served only with `?demo=1`.
Capture qualification for a live Agent Zero, Codex, Claude Code or agy
harness is not claimed here.

## Trust and deployment limits

**Integrity is not approval.** Only a verified HMAC context supports a signature
verification claim. A same-UID, root or equivalent agent can defeat key and
reader isolation; filtering the child environment alone cannot prevent this.
The human evidence reader must remain unreachable to agents.

The repository contains pipeline/reader/broker code and
[inactive operator templates](../deploy/server/README.md), not proof of an
isolated deployment. Separate-UID/ACL/key isolation, real client qualification
and live service setup require their own evidence and authorization. Consult
[STATUS](STATUS.md) for what was actually run; code or synthetic tests do not
certify a host.
