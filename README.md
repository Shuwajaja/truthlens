# TruthLens

**AI work you can see, inspect, verify and reuse.**

AI agents (OpenCode, Hermes, Claude Code, …) produce documents, code changes, test reports and decisions scattered across terminals and folders. TruthLens records a run as a self-contained work package — events in a tamper-evident ledger, artifacts with a manifest, evidence, approvals — and shows it in one place for developers and clients. It is honest about what it can prove: see [docs/TRUST-LEVELS.md](docs/TRUST-LEVELS.md).

> Status: **Schema frozen (v1).** Event Schema v1 and Artifact Manifest v1 are FROZEN. Live progress: [docs/STATUS.md](docs/STATUS.md). The week plan is an effort estimate, not approval phases; a minimal approval gate lands early (W2), W4 hardens and integrates it.

## Golden Path v1
1. A real OpenCode run edits a small GitHub project through the TruthLens CLI wrapper.
2. TruthLens captures produced Markdown files, code changes (diff) and test results.
3. A risky action is **blocked** and only executes after an approval bound to the exact action hash.
4. The ledger records the provable steps and references unmodified, hash-addressed artifacts.
5. The browser renders the run in a Developer lens and a Client lens.
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
- [Event Schema v1 (draft)](docs/spec/event-schema-v1.md)
- [Artifact Manifest v1 (draft)](docs/spec/artifact-manifest-v1.md)
- [Trust levels](docs/TRUST-LEVELS.md)

## License
**TBD** — pending the provenance and license review in [docs/INVENTORY.md](docs/INVENTORY.md). Until then, all rights reserved; no code is ported before the review is done.
