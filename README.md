# TruthLens

[![CI](https://github.com/Shuwajaja/truthlens/actions/workflows/ci.yml/badge.svg)](https://github.com/Shuwajaja/truthlens/actions/workflows/ci.yml) [![Spec v1 frozen](https://img.shields.io/badge/spec-v1%20frozen-blue)](docs/spec/event-schema-v1.md) [![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**See what your AI agent really did.**  
*Here's what's actually proven.*

For vibe coders and anyone handing work to AI agents — coding, research, writing, admin. Agents produce documents, file changes, visited sources, sent messages, commands and test runs scattered across terminals and folders, and then *tell* you it went well. TruthLens records a run as a self-contained work package — events in a hash-chained, HMAC-signed ledger, artifacts with a manifest, evidence, approvals — and shows it in plain language: *"You asked for X — done, witnessed by Y"* or *"claimed, not witnessed"* (Client Lens, primary view), with a Developer Lens for full detail. The v1 capture adapter is OpenCode (code work); the model is agent- and task-agnostic. It is honest about what it can prove — see the [Security promise (v1)](#security-promise-v1) below.

## Security promise (v1)

> Tamper detection holds only while the HMAC key stays with the human and the agent runs as a separate Unix user.
> "met" means: the restored test command that TruthLens started reported success; app code running in the test process can forge it (accepted v1 limit).

## Start with your own work

TruthLens opens recorded work as a workspace: overview, results, checks, history
and project notes. Read the result first; expand source details when needed.
The local reader and widgets need **no model API key**. An imported file is a
source report, not a signed verification or human approval.

Requires Python 3.12+ and Node 24. From the repository root:

```bash
python -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[app]'
npm --prefix viewer ci
npm --prefix viewer run build
truthlens import-files --project my-project --output-dir ./my-truthlens report.md screenshot.png
truthlens serve --db ./my-truthlens/catalog.sqlite --static viewer/dist --project my-project
```

Replace `report.md screenshot.png` with your own supported files; use a new output
directory. Open **http://127.0.0.1:4174** on the same machine, then choose a result
from the overview. Files remain local. On another device, `localhost` refers to
that device; this listener is not a hosted service.

For recorded examples instead of your files, replace the last two commands with:

```bash
truthlens catalog rebuild --config demo/workspace/sources.json --db /tmp/truthlens-workspace.sqlite
truthlens serve --db /tmp/truthlens-workspace.sqlite --static viewer/dist --project truthlens
```

Native examples are recorded runs; Factory/OTel/Memory fixtures are labelled
synthetic. See [the workspace guide](docs/WORKSPACE.md) for source refresh,
file limits and saved perspectives, and [the MCP App guide](docs/MCP-APP.md)
for interactive widgets in the local test host. The private web preview supports
explicit snapshot import; it has no connected private backend.

## Reproduce an agent recording

The separate capture demo exercises the ledger and tamper detection:

```bash
python -m pip install -e '.[dev]'
demo/run-demo.sh /tmp/tl-demo --offline   # scripted agent, no API key, deterministic
# Optional real OpenCode run; requires opencode and OPENROUTER_API_KEY:
demo/run-demo.sh /tmp/tl-demo2
```

Expected: c1 `met`, c2 `unmet`, c3 `unverified`, an unwitnessed agent claim,
and the tampered copy fails `verify`. Recorded real runs:
[docs/DEMO-RUNS.md](docs/DEMO-RUNS.md). To inspect a new recording in the workspace, register its directory as a native
source following the workspace guide and rebuild the catalog. Connections imports
`truthlens.workspace/1` exports, not the legacy single-run `run.json` format.

## CLI

The additive local workspace supports projects, multiple runs, imported snapshots,
Memory revisions, safe artifact renderers and read-only navigation. Start with
[the workspace guide](docs/WORKSPACE.md). The bundled Factory/OTel/Memory examples
are explicitly synthetic; original native runs retain their verification limits.

For the optional HTTP MCP server and embedded evidence widget, follow the
[local MCP App guide](docs/MCP-APP.md). It includes a real local host preview;
connecting ChatGPT is a separate host integration step.

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
7. After deliberate tampering, `truthlens verify` fails reproducibly and names the line. Tamper detection holds only while the HMAC key stays with the human and the agent runs as a separate Unix user.

## Scope / non-goals
In scope: ledger, verification, redaction, artifact manifest, evidence store, SQLite projections, one capture adapter (OpenCode), approval gate, read-only stdio MCP, web viewer.

Not in v1: comments fed back to agents, hosted storage or sync, multiple agent adapters, multi-user/billing features, write access over MCP, remote MCP endpoint, agent orchestration.

## 4-week plan
| Week | Deliverable | Acceptance |
|---|---|---|
| W1 Truth Core | Event Schema v1, ledger, verify, redaction, CLI, CI, tests | A tampered ledger is detected (key with the human, agent as separate user) |
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

> **Security note:** Tamper detection holds only while the HMAC key stays with the human and the agent runs as a separate Unix user. With the same UID the agent can approve itself; protection only with a separate Unix user/sandbox. The approval gate is not a sandbox. See `docs/TRUST-LEVELS.md`.
