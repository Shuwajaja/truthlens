# Host signing service

**Repository preparation only. Nothing is installed, started or enabled.**
[Deutsch](de/signer.md). The Linux service keeps the HMAC key in a dedicated
host account. Agent Zero and Mausbot send reports over a bind-mounted Unix
socket; the daemon writes the ledger and manifest in its own private run root.
Agents receive a run ID and a separate run capability, never the HMAC key or
host filesystem paths. No child process is launched. TCP is not implemented;
unknown config fields, including TCP settings, are rejected.

A valid host audit establishes `authentication=supported` and `integrity=hmac`.
It authenticates the record and the configured caller credential that submitted
it; it does **not** establish the truth of agent claims, execution of tests,
completeness, human identity or human approval. **Integrity is not approval.**
The signer cannot replace the existing witnessed wrapper or protected pipeline.
Because there is no witnessed completion evidence, the audit's overall conclusion
remains `not_checkable` (CLI exit 2) even when the signatures verify. There is no
new literal `VERIFIED` audit verdict.

## Boundary and provenance

The daemon fixes caller, harness, timestamps, sequence, actor and hash chain.
The initial `run.started` and terminal `run.finished` describe service lifecycle;
their task/criteria/summary fields are explicitly `provenance: agent-reported`.
Each supplied event is nested at `agent.note.payload.reported_event`, with
`actor.kind=agent`, the caller ID, harness and `provenance: agent-reported`.
Even submitted `test.reported`, `approval.granted` or `criteria.confirmed` objects
remain nested reports: they never become witness/approval events. Supplied
criteria are stored as reports, not confirmed criteria or acceptance evidence.
Existing schemas and trust rules are unchanged. The manifest contains no
artifacts or accepted criteria derived from those reports.

Socket mode 0660 and directory mode 0750 restrict transport access. On Linux,
`SO_PEERCRED` supplies the connecting process's host-visible UID and **primary**
GID (supplementary groups only control socket access). A configured `uid` and/or
`gid` must match; when `token_file` is also present, **all** configured checks
must pass. Token-only entries support containers sharing a UID. Bearers are
hashed with SHA-256 and compared with `hmac.compare_digest`; duplicate configured
tokens and ambiguous matches are refused. Each caller's allowed harness list
is enforced. Use distinct callers and distinct tokens for each harness. A caller
allowed multiple harnesses can select any of them; its token does not identify
a particular container instance or prove hardware/process identity.

A stolen caller token permits reports as that caller; run operations also need
the daemon-generated run token and the original caller authentication. Status
is scoped the same way. Protect both capabilities and MCP transcripts. Root,
the signer account, writable installation/configuration, ACL-based access,
container root with host privileges, docker-socket access and compromised kernel
are outside the isolation guarantee. Same-UID access is not isolated by chmod.
HMAC is symmetric: anyone with the verifier key can also forge signatures.
Local socket tests do not prove real host/container separation.

## Operator setup (not executed)

Review these templates before any separately authorized host work:

- [systemd unit](../deploy/server/truthlens-signer.service)
- [config](../deploy/server/signer-config.example.json)
- [Compose additions](../deploy/server/signer-compose.example.yml)

1. Install the reviewed Python package in root-owned `/opt/truthlens/venv`.
   Create non-login `tl-signer` with no sudo/docker/agent access, and transport
   group `truthlens-callers`. Use that group as the service's primary group.
   Replace config/Compose GID `12345` with its actual numeric host GID; review
   user-namespace mappings. Allow only intended container clients to connect.
2. Prepare `/etc/truthlens` and its signer/callers subdirectories as
   `tl-signer`, mode 0700. Provision the signing key there using the existing
   `truthlens key init --out /etc/truthlens/hmac.key` **as the signer account**,
   or safely transfer the separately authorized existing key. Key and adjacent
   `.keyring.json` must be owned by `tl-signer`, mode 0600, single-link regular
   files. Never display key material, mount it into containers, put it in an
   environment variable, or grant agents the signer UID.
3. Generate distinct high-entropy printable bearer tokens (32–4096 ASCII bytes,
   no whitespace; at least 32 random bytes before encoding). Do not print them.
   Keep daemon copies in `/etc/truthlens/signer/callers/{agent-zero,mausbot}.token`,
   owned by `tl-signer`, mode 0600. Install separate private client copies in
   `/srv/truthlens-client-tokens/{agent-zero,mausbot}.token`; each must be readable
   as mode 0600 by the mapped container MCP UID, never the other harness. Protect
   their host parent directory. These are bearer tokens, **not HMAC keys**.
4. Install reviewed config as `/etc/truthlens/signer/config.json`, mode 0600,
   owner `tl-signer`. Absolute paths only, version 1, no unknown fields. Every
   caller needs harnesses, at least one auth check and all four positive limits.
   Config and token files are bounded, regular, single-link, owner-only and
   opened without following symlinks. Their ancestors and key/run/socket
   ancestry must be root/signer owned and not group/other writable; root-owned
   sticky temporary ancestors are allowed for tests. Check ACLs separately.
5. Create `/srv/agent-runs/truthlens` as `tl-signer`, mode 0700; root owns the
   protected ancestors. The service creates only the final root/socket directory
   when missing; it never fixes unsafe existing permissions. systemd supplies
   `/run/truthlens-signer` as `tl-signer:truthlens-callers`, mode 0750. Existing
   socket paths are refused; inspect an inactive service before operator cleanup.
6. After reviewing sandbox paths, install the unit into
   `/etc/systemd/system/truthlens-signer.service`, reload systemd and start it
   only under separate host authorization. The example has no Install section
   and no automatic restart. It limits address families, capabilities, core
   dumps and writable paths. Review logging/retention and resource budgets.
7. Merge the Compose additions into **both** actual Agent Zero and Mausbot
   services. Bind the socket directory and only each client's token copy read-only;
   add the correct transport group. Do not mount runs/config/key or docker.sock.
   Do not run agents as root with host privileges. Validate both positive access
   and cross-caller/key/run-root denial using actual mapped UIDs. A read-only
   mount still permits socket connections. Recreate containers after systemd
   removes/recreates the runtime directory; old bind mounts retain old inodes.
8. Configure each MCP launcher to invoke `truthlens mcp --signer-socket
   /run/truthlens-signer/signer.sock` with
   `TRUTHLENS_SIGNER_TOKEN_FILE=/run/secrets/truthlens-signer.token`. Alternatively
   set `TRUTHLENS_SIGNER_SOCKET`; the CLI socket flag takes precedence. Ensure
   the launcher forwards these variables. No key flag/environment secret is
   needed or loaded in signer mode. Keep the HMAC key on the host.

Example MCP entry inside **each** container (the mounted token differs):

```json
{"mcpServers":{"truthlens":{"command":"truthlens","args":["mcp","--signer-socket","/run/truthlens-signer/signer.sock"],"env":{"TRUTHLENS_SIGNER_TOKEN_FILE":"/run/secrets/truthlens-signer.token"}}}}
```

With the signer configured, tools `start_signed_run`, `append_signed_event`,
`finish_signed_run`, `signed_run_status` appear alongside the existing catalog
or legacy tools. Without signer config, existing MCP behavior is unchanged.
`TRUTHLENS_ROOT` selects the optional container-readable catalog; `--root` selects
its legacy API. Signer mode does not load any HMAC file/environment key, so reads
of signed records remain hash-only until separately verified on the host. With
no catalog root, read tools return an error. The signer root is never mounted.

Run the host audit under the account authorized to read the key:

```sh
truthlens audit /srv/agent-runs/truthlens/RUN_ID --hmac-key-file /etc/truthlens/hmac.key --json
```

Check the authentication/integrity fields, separately from the overall conclusion.
No service account, Docker, MCP client, systemd or live isolation was qualified
by the repository's temporary-fixture tests.

## Wire protocol and limits

One UTF-8 JSON object plus LF per connection; one response then close. Maximum
request **65536 bytes including LF**; 2-second socket timeout, serial writer,
listen backlog 16. Duplicate object keys, floats, NaN, normalization collisions,
non-object requests and unexpected top-level fields fail closed. Responses are
small JSON `{ok:true,result:{...}}` or `{ok:false,error:"fixed_code"}`.
No exception text, bodies, keys or tokens enter the audit log. Audit records
contain only configured caller ID, operation and fixed outcome. Auth failures
use caller `unknown`. The journal supplies audit timestamps; secure its access
and retention. Logs authenticate service observations of requests, not claims.

All operations include `caller_token` when required by the caller config:

| `op` | Request fields | Result |
|---|---|---|
| `start_signed_run` | `harness` string, `task` string, optional `criteria` array | `run_id`, `token` |
| `append_event` | `run_id`, `token`, `event` object | `run_id`, `seq` |
| `finish_signed_run` | `run_id`, `token`, `summary` string | `run_id`, `state:finished` |
| `status` | `run_id`, `token` | `run_id`, `state:open/finished/failed`, `reported_events` |

The MCP names map to these operations. Returned `token` is the **run** token,
not the caller bearer. No caller credential argument exists in MCP; the client
loads its private token file and never returns it. Client socket timeout is
5 seconds and responses are bounded to the same 64 KiB.

Limits apply per caller: rolling `runs_per_hour`, `events_per_run` (append calls),
`bytes_per_run` (accepted start/append/finish wire bytes, including credentials),
and rolling `bytes_per_hour` (every authenticated operation, even rejected ones).
At most 20,000 authenticated requests/caller/hour and 32 open or failed runs
are kept globally; at most 1024 run capabilities remain in memory, evicting old
finished capabilities. Quotas count wire bytes, not disk usage. Nested
provenance/envelope overhead still must fit the ledger's 64 KiB payload bound.
Operators must monitor storage, apply retention and limit socket access. This
small serial server is not an availability/DoS boundary against hostile clients
with socket access; slow peers can delay others for the timeout.

State, run tokens and quotas are memory-only. Restart invalidates all run tokens
and resets quotas. Completed ledgers remain verifiable on disk, but their status
is not restored; interrupted runs stay unfinished. No automatic recovery or
cleanup occurs. A ledger/manifest write failure closes that run against further
writes. A crash can leave a finished ledger without a complete manifest; audit
must fail closed. A lost response has no retry/idempotency guarantee: check status
with the existing token; a lost start response can leave an orphan run. Start
only one daemon per run root (exclusive directory lock). All appends fsync;
manifest and checksum publication use fsync plus atomic replacement.

## Rotation and backups

The daemon loads the key and caller token hashes **once at startup**. Stop intake,
finish open runs, stop the service, rotate under the signer account with
`truthlens key rotate --key-file /etc/truthlens/hmac.key`, then restart. Never
rotate a running daemon and assume it switched keys. Managed keys retain IDs,
not old secrets; retired-key runs audited with only the replacement key are
`not_checkable`/hash-only with a retirement reason. Authenticating old runs needs
an independently protected old-key backup under the existing policy. Legacy
files work with key ID `signer-v1`; managed keys are preferred for rotation.
Rotate caller tokens by replacing both protected daemon and private client
copies, then restarting the daemon and clients; old run capabilities are lost.

Back up the HMAC key **and** `.keyring.json` as secrets, daemon config/tokens,
client token copies and their ownership map, unit/Compose/MCP configuration,
complete run directories (ledger, manifest, checksum) and request journal.
Keep secret backups off agent-accessible storage; never include them in a run
artifact. Do not back up the transient socket as usable service state. Review
restoration permissions and old-key handling separately.
