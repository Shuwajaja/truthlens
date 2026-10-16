# TruthLens MCP App

The MCP App is a read-only delivery surface for recorded TruthLens evidence.
The local preview runs the real HTTP MCP server and embeds the widget with the
standard MCP Apps bridge. It is a local test host, not a ChatGPT installation.
The original `truthlens mcp --root ...` stdio interface remains available.

## Run locally

From the repository root, with Python 3.12+ and Node 24:

```bash
python -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[app]'
truthlens catalog rebuild --config demo/workspace/sources.json --db /tmp/truthlens-app.sqlite
cd viewer
npm ci
npm run build:widget
cd ..
truthlens mcp-app --db /tmp/truthlens-app.sqlite --widget viewer/dist-widget/widget.html --project truthlens --port 4177
```

Open **http://127.0.0.1:4177/preview** on the same machine. Select the project,
load its recorded runs, select a run and inspect its evidence and artifacts.
This reads the same catalog as the workspace CLI. The bundled Factory examples
are synthetic and native demos have hash-only integrity without their HMAC key.

The MCP endpoint is **http://127.0.0.1:4177/mcp**. An optional local Codex
connection can be registered in another terminal:

```bash
codex mcp add truthlens-workspace --url http://127.0.0.1:4177/mcp
```

Start a new Codex session and ask: “Use truthlens-workspace to find the recorded
run with a failed check. Explain the evidence and its verification limits.”
Codex can use text/structured results even when its host does not display the
widget. No Codex account or model call is needed to run the preview itself.

## Tool flow

| Tool | Purpose |
| --- | --- |
| `truthlens_list_projects` | List authorized projects |
| `truthlens_list_runs` | Filter runs within a project/workspace |
| `truthlens_get_run` | Read one scoped run |
| `truthlens_list_artifacts` | List recorded artifacts with render envelopes |
| `truthlens_get_artifact_view` | Read authoritative envelope and bounded payload |
| `truthlens_search` | Search recorded project evidence |
| `truthlens_list_memory` | Page through authorized recorded project notes |
| `truthlens_compose_view` | Compose overview, artifact, evidence, timeline or memory UI |

The four older `_v1` tools remain available. New list results use `items`,
`next_cursor` and `snapshot_id`; cursors are bound to the query and snapshot.
Initialize with experimental capability `io.modelcontextprotocol/ui` and MIME
`text/html;profile=mcp-app` to receive UI metadata and these resources:
`ui://truthlens/workspace-overview`, `ui://truthlens/artifact-viewer`,
`ui://truthlens/evidence-inspector`, `ui://truthlens/run-timeline`,
`ui://truthlens/project-memory`.
Without that capability, the new tools return text/JSON without a UI template.

Example compose arguments:

```json
{"project_id":"truthlens","view":"workspace-overview"}
```

Artifact views additionally require `run_id` and `artifact_id` from list results.
`truthlens_get_artifact_view` returns data without opening a widget. The local
preview offers all five views and selects a recorded run/artifact for detail views.

Project memory uses `{"project_id":"truthlens","view":"project-memory"}` without
run/artifact IDs. It shows up to100 notes within a512KiB note-content budget and
reports the full authorized count. Use `truthlens_list_memory` to read additional
pages. Memory stays project-wide, includes only project/public access records,
and does not appear in unrelated widget metadata. Notes and revision links are
recorded statements, not automatically verified facts.

For an stdio client, use the same executable with these arguments:

```bash
truthlens mcp-app --transport stdio --db /tmp/truthlens-app.sqlite --widget viewer/dist-widget/widget.html --project truthlens
```

Protocol output goes to stdout; diagnostics go to stderr. HTTP sessions retain
client capabilities; clients must retain the SDK's session ID.

Search and read tools do not force a widget into the conversation. The render
tool takes only IDs and an optional expected snapshot ID. It loads the records
again on the server; it never accepts model-authored statuses, evidence, HTML or
artifact bodies. Supply the search result's snapshot ID when rendering a
selection to detect a catalog rebuild between calls. A stale snapshot requires
a fresh query, not silent substitution.

The render tool returns a `truthlens.widget/1` summary in `structuredContent`,
a readable text fallback, and the selected `truthlens.workspace/1` document in
`_meta["truthlens/workspace"]` for the UI. The latter is UI data, not a place to
store secrets. The legacy resource is `ui://truthlens/workspace-v1.html` with MIME type
`text/html;profile=mcp-app`. Its HTML contains no recorded source content; data
arrives through the host's tool-result channel.

## What the widget means

The widget presents recorded evidence, not a universal truth score:

- **Origin:** native recording or imported report.
- **Integrity:** HMAC, hash-only, failed or unknown; this is separate from checks.
- **Checks:** recorded pass/fail/unknown within the stated criteria.
- **Review and acceptance:** retained separately; a model cannot grant approval.

Failed integrity isolates artifact/event content. A failed check still permits
inspection of its evidence. Imported success statements remain source reports.
Snapshot IDs identify catalog versions and are not new cryptographic attestations.
Source IDs and recorded timestamps remain available for tracing the result.

The widget reuses the workspace's renderers, with text fallback where the host
cannot safely embed a preview. It makes no direct external network calls and
does not run the Codex Navigator, upload transcripts, modify sources, start an
agent, merge, deploy or approve. UI selections are temporary; credentials never
enter the component.

## Later: connect ChatGPT

The current implementation is deliberately loopback-only. It has Host/Origin
validation and an explicit project ceiling, but no remote user authentication.
Do not expose this listener with an anonymous public tunnel or reverse proxy.

Current OpenAI documentation describes two connection routes:

1. **Private testing with Secure MCP Tunnel:** the tunnel client reaches the
   local MCP endpoint using an outbound connection. This requires a configured
   Platform tunnel, runtime API credential and the appropriate ChatGPT workspace
   association/permissions. A Codex subscription login alone does not configure
   that tunnel. No tunnel is created by this implementation.
2. **VPS deployment:** add HTTPS and OAuth 2.1 protected-resource discovery, token
   issuer/audience/expiry/scope validation, and per-user project grants before
   exposing private data. Keep the local preview out of the public deployment.

In ChatGPT, where enabled for the account/workspace, open **Plugins → + → Add
custom MCP server**, choose the HTTPS endpoint or configured tunnel, then review
the discovered tools and install. Product labels and availability may vary by
workspace. Test actual widget rendering in a new conversation and refresh MCP
metadata after tool/template changes. Local preview success does not establish
ChatGPT desktop/mobile support or acceptance by a particular account.

Suggested acceptance prompts:

- “Show the run with the failed email-validation check and its evidence.”
- “Is this imported success report actually verified or accepted?”
- “Show the recorded diff, then explain which checks are still unknown.”
- “Approve and deploy this run.” — TruthLens exposes no such operation.

## References

Checked against official documentation on 2026-10-16:

- [MCP server tools](https://developers.openai.com/plugins/build/mcp-server)
- [MCP Apps UI and bridge](https://developers.openai.com/plugins/build/chatgpt-ui)
- [OAuth authentication](https://developers.openai.com/plugins/build/auth)
- [Connect and test](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)

## Hosted component preview

The standard viewer build also includes `/demo-widgets.html`: five interactive
shared RenderKit views (overview, result, checks, history and project memory), project/example/file
selection, and light/dark appearance. It validates the bundled workspace export
before rendering and preserves failed-integrity isolation. It uses recorded
examples, including explicitly synthetic entries. This is a component gallery,
not an MCP host, model connection or a ChatGPT integration.

Build the hosted app banner/link with `VITE_PRIVATE_PREVIEW=1 npm --prefix viewer run build`.
The static build needs no API key. A local MCP server and its real `/preview`
remain separate; external ChatGPT access still requires the hosted authentication
and transport setup described above. An OpenRouter key is not used by the current
preview or MCP tools. Optional model-provider integration would be a separate change.
