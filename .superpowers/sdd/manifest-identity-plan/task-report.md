# Manifest identity task report

Base: `9fdd3a8` (existing PR #159 / issue #48 strict-counter branch).

## Change

- Recorded D35 in the frozen Artifact Manifest v1 changelog as an agent implementation decision for the remaining issue #48 criterion. It does not claim human, security, or merge approval.
- `build_manifest()` now requires exactly one `run.started` event at position zero. `check_manifest()` reaches that validation through recomputation and compares `agent.name` unconditionally with that start event's declared agent.
- Kept generic ledger verification and partial `acceptance()` / `claims()` inputs unchanged. No event or manifest wire fields, hashes, schema versions, ledger code, or published demo bytes changed.
- Retained the existing strict-counter behavior. Updated only manifest-producing synthetic fixtures to include their initial start.

## Regression evidence

Added real signed-ledger cases for missing start, duplicate starts with same and different agent names, and a noninitial start. In each case the signed chain verifies, while manifest construction and checking reject it. A valid signed run with an empty agent name still builds and checks; a mismatch remains rejected. These cases failed before the production check and passed afterward.

## Checks

- `python -m pytest -q tests/test_manifest.py tests/test_manifest_r5.py tests/test_audit.py tests/test_export_integrity.py`: 80 passed.
- `python -m pytest -q tests/test_cli.py tests/test_wrapper.py tests/test_smoke.py`: 28 passed.
- `ruff check src tests`: passed.
- `git diff --check`: passed.

Independent security review and owner integration remain required before publishing/updating the PR. No push or merge was performed.
