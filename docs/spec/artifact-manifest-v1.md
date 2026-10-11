# Artifact Manifest v1 — FROZEN (v1, 2026-10-11)

One JSON document per run (`manifest.json`), written after `run.finished`; bound to the ledger by `ledger_last_hash` and not recorded inside the ledger (D28).

```json
{
  "manifest_version": 1,
  "run_id": "run_…",
  "ledger_last_hash": "…",
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
    "trust": "integrity_verified",
    "review": "required"
  }],
  "acceptance": [{
    "criterion_id": "crit_…",
    "text": "verify detects a byte flip",
    "evidence": ["evt_…"],
    "status": "met"
  }]
}
```

- `provenance`: `original` (produced inside a captured run) | `imported` (brought in afterwards, origin not witnessed) | `derived` (projection/rendering computed from other artifacts or events; `derived_from` required).
- `kind` (optional, open string, D21): `document | source_visited | message_sent | file_changed | command_run | test_run | …`; unknown kinds render as `raw`.
- `renderer`: `markdown | diff | test-report | code | image | json | url | raw` (open; unknown → `raw`).
- `trust`: computed, never trusted from input — see TRUST-LEVELS.md.
- Blobs are stored content-addressed; the manifest never embeds content.
- `ledger_last_hash`: hash of the run's final event (`run.finished`), anchoring the ledger end (D15).
- ~~The manifest is recorded via `artifact.recorded` (D8)~~ – superseded by D28: the manifest is a post-close artifact outside the chain; verify checks `ledger_last_hash` and every `sha256`.
- `trust` values: `imported | integrity_verified | review_required | verification_failed` (see TRUST-LEVELS.md). `review_required` may be shown together with `integrity_verified` (`trust` = integrity, `review` = `required|accepted` separately).
- `acceptance` (D19): per criterion the witnessed evidence event ids and `status` = `proposed` (derived, not confirmed by a human – D22) | `met` (witnessed decisive evidence, passing – D25/D27) | `unmet` (witnessed evidence, failing) | `unverified` (no witnessed evidence; agent claims alone never yield `met`).
