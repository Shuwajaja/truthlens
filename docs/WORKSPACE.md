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

The optional [MCP App adapter](MCP-APP.md) now exposes a separate set of four
versioned read tools over local Streamable HTTP, including an embedded evidence
widget and a real local host preview. It has no public endpoint or remote login.

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
The model's citation schema permits only run and memory IDs included in its
context. Evidence events are cited through their containing run; nested event
IDs are not accepted as standalone Navigator sources.

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

## v6 workspace and shared evidence views

The icon rail opens Overview, Projects, Results, Activity and Evidence; More
contains Knowledge, Sources, Renderers and Appearance. Choose a project and
workspace in the navigator (Scope on narrow screens). Work tabs keep at most
five views within the selected scope; browser back/forward restores validated
routes. Recorded artifacts open in the central canvas. Source details opens an
inspector with provenance, raw source and timeline; Escape returns focus.

The same RenderKit powers the local MCP widget. Brand accents are independent
of integrity/check/acceptance labels. The owner's original brand files are used
unchanged. The shell retains local import, presentation preferences, local search,
optional Codex Navigator and explicit push-to-talk with text fallback.

## Review and connection flow

Overview now starts with recorded work that needs inspection. **Review this run**
opens claims and checks, placing failed checks first. **View recorded source**
opens its exact source record. Expand JSON fields or open Raw JSON; Escape closes
the inspector and restores focus. Artifacts remain available through Results and
Files from this run, with Rendered, Raw source and Wrap lines controls.

On mobile, Overview, Results, Evidence, More and Scope stay at the bottom. More →
Connections explains local preview, Codex and ChatGPT setup separately. These are
instructions, not live connection checks. More → Appearance offers Obsidian,
Midnight and Paper. Graph nodes can be selected by click or Enter/Space to trace
only recorded relationships; zoom controls and the textual relationship list
remain available. Reduced-motion preferences disable the navigation/trace effects.

### Repeat a local visual review

With the bundled demo loaded, start Vite (`npm --prefix viewer run dev -- --port 4173`).
Install Python Playwright in a development environment and a Chromium browser
(`python -m pip install playwright` and `python -m playwright install chromium`).
Then run `python viewer/scripts/visual_review.py --url http://127.0.0.1:4173`.
The optional `--axe /path/to/axe.min.js` checks WCAG rules on the final source
view; the broader six-state design audit was run separately during this change.
Screenshots stay in `/tmp/truthlens-visual-review` or an explicit `--output`
directory. Review them visually; the script does not certify design quality or
replace agreed screenshot baselines. Use demo data, not private exports, when
sharing output. This optional smoke is not a second full browser suite in CI.


## Import selected local files

No API key or harness login is needed for a local snapshot. Build the viewer, then:

```bash
truthlens import-files --project my-project --output-dir ./my-truthlens report.md screenshot.png
truthlens serve --db ./my-truthlens/catalog.sqlite --static viewer/dist --project my-project
```

The output parent must exist and the output directory must be new. The command
creates `import.json`, `sources.json`, `catalog.sqlite` and `workspace.json`.
Alternatively open `workspace.json` with Connections / Choose a TruthLens export
in the private preview; this browser import does not upload files. Original files
are unchanged. A snapshot is not a live connection; to capture changed files,
create a new bundle and import it or restart the reader with its catalog.

Select 1–32 files. Each rendered payload is limited to 256 KiB after encoding and
redaction (base64 images therefore allow fewer original bytes). Text/code,
Markdown, diff, HTML, JSON objects/arrays, CSV and PNG/JPEG/GIF/WebP are supported.
Raster signatures must match; SVG, directories, symlinks and unsupported binaries
are rejected. Pixels are **not** automatically redacted. Markdown images/links do
not automatically fetch external content. Use `.chart.json`, `.graph.json`,
`.timeline.json` or `.table.json` for existing structured renderer formats.
CSV supports at most 1000 data rows and 100 columns; JSON files must be valid.

Optional `--memory notes.json` accepts a bounded `records` (or `memory`) array
using the existing memory-source fields. Project/access restrictions still apply;
returned `memory_records` reports accepted records. Memory is project-wide, never
implicitly workspace-specific. Statements are source records, not verified facts.

## Local saved perspectives

Saved views stores at most 20 closed `truthlens.projection/1` recipes in this
browser. Name, project/workspace, view and text filter are stored, never evidence
or trust state. Open resolves the current snapshot. Memory views require All
workspaces. Remove deletes the local recipe only. Agent proposal / JSON accepts
the same bounded format, with an example for the selected scope. It is explicit
user import, not remote MCP control or cloud synchronization.

## Document reader

Markdown supports GFM tables, task lists and footnotes; raw HTML and automatic
remote image loading are disabled. Source remains available. Web-only Mermaid
preview currently accepts bounded text-only flowcharts: no configuration,
styling, links, images or embedded HTML. Unsupported syntax retains source.
The diagram engine loads on request, and the resulting diagram is sandboxed.
MCP widgets retain diagram source to keep the widget self-contained and below
its resource limit. Graphical relationships are not a verification outcome.


## Refresh recorded sources

For a catalog built from configured source exports:

1. Update the export at the path registered in `sources.json`.
2. Run `truthlens catalog rebuild --config /path/sources.json --db /path/catalog.sqlite`
   using the **same database path** as the running reader.
3. Reload the browser. No reader restart is needed. Each workspace request reads
   the current catalog; the browser does not poll your harness automatically.

The rebuild replaces the catalog, so deleted runs and notes disappear too. An
unreadable source produces a source error instead of retaining its old results.
Correct that source and rebuild again. Project access remains limited by the
reader's original `--project` arguments.

For a JSON file opened in the static/private preview, generate a new scoped export
and import it again instead:

```bash
truthlens catalog export --db /path/catalog.sqlite --project my-project -o ./workspace.json
```

`import-files` bundles contain copies of explicitly selected files. Editing the
original files does not change an existing bundle: package them into a new output
directory and import its workspace export, or restart the reader with its catalog.

## Three-minute local walkthrough

This is a suggested demonstration, not a recorded human acceptance test.

1. Open the recorded example workspace. From Overview, open a result. Show the
   actual document and expand Source & verification.
2. Open the native demo with the failed email check. Distinguish the failed check,
   the unverified mobile requirement and hash-only integrity. None implies human
   approval.
3. Open History, then return to the result. On a narrow screen use the labelled
   view tabs or swipe; document scrolling remains inside the document.
4. Open Connections and import an own-file bundle's `workspace.json`. Open its
   result, noting that imported content is not a cryptographic verification.
5. In the local MCP preview, load the same project's records and open a shared
   view. This demonstrates the local MCP bridge, not a ChatGPT installation.


## Compare images and compose a perspective

In Results, expand **Compare recorded images** when raster images are available.
Choose First and Second explicitly. Both must be in the current filtered results;
changing project, workspace or filter can make the pair unavailable. The view
preserves proportions and offers each image's recorded source. It does not infer
which is newer or whether the change is correct.

Under Saved views, **Compose a view · advanced** accepts a reference-only JSON
recipe from an agent, or creates an example from the selected workspace. Preview
renders actual existing records using the json-render catalog: Overview, Result,
Checks, Timeline and project-wide Memory. The recipe cannot supply content,
verification, actions or executable code. A root contains at most six sections;
invalid, stale or foreign references produce a readable error. The preview shows one selected section at a time; use its labelled section
buttons to switch. After a successful preview the recipe editor collapses; expand
Edit view recipe to change it. Close preview or reload to discard this temporary
composition. This is independent of the saved
single-view recipes above, and requires no model API key.
