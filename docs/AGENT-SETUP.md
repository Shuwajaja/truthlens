# Connect your agent to TruthLens status

TruthLens is self-hosted. Claude Code, Codex, Cursor and Agent Zero can use the
same local stdio adapter, `truthlens mcp-status`. It exposes exactly one tool:
`truthlens_check_status({"run_id":"AUTHORIZED_RUN_ID"})`. The result contains
only `status`: `passed`, `failed`, or `not_checkable`. No event, evidence, path,
identifier, URL, count, free text or key is returned. Integrity is not approval.

These are configuration templates, statically checked as JSON/TOML, **not
qualification of installed client versions**. The SDK has synthetic stdio tests;
actual client versions and Agent Zero's build-specific configuration remain
unqualified. [Architecture, protocol limits and trust boundary](SELFHOST-MCP.md).
The old `truthlens mcp --root` is a human evidence API and is not an agent fallback.
Human report text may show `TRUE` / `FALSE` / `UNKNOWN`. Those words are not
the tool result. `passed` still requires a qualified separate-UID broker; this
demo and a green unit test do not provide that.

## Try the one-minute synthetic demo

From a reviewed checkout, in your own virtual environment (Python 3.12+):

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -e '.[mcp]'
truthlens demo-status
```

No published PyPI release is assumed. Existing `truthlens` packaging/entrypoint
and pinned optional MCP SDK are reused; there are no new dependencies. A local
wheel can also be installed by pipx or `uv tool install` after operator review;
those installers were not exercised for this change.

Expected **simulated** transcript:

```text
DEMO ONLY: synthetic fake broker; no audit or approval.
Simulated: passed
Simulated: failed
Simulated: not_checkable
Real client: not_checkable
```

The demo creates a temporary directory (`0700`) in the current working directory
and a private Unix socket (`0600`) inside it, uses a private synthetic client for
three fixed fake replies, and removes the temporary directory afterward. A short
relative socket address avoids Unix pathname limits even in a deeply nested
checkout or with a long `TMPDIR`. The working directory must be writable;
creation or socket failures produce only `Demo unavailable.` and exit 2.
It then queries the unchanged real status client, which must return
`not_checkable` (relative socket paths are refused). The production socket path
and its checks are unchanged. No registry, audit, key, service, root privilege,
TCP listener or model client is needed. Fake green is never production proof.
There is no adapter option or environment switch enabling the demo client. This is Linux
code qualification, not macOS/Windows isolation support. Demo exit codes are 0
for the completed synthetic demonstration and 2 for a fixed unavailable message.

## Before connecting real agents

The owner must already have a separately reviewed, protected Linux G1 broker,
protected installation, separate unprivileged agent UID, per-run authorization,
private keys/registry and worker denial to the human reader. The operator supplies
the fixed socket path and an existing authorized, registered run ID. Neither a
config snippet nor doctor creates these prerequisites. No setup/apply command
or host provisioning is provided here.

Human-only diagnostic:

```sh
truthlens doctor --socket /run/truthlens/status.sock --client claude-code
```

Doctor only checks socket ancestry/type/root ownership/exact `0660` mode,
adapter importability, installed SDK module availability and snippet syntax/content.
It never connects to a socket, enumerates runs, reads a key/registry, invokes sudo,
checks docker, starts a service, changes permissions or edits client configs.
It always exits **2**, because local metadata cannot prove deployed isolation.
It prints one fixed code per check:

| Check | Fixed messages |
|---|---|
| Socket metadata | `SOCKET_METADATA_OK` or `SOCKET_UNSAFE_OR_MISSING` |
| Adapter import | `ADAPTER_IMPORTABLE` or `ADAPTER_UNAVAILABLE` |
| SDK module availability | `MCP_SDK_PRESENT` or `MCP_SDK_MISSING` |
| Standalone snippet | `CLIENT_CONFIG_VALID` or `CLIENT_CONFIG_INVALID` |
| Trust boundary | Always `ISOLATION_UNVERIFIED` |

`MCP_SDK_PRESENT` checks module availability, not version compatibility or a client
handshake. `SOCKET_METADATA_OK` proves neither reachability nor authorization.
Without `--config`, doctor validates the snippet it would generate; it does not
search any client directory. To check a saved standalone snippet, pass its file
explicitly (max 16 KiB, regular file, no symlink/hardlink). Filesystem reads may
update access times; doctor makes no content, mode or modification-time changes.
For example, after explicitly generating a new file:

```sh
truthlens agent-config codex --socket /run/truthlens/status.sock --output ./truthlens-snippet.toml
truthlens doctor --socket /run/truthlens/status.sock --client codex --config ./truthlens-snippet.toml
```

The validator requires the exact standalone template, not an entire existing
client config. It rejects duplicate/extra keys and other commands. Malformed
arguments/errors use a fixed human message, never file contents, supplied values
or exception details. Doctor and config help are human-facing; never route their
output into an agent status result.

## Copy-paste client configuration

`truthlens agent-config CLIENT --socket PATH` prints a standalone snippet.
Allowed clients: `claude-code`, `codex`, `cursor`, `agent-zero`. Arguments are
encoded as JSON/TOML data; no shell command is built. Socket paths must be
absolute, at most 100 encoded bytes, with no traversal or control characters;
this validates syntax only, not trusted ownership. Paths appear only because
operators explicitly supplied them. Do not put secrets in socket names.

`--output NEW_PATH` creates only that explicit new file with mode `0600`, flushes
and fsyncs it. Existing files, symlinks and missing parent directories are refused.
There is no automatic merge, overwrite, directory creation or client-config edit.
Review and copy the snippet into your own client's settings yourself; client UI,
transport capabilities and executable PATH depend on the installed version.

### Claude Code

```sh
truthlens agent-config claude-code --socket /run/truthlens/status.sock
```

Copy the returned `mcpServers.truthlens` entry into the MCP configuration accepted
by your Claude Code version:

```json
{
  "mcpServers": {
    "truthlens": {
      "command": "truthlens",
      "args": ["mcp-status", "--socket", "/run/truthlens/status.sock"]
    }
  }
}
```

### Codex

```sh
truthlens agent-config codex --socket /run/truthlens/status.sock
```

Copy into your Codex MCP TOML configuration, after reviewing existing entries:

```toml
[mcp_servers.truthlens]
command = "truthlens"
args = ["mcp-status", "--socket", "/run/truthlens/status.sock"]
```

### Cursor

```sh
truthlens agent-config cursor --socket /run/truthlens/status.sock
```

Use the same `mcpServers` JSON shown for Claude Code, in Cursor's MCP settings
(for example the project's `.cursor/mcp.json`). Do not replace other server entries.
The generator never reads or edits this file automatically.

### Agent Zero

An operator registers Agent Zero's actual nonroot UID under the protected
profile's optional `status_readers`, for example
`"status_readers": [{"uid": 5678, "name": "agent-zero"}]` (synthetic UID).
Keep it out of `callers`. See the [protected configuration and strict validation
rules](../deploy/server/README.md#status-readers-trial-item-4); do not edit a server
profile from chat or use the example UID without verifying the existing account.
The broker peer allowlist and protected socket access are separate prerequisites;
the profile grant applies only to runs dispatched after that configuration.
Missing/empty reader lists add nobody, and edits do not change historical grants.
No run/dispatch/admit, approval, explain, evidence or Phase B reader access is
granted. No host change is performed by these examples or config generators.

```sh
truthlens agent-config agent-zero --socket /run/truthlens/status.sock
```

For an Agent Zero build supporting local MCP stdio, copy the same `mcpServers`
JSON into its MCP server configuration. Verify that build's schema, stdio support
and executable PATH first. In a container, the path must refer to the protected
socket accessible under the actual authorized agent UID; a host path alone does
not establish access. No Docker settings or container mounts are changed here.
This is separate from the existing disconnected ACP handler; it does not enable
Mausbot session attribution or a live `/audit` chat command.

## Query from a terminal or script

```sh
truthlens agent-status AUTHORIZED_RUN_ID --socket /run/truthlens/status.sock
truthlens agent-status AUTHORIZED_RUN_ID --socket /run/truthlens/status.sock --json
```

Output is exactly one status plus newline, or canonical JSON with exactly one
field, for example `{"status":"not_checkable"}`. Default socket:
`/run/truthlens/status.sock`; no environment-selected endpoint or protected data
source. Socket and ID are inputs only and never reflected. The CLI uses the same
G1 client as MCP, with no local audit, registry, run-directory or reader fallback.

| Status | Exit | Meaning |
|---|---|---|
| `passed` | 0 | Authorized, stored, closed, HMAC-authenticated audit supports the scoped claim |
| `failed` | 1 | Same trust prerequisites; audit contradicts the scoped claim |
| `not_checkable` | 2 | Unknown/denied, unreachable, invalid, interrupted or otherwise unverifiable |

`failed` is not a generic task/command failure. Status is no human approval,
merge/deploy permission or general security guarantee. Errors, invalid arguments
and `agent-status --help` also produce only `not_checkable` (JSON if `--json` is
present), without stderr detail. Use this page or `truthlens --help` for human
usage information. The agent-facing command's help cannot expand D34 output.

`truthlens workspace` and `truthlens runs` are human commands. They are not
agent tools, not a replacement for `truthlens init LEDGER`, and not a way to
attach the legacy `truthlens mcp --root` server to an agent. `workspace doctor`
stays read-only and reports isolation as unverified. A live harness is not
qualified by writing `workspace.toml`.

Do not use doctor or a model's retelling as evidence of real isolation. Distinct
UID/key custody, reader-network denial, restricted SSH forced command, actual
client sessions and sudo/docker-equivalent privileges require separately
authorized host qualification. Remote HTTP/OAuth, PyPI publishing, Docker
changes, host provisioning and deployment remain outside this local DX work.
