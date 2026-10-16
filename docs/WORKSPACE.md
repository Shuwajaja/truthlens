# Local workspace

TruthLens can index recorded native runs and imported Factory, GitHub, OTLP and
Memory snapshots into a local project workspace. These adapters read local
snapshots; they do not connect live to those systems or control their agents.

## Start the example

```bash
python -m pip install -e '.[dev]'
truthlens catalog rebuild --config demo/workspace/sources.json --db /tmp/truthlens-workspace.sqlite
truthlens catalog export --db /tmp/truthlens-workspace.sqlite -o viewer/public/workspace.json
cd viewer
npm ci
npm run dev
```

The example combines two previously recorded native demos with **synthetic**
Factory/OTel reports and synthetic Memory revisions. The examples inspired by
issues #71 and #92 are not original Factory reports. Without the original HMAC
key, native integrity is hash-only; acceptance remains UNKNOWN. A failed witnessed
test is distinct from corrupted integrity and still permits artifact inspection.

The viewer also accepts a bounded workspace JSON via **Sources → Workspace export
JSON**. This loads only in browser memory; it does not upload or persist the file.
Never distribute a combined export containing private projects to unauthorized
users. All data in an exported file is available to its recipient.
Loading a new export resets open details and pending Navigator requests, even
when its IDs and timestamp match the previous export. Focusing evidence clears
filters that could hide it and highlights only the selected run's event.

## Register your own sources

Copy `demo/workspace/sources.json` outside the repository, replace the projects,
workspace registrations and source paths, then rebuild. Config-relative paths
are supported. Native packages retain their original ledger/manifest/blob files.
Factory, GitHub, OTLP and Memory sources are JSON snapshots. Shapes and trust
decisions are documented in [the workspace contract](spec/workspace-v1.md).

Native verification optionally uses `--hmac-key-env VARIABLE`; only the variable
name is supplied. Do not place secrets in configs, exported snapshots or renderer
content. The existing capture command still requires its separate protected key
file; this upgrade does not alter capture or approval isolation.

Manual mapping is an entry in `overrides` with a source ID, original run ID,
project/workspace IDs and reason. Rebuild preserves it because configuration lives
outside the cache. Ambiguous mappings stay UNASSIGNED. Remove a source or expired
memory from the source configuration/snapshot and rebuild to drop cached content;
source deletion and retention remain the local owner's explicit responsibility.

## CLI and presentation tools

```bash
truthlens projects --db /tmp/truthlens-workspace.sqlite --json
truthlens search 'landing' --project truthlens --db /tmp/truthlens-workspace.sqlite --json
truthlens ask 'show evidence' --project truthlens --db /tmp/truthlens-workspace.sqlite --json
truthlens show run RUN_ID --project truthlens --db /tmp/truthlens-workspace.sqlite --json
truthlens navigator compose_view --project truthlens --db /tmp/truthlens-workspace.sqlite --json
truthlens catalog export --project truthlens --db /tmp/truthlens-workspace.sqlite -o /tmp/truthlens-only.json
```

Add repeatable `--allow-project PROJECT_ID` on read commands to impose a local
authorization ceiling. Result IDs are the same in CLI and workspace export.
`ask` currently uses literal source search plus explicit navigation/filter intents,
unless `--provider codex` selects the optional Codex CLI adapter. CLI navigation returns a proposal and never claims
to have opened a browser. The browser Navigator applies only validated local UI
actions; it cannot run an agent, write a source, approve or deploy.

Read-only tools: list_projects, list_workspaces, find_runs, get_run,
get_run_events, get_artifacts, get_evidence, search_memory, search_all,
get_project_activity, get_renderer_options, compose_view. Tools paginate and
project-scope results. The original three-tool stdio MCP remains unchanged;
these additional tools are a local versioned workspace interface, not a claim of
remote MCP or embedded host compatibility.

## Codex subscription Navigator (optional)

Use your existing Codex CLI ChatGPT login; no API key is copied into TruthLens.
Check `codex login status`; if a real request reports an expired login, sign in
again with `codex login --device-auth` and approve the CLI's displayed device code
in your own browser. A reported login status alone does not prove working access.

```bash
truthlens ask 'What is actually recorded?' --provider codex --project truthlens --db /tmp/truthlens-workspace.sqlite --json
cd viewer && npm run build
cd ..
truthlens serve --db /tmp/truthlens-workspace.sqlite --static viewer/dist --project truthlens --port 4174
```

Open the printed loopback address and select **Codex · subscription CLI** in the
Navigator mode selector. This sends only the selected project's bounded recorded
context and question through the local Codex account, only after Ask Codex. Model
text is labelled an unverified explanation; cited source IDs and presentation
actions are checked again. Apply a proposed view explicitly to receive a local
client acknowledgement. The Stop button requests subprocess cancellation.

The optional server is loopback-only, pins allowed projects at startup, requires
an in-memory session token and same-origin requests for model calls, and never
serves the combined static workspace file through its asset route. One model
request at a time, a short request interval, 90-second timeout, bounded context
and 1 MiB subprocess output limit constrain resource use. Codex runs ephemeral,
with user config/rules ignored, read-only sandbox, and shell, execution, apps,
plugins, browser, image, hooks and multi-agent tools disabled. An unsupported CLI
or failed login returns an error; it never pretends local search was a model
answer. No new Codex agent worker is started to execute project tasks.
Malformed provider responses are rejected without applying proposals. If the
catalog temporarily becomes unavailable, the reader returns a bounded error;
restoring the catalog lets subsequent requests succeed without restarting it.
After a server restart invalidates the browser's session token, the next explicit
Ask obtains a fresh token; model requests are never automatically retried.

Subscription access, model availability and quota follow the installed Codex
CLI/account. Live account verification and real microphone use require the
owner's interactive authorization; protocol tests are not substitutes for them.

## Voice and privacy

Push-to-talk requires a supporting browser and microphone permission. Text remains
available on denial or unsupported browsers; Stop/Cancel ends the current session.
Spoken replies are optional. TruthLens does not persist transcripts. Browser
speech recognition can use the vendor's speech service and is not an offline or
cross-browser guarantee. No microphone is started on page load.

## Restore

Keep original sources and `sources.json` backed up separately from SQLite.
Rebuild into a new database/export path first when changing configurations. Invalid
global config does not replace the active database. Source failures are visible
diagnostics rather than a successful stale run. Restore the previous export/viewer
to roll back the UI; no source ledger is migrated or rewritten.

For the old single-run viewer, remove the workspace export from the served
directory and serve `/run.json` with an actual 404 for `/workspace.json`, or open a
native run through the workspace. Invalid workspace JSON never falls back.
