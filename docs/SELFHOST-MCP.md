# Status-only MCP (Phase G1, local code qualification)

An agent may query an existing authorized run through `truthlens mcp-status
--socket OPERATOR_SOCKET`. Install the optional, pinned `mcp` extra in a reviewed
installation first. This command serves stdio; it does not start a network
listener or a broker. It exposes exactly `truthlens_check_status` with input
`{"run_id":"opaque-registered-run"}` and one text content block containing only
`{"status":"passed"}`, `{"status":"failed"}` or `{"status":"not_checkable"}`.
There are no resources, prompts, run listings or mutation tools. Socket paths
come only from process configuration, never tool arguments. The shim has no
registry, audit, key, snapshot, viewer or human reader imports/access path.

`passed` means the stored audit supports its scoped claim. `failed` means an
authenticated closed audit contradicts a claim; it does not mean an arbitrary
command exited unsuccessfully. Everything unavailable, unauthorized, incomplete
or inconsistent is `not_checkable`. **Integrity is not approval.** None of these
results authorizes deployment, merging, acceptance or a human approval event.

## Protected source and architecture

```text
agent UID -> unprivileged stdio MCP -> fixed Unix socket
  -> root broker: SO_PEERCRED allowlist -> per-run Registry.run authorization
  -> stored completed audit + protected registration/snapshot digest binding
  -> existing Phase F project_status -> {status} only

human SSH/viewer -> separate Phase B loopback reader (never an agent upstream)
```

The existing registry remains root-only. The operator process entrypoint is
`python -m truthlens.status_broker --socket OPERATOR_SOCKET --socket-gid
EXISTING_AGENT_GROUP_ID --allow-uid AUTHORIZED_AGENT_UID` (repeat `--allow-uid`
for distinct allowed UIDs, at most 64). This is an interface description, not
host setup instructions or authorization to start it. No service, account,
group, firewall, SSH rule, publication or key is installed by this feature.

The broker requires root real/effective identity through the existing registry
policy, Linux `SO_PEERCRED`, nonroot numeric allowlisted peers, root-owned
non-writable socket ancestry without symlinks, and a root-owned `0660` socket
with an explicitly selected existing nonroot group. It never overwrites an
existing pathname, including a stale socket. Shutdown removes only its own
socket inode. The client checks the protected socket ancestry/type/owner and
kernel server UID as well; a replacement unprivileged broker cannot supply green.
Group membership permits connecting, but never bypasses the peer allowlist or
registry authorization. Per-run rights come from protected dispatch
`authorized_uids`; there is no blanket all-runs grant. Session identifiers from
tool arguments are rejected. Remote users sharing a UID cannot be distinguished.

The broker reads through existing `Registry.run`, `records`, `read_report`, `pipeline_jobs.status` and
`SafeRunReader`; it does not use `read_service.py`, the publication tree or a
second database. Before using Phase F's sole verdict projection it requires:

- Server-pipeline origin, closed capture receipt and fixed snapshot registration.
- Latest job completed with an existing digest-bound stored report. Legacy inline
  reports remain readable to existing users but are not promoted into this API.
- Stored authentication `supported`, integrity `hmac`, and a strictly true
  verification context. Native audit reports have no `verified` field: the
  existing trusted `pipeline_jobs.status()` supplies the explicit `verified is True`
  and completed-state context. A missing/non-true context flag or an explicit
  non-true report flag is rejected.
- Exact run ID, final anchor, full captured input digest map, verifier digest map
  and ruleset binding. Noncompleted report states are rejected.
- Read-only captured snapshot/files, safe bounded no-follow reads, matching bytes,
  and an unchanged journal across the query. The final journal comparison and
  Phase F projection share the existing registry lock; this is an atomic
  observation, not a promise that state cannot change after the response.
  Malicious root mutation of immutable snapshots remains outside the boundary.

The trusted worker already checked HMAC before storing the completed report.
Queries do not read the HMAC key, recompute an audit, admit, register, approve,
run or repair. Digest freshness checks reuse the existing safe reader; they do
not establish independent HMAC authenticity. A dishonest privileged producer
can still forge the store; protecting that producer and installation is essential.
The root process has broad OS privileges because that is the existing registry
contract. Its API is read-only; least-privilege host confinement remains an
operator requirement, not a claim that Python removes root privileges.

## Transport and compatibility

Private wire v1: four-byte big-endian length followed by UTF-8 JSON. Request
exactly `{"version":1,"run_id":"..."}` (max 2048 bytes), response exactly
`{status}` (max 256 bytes). Duplicate keys, floats, invalid UTF-8, unknown fields
and invalid IDs are refused. There is one request per connection, a two-second
total wire deadline, two fixed workers and an eight-connection listen backlog.
Busy connections close; the client returns `not_checkable`. Per-UID queries are
limited to four/second with burst eight; no result is cached. Snapshot reads
retain existing finite input budgets; a slow trusted filesystem can occupy a
worker beyond the wire deadline, while the client still fails closed.

The optional official Python MCP SDK is pinned to **2.3.0**. Its engine handles
legacy `2025-06-18` initialization and modern `2026-07-28` stateless envelopes.
A separate transport bounds stdio lines to 64 KiB, rejects duplicate keys and
invalid UTF-8 before SDK dispatch, allows one outstanding request, strips SDK
error data and tool-result metadata, and emits only protocol JSON to stdout.
Oversize stdio input gets a fixed parse error and ends the session without
unbounded draining. Invalid tool inputs and unauthorized operations produce
`not_checkable` without consulting the source; unsupported protocol methods
receive fixed errors. No raw exceptions are printed on either stream.

Compatibility limits: tests use synthetic JSON-RPC subprocess clients against
the installed SDK, not installed Claude/Codex/Cursor/Agent Zero clients.
Request correlation IDs are protocol envelope fields; run IDs never appear in
tool results. IDs are bounded integers or short ASCII opaque strings. D34's
explicit prohibition of `_meta` takes precedence over the SDK's automatic
modern server-info stamping: it is stripped from results, so full modern client
conformance is **not** claimed. Consult the [official SDK migration notes](https://py.sdk.modelcontextprotocol.io/whats-new/)
for the protocol transition. Actual client-version qualification is open.

## Threat model and deferred acceptance

Prompt injection in evidence has no route into an agent response. Unknown IDs,
foreign UIDs/runs, imported or unsigned data, stale anchors/digests, open jobs,
malformed input, capacity exhaustion, broken broker and source exceptions share
the same closed status vocabulary. No tracing, free-text diagnostics or report
metadata is sent to the shim. A model can still invent a natural-language
answer or skip the tool. Trusted CI or human decisions must query the protected
source directly rather than trusting an agent's retelling.

A same-UID/root/sudo/docker-equivalent agent, writable installation, exposed
private registry/key, writable socket parent, or reachable human reader defeats
the intended deployment boundary. Unit privilege overrides and temporary Unix
roundtrips prove code behavior only. Real separate-UID/ACL/key isolation,
network denial to the human reader, process confinement and SSH forced-command
checks require a separately authorized host and remain **not run**. No secure
same-user quickstart or active deployment is claimed.

G2 adds `agent-status`, read-only `doctor`, explicit client snippets and a
synthetic fake-broker demo; see the [agent setup guide](AGENT-SETUP.md).
The broker/wire/client/adapter security boundary is unchanged. These helpers do
not provision or certify a host, and actual client versions remain unqualified.
Remote HTTP/OAuth, platform-specific macOS/Windows isolation and publishing
remain out of scope. Rollback removes the new entrypoint/broker use; no data
migration, cache or frozen-contract change is required.

The legacy `truthlens mcp --root` still exposes reports/events and is **not
D34-compatible**. Keep it confined to trusted human evidence workflows. It is
unchanged and never used as a fallback. The existing ACP handler and viewer are
also unchanged; G1 does not activate either integration.
