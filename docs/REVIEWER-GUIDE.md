# Reviewer guide

Start with the [README's offline walkthrough](../README.md#try-it-in-1-minute).
This reference covers development, capture and the deeper CLI surface. Current
completion evidence belongs in [STATUS](STATUS.md), not the original week plan.

## Development checks

Use Python 3.12+ and Node 24 (matching CI). The viewer declares Node >=22.19;
locked developer dependencies can require newer Node 22 patch releases.
Installing Python developer tools or npm packages normally requires network
access unless the required packages are already cached.

From the repository root:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
pytest -q -ra
TZ=Europe/Berlin pytest -q -ra
ruff check src tests
python3 -m unittest tests.test_readme -q
cd viewer
npm ci
npm run lint
npm run check:styles
npm run check:language
npm run check:theme
npx --no-install vitest run
npm run build
node --check ../integrations/agent-zero-acp/audit-status.cjs
node --test ../integrations/agent-zero-acp/audit-status.test.cjs
```

These are local checks, not a claim of a live service or real user approval.
Python tests include tampering, redaction, approval replay, wrapper isolation,
read-only APIs and projections. `tests/test_round5.py` checks that legacy evidence
MCP withholds reports and timelines for a wrong key or truncated ledger.
Separate-UID tests skip without their local account/sudo prerequisites; the
same-UID attack is an expected failure. Neither outcome is a security pass.

Fast PR CI runs static viewer checks, Vitest and a build. The broader `npm test`
also includes the retained toolbar build matrix for manual/release review.
Browser screenshots and unrestricted axe remain separate manual checks; use
[UI-PIPELINE](UI-PIPELINE.md) for the binding review requirements.

## Fresh capture

The [demo script](../demo/run-demo.sh) accepts an output directory and optional
`--offline`. It needs Git, an installed TruthLens CLI and pytest. Offline mode
uses a **scripted fake agent**, records real subprocess evidence, and deliberately
leaves email validation broken. It expects `c1 met`, `c2 unmet`, `c3 unverified`,
and an unwitnessed completion claim. It verifies the run, exports viewer JSON,
and alters a copy to demonstrate fail-closed tamper detection.

The script creates a temporary signing key outside the run and checkout, deletes
that key on exit, and passes `--confirm` for the demo criteria. Those automated
confirmations are **simulated**, not evidence of a real human's confirmation or
approval. Keep signing keys out of the agent's identity in any real use.

Without `--offline`, the script runs OpenCode through OpenRouter and requires
`opencode` on PATH and `OPENROUTER_API_KEY` in the invoking environment. Outcomes
must be read from that run rather than assumed. See the [demo criteria](DEMO-TASK.md)
and [committed real recordings](DEMO-RUNS.md). The full golden path additionally
includes a risky action blocked until exact-action human approval, captured
Markdown/diff/test artifacts, Client and Developer Lens review, legacy human
read-only MCP access, and a deliberate tamper check. A demo run alone does not
establish isolated production operation.

## CLI reference

The following is command syntax, with placeholders rather than copy/paste values.
Use `python3 -m truthlens --help` with `PYTHONPATH=src` from a source checkout,
or the installed `truthlens` entry point.

| Command | Purpose |
|---|---|
| `truthlens run --out DIR [OPTIONS] -- AGENT` | Capture one run: Git before/after, output as claims, wrapper-started tests, manifest. Key file and key ID required. |
| `truthlens request -- COMMAND` | Inside a run, ask for a gated action; blocked until human approval. |
| `truthlens approve LEDGER HASH` | Approve exactly one action; single use, expires after 10 minutes. |
| `truthlens verify LEDGER [--expect-last-hash HASH]` | Fail-closed ledger check; supply a key for HMAC verification. |
| `truthlens report DIR` / `export DIR` / `project DIR` | Criteria and claims versus evidence / viewer JSON / rebuildable SQLite. |
| `truthlens audit DIR --json` | Read-only audit; exits 0 supported, 1 contradiction, 2 required check unavailable. Hash-only cannot exit 0. |
| `truthlens agent-status RUN_ID [--socket PATH] [--json]` | Broker-only status; exit 0/1/2. |
| `truthlens doctor [--socket PATH]` | Read-only diagnostics for humans; isolation remains unverified. |
| `truthlens agent-config CLIENT --socket PATH [--output NEW_PATH]` | Print a client snippet or create only an explicit new file. |
| `truthlens demo-status` | Labelled synthetic temporary fake-broker demo; no real audit. |
| `truthlens mcp-status --socket PATH` | D34 status-only stdio MCP; requires the protected broker. |
| `truthlens mcp --root DIR` | Legacy human evidence MCP: `list_runs`, `run_report`, `run_events`; **not D34-compatible**. |

For `report`, `export` and `project`, pass a run directory containing
`manifest.json` and `ledger.jsonl`, rather than either file itself. An unreadable
manifest or one that is not a UTF-8 JSON object produces a `FAIL` diagnostic and
exit code 1 without writing an export or projection. Check the directory and
manifest readability; malformed JSON requires an intact copy of the recorded
run, not edits to its evidence.

`run` options include `--criteria`, `--confirm`, `--test 'c1=COMMAND'`,
`--pass-env`, `--gate-env`, `--hmac-key-file` and `--hmac-key-id`. Human criteria
confirmation and approval must follow the frozen actor/signature rules.
The gate controls wrapper-held capabilities, not every action an agent can take.

For audit authentication, `--hmac-key-file` accepts an owner-only regular file
outside the run directory (1–4096 bytes; surrounding whitespace stripped).
`--expect-last-hash` accepts a lowercase SHA-256 digest. Audit has no environment
key fallback, repair, rerun, output-file write or network access. See the
[audit contract](spec/audit-verifier-v1.md).

Legacy human evidence MCP client configuration (never an agent-status fallback):

```json
{"command": "python", "args": ["-m", "truthlens", "mcp", "--root", "demo/runs"]}
```

Agent clients must instead use the [G1 status boundary](SELFHOST-MCP.md)
and [G2 client setup](AGENT-SETUP.md).

## Viewer development and screenshots

Development serves the committed recorded export. A production build starts
disconnected without it; users may explicitly open local files/folders or connect
to a configured private reader. There is no public live demo here. Existing
platform settings do not establish a tested live comments flow.

For a browser-ready machine, from `viewer/`:

```bash
PLAYWRIGHT_BROWSERS_PATH=../.venv/playwright npx --no-install playwright install chromium
npm run review:screenshots
```

The browser download needs network access if not cached. The helper starts a
local Vite server, checks browser/HTTP errors and stops it afterward. It writes
PNGs to ignored `viewer/.screenshots/` by default; browser binaries stay in the
clone's `.venv/`. It installs no system packages. To publish evidence, set
`WORKSPACE_OUTPUT` to a directory under `docs/screenshots/<branch>/` before
running it. Build first with `npm run build`.

The helper records source commit, browser version, desktop **1440×900** and
mobile **390×844** screenshots, both themes/lenses and unrestricted axe results.
Review serious/critical and incomplete findings before claiming a reviewed pass.
Drawers are captured only when supported by the selected export. For a demo GIF,
record actual navigation with Playwright's `recordVideo`, finalize the context,
then convert locally; retain the original recording and source commit.

The README images are supplied Chromium captures of the current viewer with a
local recorded test run; they were copied unchanged, not generated by this docs
change. They do not imply a new axe or browser-flow pass. An earlier 25 October
2026 capture attempt was blocked by a missing browser library and produced no
new screenshot/GIF/axe pass. Older fixture captures remain available:

- [Demo GIF](screenshots/truthlens-demo.gif) and [source recording/axe](screenshots/source/)
- [Overview](screenshots/truthlens-overview.png) · [Event inspector](screenshots/truthlens-event.png)
- [Claims versus evidence](screenshots/truthlens-claimed-vs-proven.png) · [Timeline](screenshots/truthlens-timeline.png)
- [Agent Story](screenshots/truthlens-agent-story.png) · [Mobile navigation](screenshots/truthlens-mobile-navigation.png)
- [Workspace review](screenshots/w5/issue-156-workspace-phase-a/review-summary.md), tied to its listed source commits

The renderer registry changes presentation; lens/drawer settings are separate
from recorded inputs. Pre-migration snapshots cover the real demo export; the
combined diff/Markdown drawer uses labelled synthetic Markdown because that
export contains none. Agent Story orders supported recorded events by `seq`,
opens exact events, and displays exported statuses without deriving verification.
Unknown types are omitted; missing events are never inferred. Claim steps stay
neutral grey (including supported claims); only `met` criteria can appear green.
“Review required” is a separate policy note, not a recorded event or export status.
The integrity notice remains visible; its floating badge clears the drawer Close
button at narrow widths.

## Original delivery plan (historical)

This was a four-week effort estimate, not current status or approval phases:

| Week | Planned deliverable | Acceptance goal |
|---|---|---|
| W1 | Truth core, frozen schema, ledger, redaction, CLI, CI | Detect tampering under key separation. |
| W2 | Artifacts, capture adapter, atomic projections, minimal gate | Record a real agent run as a complete package. |
| W3 | Web renderers, timeline, Client/Developer lenses | Follow a real run in the browser. |
| W4 | Gate hardening, read-only MCP, tamper demo, docs/video | Reproducible end-to-end golden path. |

The intended cut order was extra renderers and a second adapter first; integrity
tests were never optional. Use [STATUS](STATUS.md) for actual completion and limits.
