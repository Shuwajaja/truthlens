# View projections v1

This document describes the human run view. It does not add a decision to the
frozen event schema, artifact manifest, or trust-level contracts. A run view is
a projection of a ledger and manifest. It is not a replacement ledger, not an
audit, and not a D34 broker status.

## Commands

Existing commands keep their contracts.

- `truthlens init LEDGER` creates a ledger. It is not a workspace wizard.
  With `TRUTHLENS_REFERENCE=1` and no ledger path, `truthlens init` detects a
  local adapter and writes the workspace plus `.truthlens/hooks/task-end`.
  That hook appends an agent report. It does not open a ledger.
- `truthlens doctor --socket` stays the read-only status doctor and still exits 2.
- `truthlens doctor` with no socket flag is the local catalog readiness scan.
  It checks the runs directory, whether the named key env var is set, and
  which harnesses are installed. It does not print config contents or key
  values, and it does not write.
- `truthlens setup` prints or writes one local MCP entry. It stores the env
  var name, not the key value, and it copies an existing file to `.bak`
  before replacing it.
- `truthlens mcp --root DIR` stays a human evidence tool. It is not installed
  for agents, and this projection does not add `mcp install`. Its tools stay
  `list_runs`, `run_report` and `run_events`.
- `truthlens mcp` with `TRUTHLENS_ROOT` and no `--root` is a separate local
  read-only catalog. Its tools are `list_runs`, `get_run`, `verify_run` and
  `doctor`. It does not replace `truthlens mcp-status`. `TRUE` / `bestätigt`
  and `FALSE` / `widerlegt` require integrity `hmac`; otherwise the verdict
  is `UNKNOWN` / `unklar`, or `not_checkable` when the file cannot be
  checked. The catalog does not use the network and does not write.
- `truthlens mcp-status` stays the separate status tool
  `truthlens_check_status`. Its result stays `passed`, `failed` or
  `not_checkable`. It does not return claims, events or evidence.
- `truthlens agent-status` stays exit 0, 1 or 2 and still returns only a status.

New human commands:

- `truthlens workspace init|unlink|doctor|test|repair`
- `truthlens runs list|show|recheck|import`

`truthlens workspace doctor` and `truthlens runs list` run without
`TRUTHLENS_REFERENCE`. The other new commands (`workspace
init|unlink|test|repair`, `runs show|recheck|import`, and bare `truthlens
init` without a ledger path) stay off unless `TRUTHLENS_REFERENCE` is exactly
`1`. When the variable is unset, the default for those commands is off.
Empty, `0` and every other value also exit 2. Turning them off does not
delete ledgers.
`truthlens` with no arguments prints a start banner and exits 0. Colour is
used only on a TTY, and never when `NO_COLOR` or `--no-color` is set.
`truthlens workspace doctor` prints the same banner, then its checks and a
summary `N ok · N Warnung · N Fehler`. `truthlens doctor` stays the read-only
status doctor. `truthlens runs list` adds a `ZEIT` column to the human table.
`truthlens --help` does not list the new commands, because they are
dispatched before the legacy parser. Each subcommand prints its own usage.

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
   integrity is `unknown`. A benchmark claim without a witnessed matching
   test stays unclear (`reason_code=benchmark_missing`).
3. Otherwise the run is confirmed. That requires integrity `hash-only` or
   `hmac` on a projection that still has its witness. A self-declared `hmac`
   on import is downgraded.

Human CLI text and the reference viewer show TRUE or FALSE only when
integrity is `hmac`. Hash-only, unknown, failed, and missing integrity
display UNKNOWN, including a stored confirmed or refuted summary. A doubtful
test (`benchmark_missing`) is UNKNOWN even on an HMAC run, unless that run is
refuted. `--json` keeps `confirmed`, `refuted` and `unclear`. The reference viewer
areas are Übersicht, Prüfdetails and Nachweise. Technical timeline events
are inside a closed developer disclosure. There is no task store, no
orchestration panel and no artifact gallery.

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

Production `start_run` does not read `workspace.toml` and does not open a
ledger. A value such as `qualified_harness_version = "test-fixture"` in that
file does not qualify a harness. The capture role is not a caller argument.
`_peer_role` returns None in production, so a G1 status peer and a
caller-supplied role string are both refused (`START_REFUSED`) and no run
directory is created. A test may replace `_peer_role`. That replacement is
not a live launcher: `start_run` still returns `NOT_QUALIFIED` and writes
nothing. G1 status peers may query status. They are not capture operators,
and `SO_PEERCRED` is not capture authorization. There is no qualified Agent
Zero, Codex, Claude Code or agy launcher. Ordinary chats stay uncaptured.

Import copies `ledger.jsonl` only, quarantines it, and projects it as
imported hash-only evidence. A view that asserts confirmed without events is
rejected. A view whose claim verdicts disagree with the events is rejected.
An imported view does not keep a self-declared `audit_state`, audit revision
or `task`. With events, the task comes from the ledger `run.started` command
and the audit state is `unavailable`. Without events, the task is `imported`
and the audit state is `unavailable`. A self-declared `hmac` stays hash-only.

## Schemas

`schemas/run-view-v1.schema.json`, `schemas/workspace-config-v1.schema.json`
and `schemas/diagnostic-report-v1.schema.json` are Draft 2020-12 and set
`additionalProperties` to false. The viewer demo catalog is not itself a run
view: each item may also carry `demo`, `synthetic` and a `display` sidecar.
Those fields are removed before the projection consistency check. The hub
result schema belongs to the other repository and is not implemented here.
