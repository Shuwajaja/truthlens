# Server pipeline templates — NOT CONNECTED

Nothing in this directory is installed, enabled or run automatically. The VPS
inspection found no TruthLens installation, key, run directory or active capture
pipeline. Shu must separately approve the host setup before these templates are
adapted. No key material is included and no host changes were performed.

## Required protected installation

- Root-installed, reviewed Python distribution and executable at
  `/opt/truthlens/venv/bin/truthlens`; root-owned ancestry, no group/other writes.
  A checkout owned by codex is refused, even when invoked through sudo.
- `/etc/truthlens/profiles/agent-zero.json`, root-owned mode0600. This example is
  **disabled**, has no allowed callers and intentionally cannot launch. The
  Agent Zero executable/task path is a placeholder requiring verification, not
  an assertion of an installed Agent Zero task interface. Configure only an
  actual nonprivileged local Agent Zero task command. Do not point it at an
  Agent Zero HTTP backend whose tools run as root/docker or outside tl-agent.
- Actual caller mappings supplied by the owner, e.g. each entry has integer
  `uid`, `name` (`Shu`, `VPSMan`, `Codex`; or `systemd` for a service caller) and
  `on_behalf_of: "Shu"`. No UIDs are guessed in the shipped example. Delegation
  is a root-profile policy, not proof that Shu approved each run or its result.
- Root-owned private key `/etc/truthlens/audit.key`, mode0400/0600, regular file,
  single link, outside all runs. Provision privately; never send it to a chat,
  profile, fixture, log or the agent. This PR does not create a key.
- `/var/lib/truthlens` root:root mode0700. Pipeline-created sources, snapshots,
  locks and the canonical append-only metadata registry live below it. Complete
  audit reports live separately under `audits/`, mode0400; registry completion
  entries contain only their relative path and SHA-256 digest. Report files and
  parent directories are fsynced before publication, and every read verifies the
  digest and rejects unsafe paths/symlinks. Snapshot files
  mode0400, directories mode0500; registry mode0600 with lock/fsync/hash chain.
  No upload/import or HTTP registration endpoint exists. Root can still change
  root-owned data: this is isolation from workers, not protection from root.
- A separately reviewed `tl-agent` OS account with no sudo entitlements or
  docker/root-equivalent group memberships or subordinate UID/GID mappings, and `/var/lib/tl-agent` as its
  private working HOME. Workspace parent root-owned/non-writable; workspace
  itself root:tl-agent mode0770. Profile executable and its ancestors must be
  root-owned/non-writable. Agent receives only fixed PATH/LANG/HOME through
  `sudo -n -u tl-agent -- /usr/bin/env -i`; wrapper, key and registry remain root.
- Review the worker unit/timer and sudoers syntax for the installed system.
  The account names and sudoers ERE argument support must be checked before
  installation. Do not retain a general sudo/docker entitlement for tl-agent.

## Attribution and known root-equivalence boundary

Initiator is kernel audit login UID, corroborated against `SUDO_UID` when present;
a supplied/mismatched environment UID is refused. When kernel audit attribution
is unavailable, interactive calls fail closed. A process launched directly by
PID1 with no login UID can be attributed only to uid0/the service, never to a
human inferred from environment variables. Service uid0 must be explicitly
allowed in the protected profile. There is no free `--uid` or `--on-behalf-of`.
Session IDs are generated server-side; ACP session strings do not establish them.
The approved profile records initiator separately from delegated opdrachtgever
`on_behalf_of=Shu`. That is dispatch attribution, not human approval.

**Current codex is root-equivalent** (sudo NOPASSWD + docker). D34 isolation is
not achievable for an untrusted worker running as codex. This launcher refuses
such a worker and requires tl-agent. Codex as an authorized administrative
initiator in Shu's Auftrag is still inside the trusted/root-equivalent boundary;
we cannot protect the registry/key from that administrator, pretend a fresh
process solves this, or claim existing codex runs are isolated. Agent Zero and
all its tool execution must actually stay inside the reviewed tl-agent boundary.
Group/sudo-policy checks do not prove absence of every privilege escalation.

## Dispatch and queue

Only fixed profile commands can start: `truthlens pipeline run --profile agent-zero`.
The unchanged wrapper writes the run and closes its signed ledger. A private
root helper, bound to the protected dispatch and actual parent PID, supervises
the fixed sudo/env-i agent command. It confirms real/effective tl-agent process
quiescence before pre-run reads and before returning into post-agent root reads.
If cleanup cannot be established, it aborts only its still-current launcher
parent; it does not let the root wrapper resume unsafe copying. The helper's
1700s execution budget precedes the wrapper's1800s timeout. Profiles currently
allow at most one witnessed test command because the unchanged wrapper cannot
safely interpose cleanup between multiple test-copy phases. That one invocation
may execute a complete test suite. No `_agent` sudo permission is granted to
initiators or workers. Remaining test descendants are quiesced before the next
run. tl-agent must be dedicated to this pipeline, with no independent login,
cron/service launcher or subordinate UID/GID ranges. The process/account boundary
must be reviewed on the host; code and simulated tests do not prove it exists.

The launcher
copies verified input bytes to a root-owned read-only snapshot, binds the final
anchor and digests to the protected dispatch, registers it, and automatically
queues the installed `truthlens audit --json --hmac-key-file ... --expect-last-hash ...`.
A trusted worker serializes the persistent queue. After launcher loss it may
finish only an already dispatched, closed local capture. Partial snapshots are
never deleted, overwritten or repaired: they remain for operator review. Jobs
interrupted while running retain an interruption record and are retried at most
once; only a real validated retry can produce completed. A second interruption,
300s timeout or invalid output remains a technical failure. Duplicate final identity
(run/anchor/ruleset/verifier digest) returns the existing job.

The inactive timer template runs once per minute. Each tick checks journal
metadata first and admits only captures with no existing audit. Queued jobs are
executed once; completed/failed historical snapshots are not rehashed on every
tick. `admit` returns the selected job's actual status, including completed,
instead of always claiming queued. No deployed timer is changed by this PR.

`truthlens admit RUN_ID [--session SERVER_SESSION]` only checks an existing local
registration; it cannot import/register a path or enqueue an external run.
`truthlens status RUN_ID [--session SERVER_SESSION]` only reads authorized state.
Root-owned profiles define the authorized operator UIDs for their runs. Public
projection omits keys, raw output and host paths. No agent completion text,
heartbeat or editable manifest can make a run eligible.

## Gateway, ACP and widget stay disconnected

`integrations/agent-zero-acp/audit-status.cjs` is a read-only ACP handler using the
existing `session/update`/`agent_message_chunk` wire shape. Its default session
resolver denies every request. Only a verified protected gateway implementation
may provide principal/server-session resolution and a registry read port; no
ACP/chat field can configure it. `/audit check` cannot register or enqueue.
The existing deployed vps-system wrapper is not modified or deployed by this PR.

`registry_view.summary/events` are root-side read projections, not an HTTP server
or authentication implementation. A future verified gateway must authenticate,
map principal/server session, and only then call these read ports. It may expose
`GET /v1/runs/{run_id}/events?after_seq=N[&before_seq=N]`; the response includes
its audit summary and at most five events. Initial cursor0 returns the latest
five; before_seq explicitly requests older records. No public listener, Caddy
change, token URL or guest access is provisioned here. The separate
`viewer/widget.html?run_id=...` polls that same-origin read route; without it the
widget remains Not connected. Deployment must protect the widget and route
through the same real gateway. The wrapper's `authenticate {}`/`authMethods []`
is not such a gateway. Real Mausbot session correlation is still unverified.

## Review before merge/deployment

Fast PR CI is build/lint/affected tests. Follow the standing merge authorization
in `AGENTS.md`: independent security review, current-head green checks and no
blocking findings. A separate Codex subagent can supply that review. Targeted
browser/axe checks cover changed UI; broader release checks run when warranted.
Local privileged tests simulate root checks and do not establish VPS isolation.
Host installation and activation still require separate explicit authorization.


## Phase B reader — clarified D34 (25 October 2026; inactive)

The owner's clarified D34 selects a separate unprivileged `tl-reader` account,
only `127.0.0.1:8765`, and one fixed Shu read view supplied by protected server
configuration. This replaces the earlier D36 root-reader/Unix-forwarding
preparation for the human reader. Legacy Unix classes remain compatibility
code/tests; the module CLI now starts only the unprivileged loopback reader
and refuses UID 0. No live reader, publication, account or policy is installed.

Agent Zero receives **status only**: passed / failed / not checkable. It must
never connect to the human evidence listener or receive events, evidence,
reports, paths or keys. Its later transport is a separate Unix socket exposing
only status, with permissions restricted to the actual Agent-Zero container
UID. Do not use host networking or widen the loopback bind as a shortcut.
The legacy widget/event projection is a human read view, not an Agent Zero API.

### Separate publication, never relaxed registry permissions

`/var/lib/truthlens` and its root-only registry/snapshots remain unchanged.
The reader never instantiates `Registry`, opens that journal, runs
`check_snapshot`, launches an audit, or reads an HMAC key. Instead a separately
authorized trusted publisher/operator must export only already registered,
closed, Shu-authorized snapshots and audit reports into a distinct tree such
as `/srv/truthlens-published`. Phase B provides no publisher or admission route;
its tests construct this layout from synthetic fixtures only. Copying an
external run into a tree never creates pipeline registration.

The publication and config must have root-owned, non-writable ancestry, no
symlinks or hardlinks. Suggested inactive layout: root:tl-readers directories
0550 and files0440, with group-read access only for `tl-reader`. The publisher
must atomically replace and fsync files/directories before publishing the index
last. It must preserve the original dispatch/session/registration, final anchor
and captured SHA-256 digests; it must not derive authorization from untrusted
run content. Publish reports only for that same run and ledger anchor. An
incorrect trusted publication remains a trusted-operator error: hashes do not
prove origin or freshness. Never add `tl-reader` to a root/key/worker group or
make the original private registry group-readable.

Protected `/etc/truthlens/reader.json` uses exactly these fields (example only):

```json
{
  "published_root": "/srv/truthlens-published",
  "viewer_dist": "/opt/truthlens/viewer/dist",
  "view_id": "installation-specific-shu-view",
  "origin": "http://127.0.0.1:8765"
}
```

The publication contains `read-index.json`, with integer `version: 1` and a
`runs` array. Each entry has `view_id`, `run_id`, 32-lowercase-hex `dispatch_id`,
`session_id`, `registration_id`, `snapshot_id` equal to `dispatch_id`,
`ledger_last_hash`, `capture_closed_at`, and `input_digests` mapping relative
captured filenames to lowercase SHA-256. Optional `audit: {"sha256": DIGEST}`
references `audits/DIGEST.json`; absent audit returns null. Snapshot files live
at `snapshots/DISPATCH_ID/{ledger.jsonl,manifest.json,blobs/sha256/aa/DIGEST}`.
Only captured and event-referenced blob digests are readable. Index publication
is configuration, not a new frozen event/manifest/trust format or an HTTP API.
Unknown/foreign runs have the same fixed unavailable response. HTTP headers,
query parameters and browser state cannot select a principal, view or path.

### Read routes and bounds

Only GET/HEAD exist; other methods, foreign Host/Origin, traversal, symlinks,
hardlinks, mismatched digests and oversize inputs fail closed. All responses
carry no-store, nosniff and CSP; no CORS access is granted. The browser must be
served from the reader's exact origin. Routes are:

- `/v1/health`: service availability and fixed view source identity.
- `/v1/runs?offset=0&limit=50`: at most50 registered entries, with next offset.
- `/v1/runs/RUN_ID/document`: bounded RunDoc, always hash-only/verified false.
- `/v1/runs/RUN_ID/events?after_seq=0&limit=100`: at most100 projected events.
- `/v1/runs/RUN_ID/artifacts`: checked manifest artifact metadata.
- `/v1/runs/RUN_ID/blobs`: referenced blob digest metadata, at most100.
- `/v1/runs/RUN_ID/blobs/DIGEST`: captured blob bytes as octet-stream.
- `/v1/runs/RUN_ID/audits`: stored audit report bound to run and ledger anchor,
  or null; never a fresh audit or reader-side authentication claim.

The read index is capped at4MiB/10,000 rows. Document/artifact/blob/audit requests
accept at most2MiB of ledger input; event pages permit64MiB/100,000 events and
128KiB per encoded line. Manifest input is capped at8MiB. Encoded responses are
capped at10MiB, individual blobs at256KiB, stored reports at2MiB. At most two
requests run concurrently with a bounded listen backlog. The verifier still
buffers ledger bytes; peak-memory and overload acceptance on a real host remain
open. These are reader limits; frozen ledger/manifest contracts are unchanged.
Missing content is unavailable, never fabricated or silently promoted to proof.

### Host checklist — documentation only, do not execute during Phase B

After separate owner authorization, an operator must review the installed
system and then prepare a non-login `tl-reader` with no sudo/docker/key access,
the separate read group/publication/config, a root-installed immutable Python
package and fixture-free production Viewer build. Review
`truthlens-reader.service` against that host before installing or starting it.
It has no Install section and enables nothing. The template uses the host
network namespace so SSH can reach loopback; it deliberately cannot substitute
for reviewed worker UID/netns exclusion. No privileged capability is needed.

Before activation, install and witness the OS rule denying `tl-agent`, `codex`
and other workers access to TCP8765 (UID/netns policy), and denying access to
the publication/config. No firewall or namespace commands are applied here.
Verify the actual SSH user and forwarding policy separately. Inactive client
command, only after that authorization and acceptance:

```sh
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:8765:127.0.0.1:8765 SHU_ACCOUNT@HOST
```

Open `http://127.0.0.1:8765` and choose Connect. The existing local source adapter
uses only same-origin fixed read routes, bounded responses and catalog/document
identity checks. Production starts **Not connected**, fetches no fixture, and
keeps its fallback when the service is absent; no automatic live connection is
added. Health means reader availability, not signature verification or approval.

Live acceptance remains blocked pending host authorization: actual separate UID
and key/registry denial, worker-port denial, Agent-Zero socket isolation, SSH
forwarding, a real eligible registered snapshot/report, and peak memory. Local
fixture tests prove the code boundary only. Integrity is not approval.
