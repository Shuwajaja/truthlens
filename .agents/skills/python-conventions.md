# Python conventions (TruthLens)

Own-words summary; idea credit: Trail of Bits `modern-python` skill (CC BY-SA 4.0), not copied.

- Python ≥ 3.12, `src/` layout, single package `truthlens`, deps in `pyproject.toml` only (no `requirements.txt`).
- Standard library first. A new runtime dependency needs a reason in the PR body.
- `ruff check src tests` must be clean; `ruff format` style. No mypy/black/flake8 configs.
- Tests: `pytest -q`. Lean – only tests that guard an acceptance criterion (see `AGENTS.md`).
- Type hints on public functions; `from __future__ import annotations` is fine.
- No `subprocess(..., shell=True)` with untrusted input; pass argument lists.
- File writes that matter (ledger, projections) are atomic: write temp + `fsync` + `os.replace`, or append + `fsync`.
- Never print, log or hash secrets before redaction; test fixtures use fake values (`sk-test-...`).
- Do not install tools globally, change PATH, add git hooks or pre-commit tooling from an agent run.
