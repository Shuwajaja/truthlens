# TruthLens local workspace viewer

Run `npm install`, then `npm run dev -- --host 0.0.0.0` from this directory. Build with `npm run build`; static output is `dist/`. The viewer is read-only and requires no external AI provider.

The application loads `/workspace.json` (`truthlens.workspace/1`). A missing export **with HTTP 404** enables the existing `/run.json` viewer. Malformed JSON, invalid schemas and HTTP errors show an error instead of substituting other data. Some SPA servers return HTML with status 200 for absent files; configure an actual 404 or provide an export. Sources accepts a bounded local workspace JSON export without uploading or persisting it. The loading/error page also supports file import.

The included export labels synthetic imported examples and retains real recorded native demo runs as hash-only. Neither imported reports nor hash-only integrity grants native verification or human acceptance. Origin, integrity, check, review and acceptance remain separate.

Project/workspace selection isolates results and knowledge. Lists are bounded to 100 runs/memory records and 200 artifacts with visible counts. Client Lens is default; Developer Lens reveals IDs and raw payloads. Renderer registry in `src/registry.ts` declares deterministic matching, capabilities and sandbox policies. Unknown or malformed rich content falls back to inert text. HTML uses an opaque-origin, script-free sandbox and no-network CSP. Markdown links are inert text. Only embedded raster images are previewed; remote URLs, SVG, PDF and other media fall back to inert metadata/content. Graphs use a shared bounded SVG renderer with recorded source/type/status details; Evidence and Memory revisions use the same component. Missing endpoints are omitted rather than fabricated.

Navigator accepts exact view names or `open Results`, supports `show errors`, otherwise performs project-local text search. It never executes imports as instructions. The UI action validator checks project scope, target IDs and known action types. Browser push-to-talk is optional, supports Stop/Cancel and falls back to text when unavailable or denied. Browser speech recognition may use the browser vendor's remote recognition service; use text for sensitive data. No transcripts are persisted by TruthLens. Spoken replies require explicit opt-in.

Appearance profiles use the closed `truthlens.profile/1` schema, local storage, import/export and reset; collection layout and pane order round-trip with theme/density/accent. Brand accent never changes criterion status colors. View history supports browser Back/Forward; detail dialogs trap keyboard focus, close with Escape and return focus to the trigger.

Lean verification:

```sh
npm run build
npm run lint
node --experimental-strip-types tests/workspace.test.ts
```

Browser smoke selectors: `nav-results`, `nav-activity`, `nav-knowledge`, `nav-sources`, `nav-appearance`, `run-open`, `artifact-open`, `workspace-import` via `data-testid`. Inspect an artifact, switch its supported renderer, close with Escape, change project, and verify previous project content is absent. Check 360px viewport and profile reset. Voice hardware/permission behavior depends on the browser and is not a native verification claim.

Optional Codex Navigator mode uses the same-origin local `truthlens serve` bridge and the owner's authenticated Codex CLI account. Choose Codex, type a question and press **Ask Codex** to send selected project context. The viewer does not initiate model requests on load. Session tokens remain in memory. Stop or a project/mode change cancels the request. Explanations remain unverified, cited IDs must exist in the selected project, and presentation proposals require an explicit **Ansicht öffnen** click and client validation. Failed service/login requests display an error; the user can select Local mode explicitly. Codex browser smoke selectors are `navigator-mode`, `codex-question` and `codex-status`.
