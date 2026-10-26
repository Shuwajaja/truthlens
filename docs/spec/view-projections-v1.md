# View projections v1

This document describes the human run view. It does not add a decision to the
frozen event schema, artifact manifest, or trust-level contracts. A run view is
a projection of a ledger and manifest. It is not a replacement ledger, not an
audit, and not a D34 broker status.

## Commands

Existing commands keep their contracts.

- `truthlens init LEDGER` creates a ledger. It is not a workspace wizard.
- `truthlens doctor` stays the read-only status doctor and still exits 2.
- `truthlens mcp --root` stays a human evidence tool. It is not installed for
  agents, and this projection does not add `mcp install`.
- `truthlens agent-status` stays exit 0, 1 or 2 and still returns only a status.

New human commands:

- `truthlens workspace init|unlink|doctor|test|repair`
- `truthlens runs list|show|recheck|import`

`TRUTHLENS_REFERENCE=0` makes those commands exit 2. It does not delete ledgers.
`truthlens --help` does not list them, because they are dispatched before the
legacy parser. Each subcommand prints its own usage.

`--json` prints one object on stdout. Progress stays on stderr. `--quiet`,
`--no-color` / `NO_COLOR`, `--config` and `--root` apply to the new commands.
Changes require `--dry-run` or an explicit `--yes`. There is no TTY prompt.
Missing required values exit 2.

| Exit | Meaning |
|---|---|
| 0 | The command completed. A shown refuted run is still success. |
| 1 | Validation or operation failure, including a revision conflict. |
| 2 | Usage, or the feature flag is off. |
| 3 | `workspace doctor --strict` found a warning. Without `--strict`, warnings exit 0. |
| 4 | The reader target is unreachable. The message does not echo the URL. |

`workspace doctor` is read-only. Isolation is `unverified` and counts as a
warning, so `--strict` exits 3. It never reports that the host is safe. A
remote URL, an absolute path, or `..` in `.truthlens/reader-target` is not
fetched.

## Review summary

Counts are recomputed from claims. The view is rejected when they disagree,
when the stored summary disagrees, when integrity is `failed`, or when a
confirmation has no witness.

1. Any refuted claim makes the run refuted.
2. Otherwise the run is unclear when any claim is unclear, there are no
   claims, execution is not `completed`, the audit is not `complete`, or
   integrity is `unknown`.
3. Otherwise the run is confirmed. That requires integrity `hash-only` or
   `hmac` on a projection that still has its witness. A self-declared `hmac`
   on import is downgraded.

One refuted claim is enough. There is no threshold of two. Imported
completions are not confirmed. A benchmark or performance claim stays unclear
unless a witnessed test matches that claim. An extension cannot append witness
event types. A status reader cannot start a run.

`audit_state=complete` is stored only when a recheck conclusion is
`supported_within_scope` or `contradictory`. Anything else stays
`unavailable`, so an uncheckable audit cannot unlock “confirmed”. Recheck
does not run the agent again. `--expected-revision` must match or the command
exits 1 without writing.

`workspace test` writes a local ledger before the process, marks the record
`synthetic` and `excluded_from_metrics`, and leaves the review unclear. The
run can be listed. It is not part of the success rate.

## Capture boundary

Only harness `agent-zero` with `qualified_harness_version` exactly
`test-fixture` may open a durable ledger before a local test execution. Any
other version, including an empty version, returns not qualified and writes
no run. This is a fixture gate. It is not a qualified live Agent Zero,
Codex, Claude Code or agy launcher. Ordinary chats stay uncaptured.

Import copies `ledger.jsonl` only, quarantines it, and projects it as
imported hash-only evidence. A view that asserts confirmed without events is
rejected. A view whose claim verdicts disagree with the events is rejected.

## Schemas

`schemas/run-view-v1.schema.json`, `schemas/workspace-config-v1.schema.json`
and `schemas/diagnostic-report-v1.schema.json` are Draft 2020-12 and set
`additionalProperties` to false. The viewer demo catalog is not itself a run
view: each item may also carry `demo`, `synthetic` and a `display` sidecar.
Those fields are removed before the projection consistency check. The hub
result schema belongs to the other repository and is not implemented here.
