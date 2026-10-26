# Architecture

```
agent (OpenCode / Cursor / any CLI) ──► wrapper.py  (truthlens run) ──► ledger.py (JSONL, hash chain, HMAC)
                                          │   ▲   │                         │
                         gate inbox ──► gate.py ◄─┘ (approve by hash)       ├─► projection.py (SQLite, rebuildable)
                                          │                                  ├─► export.py ─► viewer/ (React)
                                          └─► store.py + manifest.py ────────┴─► mcp.py (read-only, stdio)
```

## Modules (`src/truthlens/`)
| Module | Role |
|---|---|
| `canonical.py`, `ids.py` | Canonical JSON (no floats), ULID-style ids. |
| `ledger.py` | Append-only JSONL per run, Event Schema v1, SHA-256 chain by `seq`, HMAC with key id, fail-closed `verify`, `repair` (human + key only). |
| `redaction.py` | `[REDACTED]` before hashing: secret names (any length), known token formats, CLI flags, URL credentials; input capped. |
| `store.py` | Content-addressed blob store `blobs/sha256/xx/<sha>`. |
| `manifest.py` | Acceptance (met / unmet / unverified / proposed), claim support (D26, only `kind=completion`), Artifact Manifest v1, recompute-and-compare check (D28). |
| `wrapper.py` | `truthlens run`: filtered agent env (HMAC key never passed), git captured with hooks/external diff disabled, before/after snapshot, byte-level secret removal, witnessed tests in a clean copy (tracked, non-ignored files, no symlinks, tests restored), counts from JUnit XML, optional `--test-user`. |
| `gate.py` | Approval gate: request inbox outside the run dir, action hash = argv + resolved program + tree hash, execution from an immutable snapshot, human approval signed with the key, single use, expiry, rollback anchor outside the run dir. |
| `projection.py` | Disposable SQLite read model, rebuilt atomically from a verified ledger. Failed rebuilds close the connection before temporary-file cleanup and preserve the previous database for retry. |
| `export.py` | Viewer JSON (cards, claims, timeline, hash-checked text blobs). |
| `mcp.py` | Read-only stdio MCP (`list_runs`, `run_report`, `run_events`); without key: `verified:false`, `integrity:"hash-only"`. |
| `cli.py` | `init`, `run`, `request`, `act`, `approve`, `verify`, `repair`, `report`, `project`, `export`, `mcp`. |

## Data flow
1. `truthlens run` writes `run.started`, criteria, the before snapshot, then starts the agent with a filtered env.
2. Gated actions: the agent calls `truthlens request -- <cmd>` → `action.requested` + `action.blocked`; a human runs `truthlens approve <ledger> <hash>`; the wrapper executes once from the approved snapshot → `action.executed` + evidence.
3. After the agent: diff + changed files as redacted blobs (`artifact.recorded`), witnessed tests (`test.reported`), claims from agent output (`agent.claim`), `run.finished`, manifest.
4. `export` / `mcp` / `project` read only verified runs; the viewer renders Client Lens (plain language, default) and Developer Lens (events, hashes, payloads, diffs).

## Isolation and trust
- Same OS user ⇒ the agent can read the HMAC key and approve itself (documented, `xfail` test). Protection only with a separate Unix user / sandbox.
- On the build box: OpenCode worker, its ruff and tests run as `tl-agent` (`agent-config/scripts/tl-cycle.sh`); Cursor still runs as the box user, restricted to `viewer/`.
- Witnessed tests prove "the restored test command reported success", not correctness; code inside the tested process can still forge its own result. See `docs/TRUST-LEVELS.md`.
- Several items above (snapshot gate, JUnit counts, `--test-user`, byte-level redaction) are in open security PRs waiting for CodexChat review; see `docs/STATUS.md`.

Stack: Python 3.12/3.13 stdlib-only core, pytest, ruff; Vite + React + TypeScript viewer; GitHub Actions.
