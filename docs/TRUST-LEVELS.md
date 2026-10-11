# Trust levels

| Label | Meaning |
|---|---|
| **Imported** | File was imported; its origin and execution are not independently evidenced. |
| **Integrity verified** | Hashes and existing evidence match the ledger; chain verifies. |
| **Review required** | Technical checks exist; human/domain acceptance is still open. Orthogonal to integrity: shown alongside "Integrity verified". Client Lens shows it by default (D7). |
| **Verification failed** | Hash, chain, HMAC or anchor check failed. Never shown as verified; the failing line and reason are displayed. |

Principles:
- **Scope of proof:** TruthLens proves the integrity and provenance of what it witnessed — not the quality, correctness or completeness of the work.
- **Claimed ≠ witnessed.** An `agent.claim` ("all tests green") is shown as a claim; only wrapper-produced `test.reported`/evidence counts. Unwitnessed claims are flagged.
- **A valid hash does not prove the agent told the truth.** It proves the record has not changed since it was written.
- **The wrapper only witnesses what passes through it** or is explicitly handed to it. It cannot attest internal agent actions.
- "Verified" is only shown for things TruthLens observed at runtime. GitHub imports are at most "Imported".
- **Approvals must actually block.** An `approval.granted` event alone proves nothing; the gate must have prevented execution beforehand.
- **A changed action invalidates the approval** (different action hash). Approvals are single-use.
- **Timeout = deny** (`approval.expired`).
- Execution ≠ Verification ≠ Approval ≠ Acceptance.

## Lenses
- **Client Lens (primary):** plain language per request/criterion — "You asked for X — done, witnessed by Y", "claimed, not witnessed", "not done", "review required".
- **Developer Lens (detail):** events, hashes, diffs, logs, verification output.

## HMAC key and approval gate – what is protected, what is not (MVP)
- The agent runs as a child of `truthlens run` with an allow-listed env: it never receives the HMAC key, the provider key only if `--pass-env`, and gated capabilities (`--gate-env`, e.g. a deploy token) never.
- Gated actions: the agent can only *request* them (`truthlens request -- <cmd>` → inbox `<out>/gate/`). The wrapper records `action.requested` + `action.blocked`; a human approves with `truthlens approve <ledger> <hash>` (signed with the key); the wrapper executes once with the capability env and records `action.executed`. The agent cannot write a valid approval: without the key every append to a signed ledger is refused / fails verify.
- Key handling: `truthlens run` requires `--hmac-key-file` (outside the repo and the run dir, `chmod 600`) and refuses to run without a key. The key is never placed in any environment, because a same-UID child can read `/proc/<ppid>/environ`.
- Git is called with a fixed env and `core.hooksPath=/dev/null`, `diff.external=`, `core.fsmonitor=false`, `--no-ext-diff`, so agent edits to `.git/config` cannot run code during capture.
- Witnessed tests run in a temporary copy of the post-run tree in which test files and test config (`tests/`, `test_*.py`, `conftest.py`, `pytest.ini`, `pyproject.toml`, …) are restored to their pre-run content, with a fresh `HOME`, fixed `PATH` and no keys. Agent edits to tests are recorded as `test_files_changed` and never counted.
- Blobs (diffs, file contents, command headers, outputs) are redacted before storage; symlinks are recorded as link text, never followed.
- The gate re-verifies the ledger (with the key) before acting, requires a valid UTC `expires_at`, and records `action.executed` **before** running the command.
- **The gate is not a sandbox.** It protects only actions that need a capability the agent does not hold (`--gate-env`) and that go through `truthlens request`. Files a command opens by itself outside the working dir (e.g. absolute `source` inside a script) are not bound in v1 (post-v1).
- **Residual risk:** the agent runs under the same OS user. If it knows the key file path it can read it and forge signed events. Real isolation needs a separate OS user/container or a key held by another process (post-MVP). The gate also only controls actions that need the gated capability; anything the agent can do with its own permissions it can still do directly (and the wrapper sees only the resulting git changes).
- `truthlens run --test-user tl-agent --test-path <venv/bin>` runs the witnessed tests via `sudo -n -u tl-agent env -i` in the clean copy (leftover tl-agent processes are killed first). Test code then cannot read the HMAC key, the rollback anchors (`~/.truthlens/anchors`) or other box-user secrets. Code inside the pytest process itself can still influence its own results; only restored tests and blocked import hooks limit that.
- **Witnessed tests, limit:** counts come from pytest's JUnit XML (path via `PYTEST_ADDOPTS`, outside the copy), never from stdout; a non-zero exit is always a failure. Code under test runs in the same process as pytest and can still forge its own result (e.g. write the XML and `os._exit(0)`). TruthLens cannot authenticate results produced inside the tested process; a "met" from witnessed tests means "the restored test command reported success", not "the code is correct". Separate UID (`--test-user`) only protects keys/anchors, not this.

## Same-UID risk for workers (2026-10-11)
**Bei gleicher UID kann sich der Agent selbst freigeben; Schutz erst mit eigenem Unix-User/Sandbox.**
- A worker running as the box user can read everything that user can: the HMAC key file (path visible in `/proc/$PPID/cmdline`, also via `/proc/$PPID/fd`, `/proc/$PPID/mem` or by searching), the Cursor token in `~/.cursor`, the `gh` token and the OpenRouter key. Hiding the key path is not a fix. `tests/test_round5.py::test_a_same_uid_agent_cannot_read_key` performs this attack and is marked xfail (known risk).
- Mitigation started: a dedicated Unix user `tl-agent` (owner-approved 2026-10-11 05:00) with its own home `/srv/tl-agent` and worktree root `/srv/tl-agent/wt`. Run as `sudo -u tl-agent env -i ...`, the same attack sees the key path but cannot read the key (`test_a_separate_uid_agent_cannot_read_key`, local only).
- Not done yet: `tl-cycle.sh` workers (OpenCode, Cursor) still run as the box user; moving them to `tl-agent` needs their binaries/logins under `/srv/tl-agent`. Until then every run on this box is same-UID.

- **Accepted v1 limit (Shu, 2026-10-11):** "met" means the restored test command reported success; app code running in the test process can forge it.

- **Known limit (gate snapshot execution):** an approved action runs a private copy of the bound program bytes inside the snapshot directory. Interpreters that locate their stdlib relative to the binary (uv-managed / relocatable Python builds) cannot start from such a copy, so approved actions using them fail. Use a system interpreter (e.g. `/usr/bin/python3`) for gated actions.
