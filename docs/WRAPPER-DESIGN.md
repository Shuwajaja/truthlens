# Process wrapper – design (Week 2)

`truthlens run --ledger <dir> [--criteria file] [--test "<cmd>"] -- <agent command…>`

The wrapper is the only witness. Everything the agent prints is a claim; everything the wrapper observes itself is evidence.

## Sequence (one ledger per run)
1. **Before:** record `run.started {repo, ref, command, agent}`; `requirement.recorded` / `criterion.recorded` from the criteria file (human = `source=user`); derived criteria stay `proposed` until `truthlens confirm` (human, D22–D24). Snapshot: `git rev-parse HEAD`, `git status --porcelain`, `git diff` (staged + unstaged) → blob store, `evidence.attached {kind: file_changed, result: info}`.
2. **Run:** spawn the agent as child process (argument list, no shell), stdin closed (`</dev/null`), env filtered (only allow-listed vars + the provider key the agent needs; the key never enters the ledger – redaction + it is never logged). Known nonempty secrets are replaced exactly, including short values. stdout/stderr captured to the blob store (redacted copy), `evidence.attached {kind: command_run, result: info, refers_to: exit_code}`.
3. **Claims:** the agent's final message / exit summary → `agent.claim` (actor.kind=agent). Optional claim mapping via `criterion_ids` in JSON trailers; every valid recognized trailer is recursively redacted and serialized before storage, while claim extraction keeps its last-trailer behavior. Malformed trailers follow ordinary text scrubbing; other stdout and diffs are not JSON-decoded. Without a valid trailer, claims remain unmapped → `claim_unwitnessed`.
4. **After:** second git snapshot; diff before→after stored as blob, one `artifact.recorded` per changed file (sha256 of file content, provenance `original`).
5. **Witnessed tests:** the wrapper itself runs `--test` command(s) after the agent exits (fresh process, env without provider key), stores the report, writes `test.reported {passed, failed, skipped, criterion_ids}` as `actor.kind=wrapper`. Agent-run tests are only claims.
6. **Close (D28):** `run.finished {exit_code, status, last_hash}` → manifest via `build_manifest()` → `manifest.json` + its sha256 next to the ledger.

## Trust boundaries
- The agent runs in the same user account in the MVP → it could tamper with files the wrapper reads later. Mitigation in MVP: the ledger is HMAC-signed with a key passed to the wrapper only (not in the child env); post-run evidence is hashed immediately; verify detects later edits. Out of scope: OS-level sandbox (documented limitation).
- Approval gate (separate PR, needs-codex-review): controlled actions are executed **by the wrapper** on request (file/socket protocol), never by the agent's own shell; the agent cannot write `approval.granted` because it lacks the HMAC key and the CLI `truthlens approve` runs outside the child env (D17, D30).

## Agents (order)
OpenCode (`opencode run --dir <wt> -m openrouter/… "<task>" </dev/null`) → Aider via OpenRouter → one short Codex CLI run (`codex exec … </dev/null`).

## Demo
`docs/DEMO-TASK.md`: c1 page exists (wrapper test → met), c2 email validation (wrapper unit test → met/unmet), c3 mobile layout (no witness → unverified while agent claims done).
