# Artifact Manifest v1 — DRAFT

One JSON document per run (`manifest.json`), itself hashed and recorded via `artifact.recorded`.

```json
{
  "manifest_version": 1,
  "run_id": "run_…",
  "agent": {"name": "opencode", "version": "1.18.35", "model": "openrouter/deepseek/deepseek-v4-flash"},
  "artifacts": [{
    "artifact_id": "art_…",
    "path": "docs/CONCEPT.md",
    "sha256": "…",
    "size": 1234,
    "media_type": "text/markdown",
    "renderer": "markdown",
    "provenance": "original",
    "derived_from": [],
    "events": {"recorded": "evt_…", "produced_by": "evt_…"},
    "trust": "integrity_verified"
  }]
}
```

- `provenance`: `original` (produced inside a captured run) | `imported` (brought in afterwards, origin not witnessed) | `derived` (projection/rendering computed from other artifacts or events; `derived_from` required).
- `renderer`: `markdown | diff | test-report | code | image | json | raw`.
- `trust`: computed, never trusted from input — see TRUST-LEVELS.md.
- Blobs are stored content-addressed; the manifest never embeds content.
