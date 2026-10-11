# Architecture

```
agent (OpenCode) ──► capture (CLI wrapper) ──► core.ledger (JSONL, hash chain) ──► core.projection (SQLite, rebuildable)
                          │        ▲                │                                    │
                          │        └ core.gate ◄────┘ (policy, block, approve by hash)    ├──► mcp (read-only, stdio)
                          └► core.artifacts (content-addressed store + manifest) ─────────┴──► web (React, Developer/Client lens)
```

## Components
- **core.ledger** — append-only JSONL per run store, Event Schema v1, canonical JSON, SHA-256 chain, optional HMAC, redaction before hashing, fail-closed on corruption, single writer, `verify` reporting the exact line.
- **core.artifacts** — content-addressed blob store (`sha256/…`) plus Artifact Manifest v1. The bridge between ledger, MCP and web.
- **core.projection** — derived SQLite read model (runs, artifacts, tests, approvals, timeline). Disposable: always rebuilt atomically from the ledger (temp file → verify → rename).
- **core.gate** — approval gate. Policy classifies an action; risky ones are blocked; a human approves the exact action hash; changed action = new hash = no approval; timeout = deny. Agent-independent.
- **capture** — universal CLI wrapper `truthlens run -- <agent cmd>`: start → outputs → tests → evidence → finish. Witnesses only what passes through it. OpenCode first, Hermes second.
- **mcp** — stdio MCP server, read-only: `list_runs`, `list_artifacts`, `get_artifact`, `get_evidence`, `verify_ledger`, `get_projection`. Reads projection + store; never writes the ledger.
- **web** — React viewer: Markdown, diff, test report, timeline, approvals; Developer lens (everything) and Client lens (results, status, trust levels).
- **cli** — `init`, `run`, `verify`, `rebuild`, `approve`, `serve`, `mcp`.

## Data flow
1. `truthlens run` writes `run.started`, launches the agent.
2. Risky actions routed through the wrapper hit `core.gate` → `action.requested` → `action.blocked` → `approval.*` → `action.executed` only if granted.
3. On finish the wrapper hashes outputs into the artifact store (`artifact.recorded`), runs tests (`test.reported`), attaches evidence, writes `run.finished`.
4. `rebuild` verifies the chain and regenerates SQLite; web and MCP read only from projection + store.

Stack: Python 3.12 + 3.13 (CI matrix) stdlib-first core, pytest; Vite + React + TypeScript web; GitHub Actions.
