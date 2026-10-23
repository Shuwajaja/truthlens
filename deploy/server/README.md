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


## Private reader preparation (D36; not installed)

The owner selected a fixed Shu read view over a protected Unix socket and SSH.
`truthlens-reader.service` is an **inactive example**, not a verified host unit.
The implementation is started explicitly with `python -m truthlens.read_service
--config /etc/truthlens/reader.json` only after separate host authorization and
an operator's review. Do not run it from an agent checkout or relax registry
permissions. The root-only registry remains private. The reader service needs
read-only access to its registry/snapshots and the immutable production Viewer
build; the example hides the existing audit key and makes the filesystem
read-only except for the socket directory. Any additional local key paths must
also be hidden when preparing the actual service profile.

The protected JSON configuration binds `view_id`, `forwarder_uid`, `state_root`,
`socket_path`, `viewer_dist` and `origin`. There is no request-supplied principal,
path, upstream URL or registration action. `forwarder_uid` is the numeric UID
of the dedicated authorized SSH account, not a worker account. It also selects
that UID's existing registry authorizations. The service confirms Linux Unix
peer credentials before reading HTTP; root is not an automatic peer exception.
A root-equivalent administrator can still change the configuration or impersonate
a UID and is outside this boundary.

The configured browser origin is a fixed loopback HTTP origin, for example
`http://127.0.0.1:8765`. The intended client command, **after** approved setup,
is `ssh -N -o ExitOnForwardFailure=yes -L
127.0.0.1:8765:/run/truthlens-reader/reader.sock SSH_ACCOUNT@HOST` (join the
line break into one command). Open the exact configured origin and choose
Connect. The server has no TCP listener. Host/Origin/Fetch-Metadata checks
complement SSH and socket permissions; they do not authenticate a human.

The service fails on an existing socket rather than unlinking an unknown
endpoint. An operator must investigate stale state before a later restart.
Runtime directory ownership/mode, socket ownership/mode, SSH forwarding policy,
service sandboxing and account separation must be reviewed on the actual host.
No commands here create accounts, change keys, install units or enable services.

Live acceptance is still outstanding: run the actual permitted SSH path,
observe denial from the worker UID, read a real eligible registered private
snapshot, verify private filesystem contents/permissions remain unchanged, and
measure peak memory with a large permitted journal. Local temporary sockets,
synthetic registries and mocked browser responses do not establish any of those
facts. No real private run or deployment result is asserted here.


### Implemented preparation scope and bounds

The current reader provides health, a catalog (at most 50 entries per page),
RunDoc projections and event pages (at most 100 events). The planned artifact,
blob, audit-report and export endpoints are not implemented by this slice.
Documents omit blob bodies; a missing preview is not evidence of a missing
original artifact. RunDoc projections remain `verified: false`,
`integrity: hash-only`, even when the protected registration originated from a
signed admission. This is not a fresh HMAC verification.

The journal reader deliberately accepts at most 4MiB/10,000 rows (2MiB per row),
below the core journal limit. Documents accept at most 2MiB of ledger input and
10MiB of encoded response. Event pages retain the core 64MiB/100,000-event ledger
limit, with a 128KiB encoded line bound; they do not retain all decoded events.
The frozen verifier still buffers/splits the ledger bytes. These are fail-closed
reader limits, not changed domain contracts or a measured memory guarantee.
At most two requests are processed concurrently, using a fixed worker pool and
a bounded pending connection backlog. The 256MiB unit memory cap is a hard
operational ceiling, not a demonstrated availability guarantee for two maximum
size inputs; peak-memory acceptance is still required. Large or concurrently changed inputs are
unavailable, never silently truncated into a complete document.

Choose an installation-unique stable `view_id`, not a reused generic name across
hosts. Source IDs combine that configured view/UID with the original dispatch,
session, registration and captured ledger anchor. Paths and SSH usernames never
come from browser requests. The socket parent must be root-owned mode0711;
the socket is mode0600 owned by the configured nonroot forwarder UID. Protected
config and registry files retain their existing root-only requirements.
