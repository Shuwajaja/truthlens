# Workspace upgrade contract

Additive upgrade track for the 2026-10-16 TruthLens v5 master specification.
Implementation decisions below are agent decisions under the user's instruction
to implement the supplied vision. They do not constitute product acceptance or
human ledger approval. Event Schema v1, manifest v1, HMAC, gates, old exports and
old CLI commands retain their contracts.

## Decisions

- **D32 Separate presentation format.** `truthlens.workspace/1` is the local
  multi-project presentation snapshot. It does not replace LedgerEventV1 or the
  single-run `RunDoc`. The illustrative `catalog.v1` JSON in the supplied package
  is not accepted as this format. Unsupported versions fail closed.
- **D33 Configuration is not cache.** `truthlens.sources/1` registers projects,
  workspaces and read-only snapshot sources. Overrides, including reason and
  source/run identity, live here. SQLite is disposable, atomically rebuilt from
  sources. Removing a source then rebuilding removes its cached records. An
  invalid global configuration leaves the last database intact; a failed adapter
  produces an isolated diagnostic instead of stale success or total app failure.
- **D34 Scoped identity and mapping.** Catalog IDs derive deterministically from
  source-instance ID and source-object ID; artifact IDs additionally include run
  identity. Preserve original source IDs separately. Explicit registrations and
  overrides take priority. Recorded remote/root/worktree or commit/task metadata
  may map only to a unique registered workspace. No current Git configuration is
  substituted for historical evidence. Forks and worktrees do not merge by name;
  ambiguous mappings remain UNASSIGNED with candidates and explanation.
- **D35 Separate trust axes.** `origin` is NATIVE or IMPORTED. `integrity` is
  hmac/hash-only/failed/unknown. `verification` describes the bounded check
  assessment (VERIFIED/FAILED/UNKNOWN), not an approval: native unmet criteria
  remain FAILED even when HMAC is valid; HMAC alone does not make criteria pass.
  Imported source success flags cannot set native verification. `review` remains
  REQUIRED, `acceptance` UNKNOWN. `assessment_origin` states witnessed/hash-only/
  source_reported/unknown. Source status and summary are separately reported.
- **D36 Immutable read boundary.** Native ledger, manifest and content-addressed
  blobs are size-bounded snapshots. Verify and presentation use those same bytes.
  Every path component is opened without following symlinks. Re-hash blob bytes,
  check manifest binding, redact before persistence/indexing. Failed-integrity
  content is isolated; a failed *test* can still show its recorded artifacts.
- **D37 Local authorization ceiling.** Catalog exports, searches and Navigator
  tools filter projects before exposing results. Per-project direct IDs do not
  bypass the filter. CLI `--allow-project` constrains the local caller's read
  ceiling. This is a local single-user product, not a hosted authentication
  service. A shared deployment must establish allowed projects from authenticated
  server-side policy and must never publish a combined private-project JSON.
- **D38 Deterministic rendering.** The registry chooses a registered renderer from
  artifact kind and capabilities; missing or invalid content explains its safe
  fallback. Text/Markdown/Diff are React text, not injected HTML. HTML is opaque
  sandbox content with restrictive CSP and no script/same-origin capability.
  Remote media URLs, untrusted SVG and arbitrary local paths are not loaded.
  Evidence blobs may appear as derived presentation artifacts with evidence_ref;
  this creates no source event or new attestation.
- **D39 Read-only Navigator.** The source index and typed presentation actions are
  available without a model. Source text is data, never instructions. Allowed
  actions: navigate, open_run, open_artifact, select_renderer, set_filters,
  set_layout, focus_evidence. Validate scope, IDs and renderer capability. CLI
  proposals report client_acknowledged:false; only an actual client can confirm
  presentation. No shell, file write, approval, agent start or deployment tool.
- **D40 Voice and preferences.** Push-to-talk is a browser speech adapter with
  explicit start/stop/cancel, permission/unsupported fallback and opt-in spoken
  replies. Transcripts are not persisted by TruthLens. Browser speech services
  may use the browser vendor's processing; no universal offline STT is claimed.
  Presentation profiles contain only enumerated settings; no free CSS/scripts.
  Brand accents cannot change status labels or semantic status colors.
- **D41 Optional local Codex bridge.** A user's explicitly selected Codex CLI
  account can generate bounded presentation proposals. The model receives only
  the authorized project snapshot; execution, plugins and external tool features
  are disabled and output is untrusted. The optional loopback reader exposes no
  source/config write endpoint. Model access needs a working CLI login and quota;
  static reading and local search require neither. UI explanations are never
  witness evidence and proposed actions need validated client application.
- **D42 MCP Apps is a delivery adapter.** The optional `mcp-app` command uses the
  official MCP SDK and Streamable HTTP. Existing stdio tools retain their names
  and outputs. New tools have explicit version suffixes and read-only annotations.
  Data tools return useful text and structured data without requiring a widget.
  Only the render tool advertises a `text/html;profile=mcp-app` UI resource.
- **D43 Server-owned widget evidence.** Render arguments contain project/run IDs
  and an optional expected snapshot digest, never claims, trust labels, HTML or
  artifact contents. The server resolves every ID within its startup project
  ceiling and builds the widget result from the catalog. A stale expected digest
  fails explicitly. A snapshot digest identifies a presentation version; it is
  neither a new ledger signature nor proof of factual correctness. Widget and
  tool text preserve D35's separate trust axes and source provenance.
- **D44 Embedded presentation boundary.** The widget uses the standard MCP Apps
  bridge and accepts validated tool results. Host tool calls are read-only and
  checked by the server. Artifacts reuse safe renderers; unsupported nested HTML
  previews fall back to text. No remote scripts, fonts, media requests, source
  writes, model execution or automatic approval occurs inside the component.
  Widget state is temporary presentation state, never a source of truth.
- **D45 Local qualification before remote access.** The first MCP Apps server
  binds loopback only, with Host/Origin validation and an explicit project ceiling.
  Its local host preview exercises actual MCP HTTP and the standard app bridge;
  this does not constitute ChatGPT host acceptance. Public/VPS delivery needs
  HTTPS, OAuth 2.1 resource-server validation and authenticated project grants
  before private records can be exposed. No anonymous public mode is supplied.

## Source configuration

```json
{
  "schema_version": "truthlens.sources/1",
  "projects": [{"id": "example", "name": "Example"}],
  "workspaces": [{"id": "worktree-1", "project_id": "example", "name": "Local worktree", "root": "./worktree"}],
  "sources": [{"id": "factory-local", "kind": "factory", "path": "./factory.json", "project_id": "example", "workspace_id": "worktree-1"}],
  "overrides": []
}
```

Paths resolve relative to the configuration, not the calling directory. Identifiers
are nonempty bounded strings; duplicates and invalid project/workspace references
are rejected. At most 100 sources. Never put credentials or HMAC keys in this file.

Kinds: `native` (one run directory or a directory of immediate run directories),
`factory`, `otel`, `github`, `memory` (local JSON snapshots). No adapter executes
commands or modifies sources. Configured paths are a local user's explicit read
grant, not a grant to imported arbitrary artifact paths.

Snapshot versions: `truthlens.factory-snapshot/1`,
`truthlens.otel-snapshot/1`, `truthlens.github-snapshot/1`,
`truthlens.memory-snapshot/1`. Unversioned source exports are accepted as the
documented adapter shape; an explicitly unknown version is rejected. Factory:
`runs:[{id|run_id,title,summary,status,events,artifacts}]`; Memory:
`records:[{id,text,source_ref,captured_at,valid_from,valid_to,revision_of,
project_scope,access_policy,claim_refs,retrieval_refs}]`; OTel: OTLP JSON
`resourceSpans/scopeSpans/spans`; GitHub: `issues`, `pulls`, `commits` arrays of
exported GitHub objects. Reported checks, actor names and human-sounding statuses
are still source claims. There is no live webhook or universal OTel exporter.

Overrides: `{source_id,source_run_id,project_id,workspace_id?,reason}`. They are
auditable configuration, not cryptographically authenticated human approvals.

## Workspace snapshot

Top-level `schema_version`, `generated_at`, `projects`, `workspaces`, `sources`,
`runs`, `memory`, `unassigned`. Generated project-filtered snapshots contain no
foreign project run, blob or memory. `unassigned` is an array of canonical run IDs;
those runs have null project/workspace and are excluded from project queries.

Run fields: `id`, `source_id`, `source_run_id`, nullable `project_id` and
`workspace_id`, `title`, `agent`, nullable `started`, separate trust fields above,
`mapping_reason`, `mapping_candidates`, `errors`, `criteria`, `claims`, `events`,
`artifacts`, `reported_status`, `reported_summary`. Artifacts have run-qualified
`id`, `path`, `kind`, optional `sha256`, bounded embedded text `content`; paths are
labels, not filesystem read requests. Events retain source IDs within run scope.

Memory IDs are source-qualified; `revision_of` refers to that same source's memory
identity. No revision merge infers truth and no unrecorded recall trace is invented.
Project access policy is enforced before indexing/export. Only supported policies
are admitted; private/unknown policies are not widened into public data.

Limits: 16 MiB per input file, 64 MiB total catalog, bounded object arrays and
artifact text. The browser additionally caps imported snapshots at 20 MB. FTS5 is
a rebuildable local index, not a second ledger. Source receipts expose capture
time, adapter identity and snapshot digest where available, not secret contents.

The browser validates structure and semantics; it does **not** independently
authenticate an uploaded JSON's cryptographic claims. Use exports produced by the
trusted local verifier; never treat a manually edited presentation snapshot as a
new signed ledger.

## Compatibility and rollback

Old `/run.json` remains a separate single-run mode when workspace data is absent.
Invalid workspace data produces an error, never a silent success fallback. Legacy
export/CLI/MCP semantics are preserved. The new CLI names are additive (`projects`
versus the existing `project` projection command).

Before an upgrade keep source configuration and original run packages backed up.
Restore the previous viewer and export, or rebuild the disposable catalog. There
is no source migration to reverse. No external deployment is implied.

## RenderKit and workspace MCP extension (v6)

- **D46 Shared render contract.** `truthlens.render/1` carries canonical project,
  workspace, run and artifact identity; `payload_ref` equals the artifact ID.
  Presentation contains only registered renderer IDs. Provenance retains original
  source/run IDs and recorded event references. Origin, integrity, verification,
  review and acceptance remain separate. `data_status` is available, missing,
  malformed, isolated or unauthorized. Unsupported/invalid content uses plain
  fallback. The additive envelope never changes the source ledger.
- **D47 Two surfaces, one projection.** The web workspace and embedded MCP App
  share RenderKit components. Clients validate IDs, scope, provenance and trust
  against the scoped snapshot. An envelope cannot authorize access or supply new
  evidence. `truthlens.artifact-view/1` delivers the envelope and bounded recorded
  payload; `truthlens.widget/1` additionally selects a view/artifact. Widget HTML
  remains static; recorded data arrives only in tool results.
- **D48 Workspace tools and negotiation.** Seven unsuffixed tools supplement the
  four versioned tools from D42 (which remain compatible). Data schema versions
  stay explicit. `truthlens_compose_view` accepts project/view and optional
  canonical run/artifact IDs plus expected snapshot ID. Four UI resource aliases
  are advertised only to sessions declaring `io.modelcontextprotocol/ui`.
  Stateful SDK HTTP retains negotiated capabilities; the same factory supports
  stdio through `mcp-app --transport stdio`. Legacy `mcp --root` is unchanged.
  Pagination cursors bind the snapshot, query and page size; stale/foreign
  cursors fail. UI-free clients receive readable text and structured data.
- **D49 Scoped presentation state.** Workspace tabs are deterministic routes,
  limited to five in one project/workspace scope. Scope switches clear foreign
  selections and tabs. URL routes are validated against the loaded snapshot.
  Themes, fonts, density and inspector state are presentation only. The owner's
  supplied original brand JPEGs replace placeholder marks; no brand color can
  change a recorded outcome. Optional heavy editors/animation libraries are not
  required for this local release.
