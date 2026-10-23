# Process wrapper – design (Week 2)

`truthlens run --ledger <dir> [--criteria file] [--test "<cmd>"] -- <agent command…>`

The wrapper is the only witness. Everything the agent prints is a claim; everything the wrapper observes itself is evidence.

## Sequence (one ledger per run)
1. **Before:** record `run.started {repo, ref, command, agent}`; `requirement.recorded` / `criterion.recorded` from the criteria file (human = `source=user`); derived criteria stay `proposed` until `truthlens confirm` (human, D22–D24). Snapshot: `git rev-parse HEAD`, `git status --porcelain`, `git diff` (staged + unstaged) → blob store, `evidence.attached {kind: file_changed, result: info}`.
2. **Run:** spawn the agent as child process (argument list, no shell), stdin closed (`</dev/null`), env filtered (only allow-listed vars + the provider key the agent needs; the key never enters the ledger – redaction + it is never logged). stdout/stderr captured to the blob store (redacted copy), `evidence.attached {kind: command_run, result: info, refers_to: exit_code}`.
3. **Claims:** the agent's final message / exit summary → `agent.claim` (actor.kind=agent). Optional claim mapping via `criterion_ids` in a JSON trailer; otherwise unmapped → `claim_unwitnessed`.
4. **After:** second git snapshot; diff before→after stored as blob, one `artifact.recorded` per changed file (sha256 of file content, provenance `original`).
5. **Witnessed tests:** the wrapper itself runs `--test` command(s) after the agent exits (fresh process, env without provider key), stores the report, writes `test.reported {passed, failed, skipped, criterion_ids}` as `actor.kind=wrapper`. Agent-run tests are only claims.
6. **Close (D28):** `run.finished {exit_code, status, last_hash}` → manifest via `build_manifest()` → `manifest.json` + its sha256 next to the ledger.

## Trust boundaries
- The agent runs in the same user account in the MVP → it could tamper with files the wrapper reads later. Mitigation in MVP: the ledger is HMAC-signed with a key passed to the wrapper only (not in the child env); post-run evidence is hashed immediately; verify detects later edits. Out of scope: OS-level sandbox (documented limitation).
- Approval gate (separate PR, needs-codex-review): controlled actions are executed **by the wrapper** on request (file/socket protocol), never by the agent's own shell; the agent cannot write `approval.granted` because it lacks the HMAC key and the CLI `truthlens approve` runs outside the child env (D17, D30).
- Gate snapshots count directories, symlinks and files toward the entry limit; copied directories regain their exact approved modes after population, deepest first. Temporary-tree creation failure after approval reservation produces outcome evidence with exit 127 and leaves that approval consumed.
- Gate requests are regular files only, opened without following symlinks or blocking on FIFOs, and read up to 64 KiB plus one overflow byte. Invalid requests receive a static error. Responses use an exclusively created temp, flush and fsync before atomic replacement, and clean that owned temp on failure while preserving pre-existing collision paths.
- Gated command output is scrubbed before its informational digest: all nonempty effective environment values (explicit environment, or inherited environment when none is supplied) and HMAC-key bytes are replaced in one longest-first pass, then generic redaction patterns run. Plain `[REDACTED]` markers and non-UTF8 round-tripping are used; no raw output blob or raw-output digest is recorded. Harmless environment values may also be conservatively redacted; this digest does not promote trust.
- Gate delivery (#49): a request filename identifies one immutable execution attempt within its run. Its bounded, namespaced D3 `request_id` is stored on the existing signed `action.executed` reservation before execution. A separate regular, no-follow lock under the existing anchor directory serializes request-bearing actions per canonical ledger path through outcome recording. Replays check ledger integrity and rollback anchors, then return the signed system gate `command_run` outcome linked to that reservation, even after run closure. Agent-authored lookalikes and unsigned reservations cannot supply trusted replay results. A reservation without outcome returns rc 2 / `indeterminate`; investigate before deliberately submitting a new request with a new approval. It is never automatically executed again. CLI actions without a request ID retain their existing behavior.
- Responses are fsynced and atomically published, followed by an inbox-directory fsync, before the request is removed and the directory synced again. Publication failure retains the request so a later poll or restarted server can replay its recorded outcome without consuming another approval. A conflicting response directory is renamed to a unique hidden quarantine sibling; its contents remain intact for operator cleanup. The client generates a fresh filename for each intentional new request, allowing a separately approved repeated action. No separate result store, raw command/output cache, schema change or approval reuse is introduced.

## Agents (order)
OpenCode (`opencode run --dir <wt> -m openrouter/… "<task>" </dev/null`) → Aider via OpenRouter → one short Codex CLI run (`codex exec … </dev/null`).

## Demo
`docs/DEMO-TASK.md`: c1 page exists (wrapper test → met), c2 email validation (wrapper unit test → met/unmet), c3 mobile layout (no witness → unverified while agent claims done).
