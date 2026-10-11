# TruthLens

**See what your AI agent really did.**

For vibe coders and anyone handing work to AI agents — coding, research, writing, admin. Agents produce documents, file changes, visited sources, sent messages, commands and test runs scattered across terminals and folders, and then *tell* you it went well. TruthLens records a run as a self-contained work package — events in a tamper-evident ledger, artifacts with a manifest, evidence, approvals — and shows it in plain language: *"You asked for X — done, witnessed by Y"* or *"claimed, not witnessed"* (Client Lens, primary view), with a Developer Lens for full detail. The v1 capture adapter is OpenCode (code work); the model is agent- and task-agnostic. It is honest about what it can prove: see [docs/TRUST-LEVELS.md](docs/TRUST-LEVELS.md).

## Quickstart (reproducible demo)
```bash
pip install -e '.[dev]'
demo/run-demo.sh /tmp/tl-demo --offline   # scripted agent, no API key, deterministic
demo/run-demo.sh /tmp/tl-demo2            # real OpenCode run (OPENROUTER_API_KEY, opencode on PATH)
cp /tmp/tl-demo/run.json viewer/public/run.json && cd viewer && npm i && npm run dev
```
Expected: c1 `met`, c2 `unmet`, c3 `unverified`, the agent's "all done" claim `claim_unwitnessed`, and the tampered copy fails `verify`. Recorded real runs: [docs/DEMO-RUNS.md](docs/DEMO-RUNS.md).

## CLI
| Command | What it does |
|---|---|
| `truthlens run --out DIR [--criteria F --confirm ids --test 'c1=CMD' --pass-env VAR --gate-env VAR --hmac-key-file F] -- <agent>` | witnesses one agent run (git before/after, agent output as claims, tests run by TruthLens, manifest) |
| `truthlens request -- <cmd>` | (inside a run, agent side) ask for a gated action – blocked until a human approves |
| `truthlens approve LEDGER HASH` | human approval for exactly one action, single use, expires after 10 min |
| `truthlens verify LEDGER [--expect-last-hash H]` | fail-closed integrity check |
| `truthlens report DIR` / `export DIR` / `project DIR` | criteria + claims vs witnessed / viewer JSON / SQLite projection |
| `truthlens mcp --root DIR` | read-only MCP server over stdio (`list_runs`, `run_report`, `run_events`) |

The approval gate is **not a sandbox**: it protects actions that need a capability only the wrapper holds; the agent's own shell is unrestricted (same OS user). See [TRUST-LEVELS](docs/TRUST-LEVELS.md).

MCP client config example: `{"command": "python", "args": ["-m", "truthlens", "mcp", "--root", "demo/runs"]}`.

> Status: **Schema frozen (v1).** Event Schema v1 and Artifact Manifest v1 are FROZEN. Live progress: [docs/STATUS.md](docs/STATUS.md). The week plan is an effort estimate, not approval phases; a minimal approval gate lands early (W2), W4 hardens and integrates it.

## Golden Path v1
1. A real OpenCode run edits a small GitHub project through the TruthLens CLI wrapper.
2. TruthLens captures produced Markdown files, code changes (diff) and test results.
3. A risky action is **blocked** and only executes after an approval bound to the exact action hash.
4. The ledger records the provable steps and references unmodified, hash-addressed artifacts.
5. The browser renders the run in the Client Lens (primary, plain language) and the Developer Lens (detail).
6. A read-only MCP server returns the same information to an external client.
7. After deliberate tampering, `truthlens verify` fails reproducibly and names the line.

## Scope / non-goals
In scope: ledger, verification, redaction, artifact manifest, evidence store, SQLite projections, one capture adapter (OpenCode), approval gate, read-only stdio MCP, web viewer.

Not in v1: comments fed back to agents, cloud sync/hosted storage, multiple agent adapters (Hermes only if time remains), teams/accounts/billing, write access over MCP, remote MCP endpoint, agent orchestration.

## 4-week plan
| Week | Deliverable | Acceptance |
|---|---|---|
| W1 Truth Core | Event Schema v1, ledger, verify, redaction, CLI, CI, tests | A tampered ledger is reliably detected |
| W2 Artifacts & Capture | Artifact Manifest, evidence store, universal CLI wrapper (start → outputs → tests → evidence → finish), one real OpenCode capture, atomic SQLite projections | A real agent run becomes a complete, reproducible work package |
| W3 Web | React UI: Markdown, diff, test reports, timeline, Developer/Client lens | A real run can be followed in the browser |
| W4 Integration & Portfolio | Approval gate hardening/integration (minimal gate already in W2), read-only stdio MCP, tamper demo, GitHub Actions, docs, video | End-to-end reproducible Golden Path |

**Cut order if late:** extra renderers and the second adapter first. Integrity tests are never cut.

## Docs
- [Inventory & provenance](docs/INVENTORY.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Event Schema v1 (frozen)](docs/spec/event-schema-v1.md)
- [Artifact Manifest v1 (frozen)](docs/spec/artifact-manifest-v1.md)
- [Trust levels](docs/TRUST-LEVELS.md)
- [All docs index](docs/README.md) · [Design v2](DESIGN.md) · [Wrapper design](docs/WRAPPER-DESIGN.md)

## License
**TBD** — pending the provenance and license review in [docs/INVENTORY.md](docs/INVENTORY.md). Until then, all rights reserved; no code is ported before the review is done.

> **Security note:** Bei gleicher UID kann sich der Agent selbst freigeben; Schutz erst mit eigenem Unix-User/Sandbox. The approval gate is not a sandbox. See `docs/TRUST-LEVELS.md`.
