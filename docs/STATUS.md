## Separate status-reader role — local qualification, 25 October 2026

Branch `fix/status-reader-role`, base `110dbb6`; trial item **4** only.
Code/tests: `845bf448bae088d07ce98eff6f7b20106a461367`; subsequent changes
are documentation only. Red checkpoint `5a01254` recorded **29 failed,
7 passed, 12 setup errors** before the reader dispatch API existed. Malformed
reader configuration was accepted before the fix; green boundary tests now
report **48 passed**. The launcher test's registry mock was also corrected.

Optional protected-profile `status_readers` captures a separate, bounded,
strictly validated reader UID list on new dispatches. Caller-only
`authorized_uids`, detailed caller output and admission/evidence checks remain
unchanged. Readers get only `passed` / `failed` / `not_checkable` through the
existing broker or privileged local status CLI; no launch/admit/approval,
explain or Phase B rights follow. Invalid/overlapping reader configuration
denies launch, unknown UIDs retain identical fixed denials, and old runs gain
no readers. Profile edits affect future runs only, including revocation.
[Operator configuration](../deploy/server/README.md#status-readers-trial-item-4),
[self-host boundary](SELFHOST-MCP.md) and [Agent Zero setup](AGENT-SETUP.md)
describe the separate broker peer/socket prerequisites. G1 wire/client/adapter,
D34 and frozen contracts are unchanged. Integrity is not approval.

Sequential full Python runs using repo-local venv PATH/TMPDIR,
`PYTHONPATH=$PWD/src` and umask022:
`TZ=UTC python -m pytest -q -rs --tb=short --basetemp=.t/sru1` and
`TZ=Europe/Berlin python -m pytest -q -rs --tb=short --basetemp=.t/srb1`
each observed **795 passed, 2 skipped, 1 xfailed, 21 subtests passed**.
The skips need host-only tl-agent/sudo fixtures; the expected failure is the
known same-UID `/proc` risk. Neither proves live isolation.

Viewer `TZ=UTC npm test` and `TZ=Europe/Berlin npm test`, sequentially:
**436 passed / 46 files each**, including static checks and five toolbar builds;
existing jsdom scrollTo notices remain. `ruff check src tests`, format checks
for pipeline/registry/broker/new tests, Viewer lint and production build
(including TypeScript), local setuptools wheel build and source comparison
(33 modules), frozen-file/diff/document checks passed. Setuptools emitted its
existing setup.py-install deprecation warning. Stdlib tracing of the 48 reader
tests covered **49/50 added executable source lines (98%)**; this is scoped
line coverage, not branch or whole-project coverage.

Final author self-review checked the complete diff for role escalation,
identity/run/session boundaries, fixed output bytes, malformed configuration,
read-only status and D34 leakage. Independent Codex reviewer
`/root/security_review` reviewed `110dbb6..845bf44` and the three role guides:
no blocking security/consistency findings. Its internal-helper observation and
earlier failed harness checks (long socket paths and copied venv import binding),
resolutions, exact checks and limitations are recorded in untracked `PR_BODY.md`.
No assertions were weakened. Real host/separate-UID/SSH/client/systemd isolation,
real human approval, Python 3.13 and browser/axe release flows were not run.
No push, PR, merge, deployment, host setup, new dependencies or Docker changes.

## Pending dispatch inspection — local qualification, 25 October 2026

Branch `fix/operator-pending-dispatch-inspect`, base `0f89fbe`; scope is trial
item **10** only. Code/tests: `a6593dec4b0f58045bc7eaaa1eb3d68835bf79aa`;
subsequent changes are documentation only. Red checkpoint `40671a1` witnessed
**21 failed, 29 passed** before `pending` existed; three broker denial-frame
probes passed. [Operator inspection and manual next steps](../deploy/server/README.md#root-only-pending-dispatch-inspection-trial-item-10).

- `truthlens pipeline explain pending` checks real/effective root before parsing
  or input reads, then uses the existing O_RDONLY validated journal reader.
  It creates no files/locks, writes no journal bytes and triggers no recovery.
- Only uncaptured dispatches appear, with validated bounded dispatch ID/profile,
  clamped integer age and fixed state/retry indication. No run ID exists before
  capture. Output is at most 100 entries / 32768 bytes, with explicit truncation.
  No profile contents, keys, ledger events, evidence or arbitrary record text.
- Caller mappings/registry authorization, recovery, frozen contracts, G1 wire,
  adapter and D34 remain unchanged. Byte-exact normal error/status and broker
  denial checks pass with the operator module unavailable. Integrity is not approval.

Targeted `python -m pytest -q tests/test_pipeline_pending.py
 tests/test_pipeline_explain.py tests/test_status_broker.py tests/test_mcp_status.py
 --basetemp=.t/gg --tb=short`: **158 passed**. Sequential full Python runs with
repo-local venv PATH/TMPDIR, current-source PYTHONPATH and umask022:
`TZ=UTC python -m pytest -q -rs --tb=short --basetemp=.t/u11` and
`TZ=Europe/Berlin python -m pytest -q -rs --tb=short --basetemp=.t/b10` each
reported **747 passed, 2 skipped, 1 xfailed, 21 subtests passed**. Host-only
tl-agent/sudo tests are skipped; the known same-UID `/proc` risk is an expected
failure. These are not passes or live isolation qualification.

Full Viewer `TZ=UTC npm test` and `TZ=Europe/Berlin npm test`, sequentially in
`viewer/`: **436 passed / 46 files each**, including static checks and five
toolbar builds. Existing jsdom scrollTo notices remain. `ruff check src tests`,
changed Python format checks, Viewer `npm run lint`, `npm run build` (including
TypeScript), local setuptools wheel build/content comparison and diff/document
checks passed. Setuptools emitted its setup.py-install deprecation warning.
Scoped stdlib tracing of 50 operator tests plus synthetic boundary probes covered
**44/44 executable helper lines**; this is not branch/project coverage. The
maximum-field 100-entry projection used **27231 bytes** including newline;
invalid capture identifiers and an artificially exhausted byte budget failed
closed. A real nonroot CLI invocation returned only `ROOT_REQUIRED`, exit 2.

Earlier harness failures and fixes are recorded in the requested untracked
`PR_BODY.md`: stale copied virtualenv source path and reuse of an old read-only
pytest directory. The initial implementation also exposed duplicate-record
validation bypass; validation now precedes deduplication and its tests pass.
Final author self-review checked root ordering, fail-closed bounded projection,
read-only behavior, unchanged error bytes and D34 reachability, tests and docs.
No remaining blocking finding; this is the requested self-review, not an
independent review or security certification. Real root/host/client/SSH/systemd
isolation, live services, Python 3.13, browser/axe release flows and real human
approval were not qualified. No push, PR, merge, deployment or host setup occurred.

## Operator broker unit and denial diagnosis — local preparation, 25 October 2026

Branch `fix/operator-broker-unit-explain`, base `3e5237a`; scope is trial-runbook
items **5 and 7** only. Red tests are committed at `cb45abb`: **24 failed,
1 passed** for the missing command/unit. [Operator instructions and reason
codes](../deploy/server/README.md#root-only-denial-diagnosis).

- Inactive `truthlens-status-broker.service` example: root identity, protected
  mode0660 Unix socket, AF_UNIX restriction, CAP_CHOWN for socket group assignment,
  read-only state/installation, inaccessible key and suppressed output. Placeholder
  IDs and no Install section; nothing is installed or activated.
- Root-only `truthlens pipeline explain run --profile NAME` and `explain status
  RUN_ID [--uid UID]` reuse existing deny checks and print one fixed enumerated
  stage code to stderr. Real/effective root is checked before parsing/input reads.
  Read-only registry locking and bounded key reads occur only for the documented
  operator checks; status diagnosis never reads the key. No dispatch, audit,
  profile/test execution, approval, repair or policy relaxation.
- Normal fixed pipeline errors and agent CLI/MCP/broker status-only outputs remain
  covered, including exact denial-frame bytes and unavailable diagnostic imports.
  Frozen contracts, G1 wire/adapter/D34, caller mappings and interrupted-dispatch
  behavior are unchanged. Integrity is not approval.

Tested code/tests: `139def89131027a6aeb86d9dfd60330d7c73b406` (subsequent status/evidence edits
only). Targeted `python -m pytest -q tests/test_pipeline_explain.py
 tests/test_status_broker_unit.py tests/test_pipeline.py tests/test_profile_check.py
 tests/test_status_broker.py tests/test_mcp_status.py --basetemp=.t/g3 --tb=short`:
**177 passed**. With repo-local venv PATH/TMPDIR and umask022, full
`python -m pytest -q -rs --tb=short --basetemp=.t/pu` in UTC and
`--basetemp=.t/pb` under Europe/Berlin each reported **721 passed, 2 skipped,
1 xfailed, 21 subtests passed**. The two existing host-only skips and known
same-UID `/proc` expected failure are not passes.

Full Viewer `npm test` in UTC and Europe/Berlin each reported **436 passed /
46 files**, including language/style/theme checks and all five toolbar builds.
Existing jsdom scrollTo notices remain. `ruff check src tests`, changed Python
format checks, Viewer `npm run lint`, `npm run build` (including TypeScript),
local setuptools wheel build/package-content check, all 16 reason-code
code/test/doc mappings, required-doc checks and diff checks passed. A scoped
stdlib trace run of the 27 new operator/unit tests reported **60 executable
lines / 100% line coverage** for `pipeline_explain.py`; this is not branch or
whole-project coverage. The first trace-report attempt failed on stale copied
venv bytecode paths after its 27 tests passed; the scoped report succeeded.
Earlier harness/lint/import-order failures and their resolutions are recorded
in the requested untracked `PR_BODY.md`.

Final author self-review checked the exact diff for root-before-read behavior,
fixed-only stderr, unchanged normal denial bytes, no diagnostic reachability
from status/MCP/wire, no policy drift in extracted helpers, key non-disclosure
and unit/socket/registry-lock compatibility. No remaining blocking finding;
this is the requested author self-review, not an independent security review.
The new operator checks simulate root identity/policy; temporary Unix sockets
exercise framing, not separate-UID host isolation. Live systemd confinement,
real separate-UID/client/SSH isolation, Python 3.13 and historical browser release
flows were not run. No push, PR, merge, deployment or host setup was performed.

## Workspace overview v1 — local qualification, 25 October 2026

Branch `design/overview-v1`, base `4b44db0`. Application source and unit tests:
`e25d92070e0db01b6cc03d4e92f6506d7d71b5e6`; final manual browser helper:
`45d61a3cee33b28f69e704bed1e60c19c6c40428`. Later evidence/document edits do
not change application code. Red acceptance tests were committed at `2468329`.

- The fresh workspace landing and `?view=runs` summarize loaded documents with
  a criterion headline, four charts and a bounded latest-runs list. Clicking a
  run opens the existing review. Explicit run links and restored tabs remain.
- Only recorded criterion states, agent names, timestamps and evidence event
  kinds contribute to charts. **RunDoc has no Phase F overall verdict**: the
  score says criteria met, never runs passed. Catalog entries without loaded
  documents are not counted. No new reads, network feature or dependency.
- Pure aggregation deduplicates run IDs and bounds sources, documents, strings
  and record/reference visits, including duplicate/malformed documents. Excluded
  records and display limits are visible. React text nodes preserve recorded
  strings; no HTML interpolation. Empty data produces an honest empty state.
- The scoped dark green overview uses local Plus Jakarta Sans/JetBrains Mono,
  neutral warnings, accessible chart text and reduced-motion rules. Existing
  run detail styling, frozen contracts, G1/D34 and operator/pitfall docs are unchanged.

Witnessed on the source above: full `npm test` in **UTC and Europe/Berlin**,
**436 passed / 46 files** in each, including language/style/theme checks and the
five toolbar builds. Existing jsdom scrollTo notices remain. `npm run lint`,
`npm run build`, `ruff check src tests`, required-doc existence and diff checks
passed. With `umask 022`, the repo-local venv on PATH, repo-local TMPDIR and short
`--basetemp` paths, unrestricted Python `pytest -q -rs --tb=short` in **both
timezones** reported **662 passed, 2 skipped, 1 xfailed, 21 subtests passed**.
The two host-only skips and existing same-UID expected failure are not passes.
Earlier environment failures (socket path length, PATH, umask and occupied
loopback port), the old palette guard failure and a terminated intermediate
Viewer run are recorded in the untracked requested `PR_BODY.md`.

Final targeted real Chromium review at `45d61a3`: **8 scenarios / 32 unrestricted
axe scans**, 1440×900 and 390×844, both shell themes and both lenses, disconnected
and unloaded-catalog empty states, loaded overview and existing run review.
Zero axe violations, page overflow, browser errors or external page requests.
Twenty axe incomplete rule occurrences were checked through the existing CSS
contrast review helper, all `css-contrast-pass`; this is not spoken screen-reader
qualification. Keyboard opening, Back navigation and no additional document read
on overview reopening passed. [Published screenshots and scope](screenshots/design/overview-v1/axe-summary.md).
Reader responses in this review are synthetic UI fixtures, not a live service.

Final author self-review checked the security/D34 boundary, input/work limits,
text-only rendering, verdict honesty, navigation compatibility and the local
React/interface checklists. No remaining blocking finding; this is an author
self-review, not an independent security certification. No Python/security code
changed. Python 3.13, live services, host/client isolation, human approval and the
historical full browser release matrix were not qualified. No push, PR, merge,
deployment or host setup was performed.

## Operator profile pitfalls — local qualification, 25 October 2026

Branch `fix/operator-profile-pitfalls`, base `4b44db0`; tested code/tests at
`6af4efbbc81ce195f766316ec74cb751efccda1f`. Subsequent documentation edits do not
change those blobs. Scope is trial-runbook items **1, 2, 3 and 8** only.
[Operator preflight, example and troubleshooting](../deploy/server/README.md#profile-preflight-before-a-server-run).

- Root-only `truthlens profile check NAME|PATH` warns on derived-only criteria,
  non-absolute test executables and a repo without a committed HEAD. It reuses
  protected loading for installed names; explicit drafts get bounded no-follow
  regular-file reads. Git is read-only, output-discarding, environment-isolated,
  discovery-bounded, lazy-fetch-disabled and time-limited. No profile command,
  runner probe, key/registry read, write, privilege grant or run is performed.
- Warnings go only to operator stderr; exit 0 means no listed pitfall, not a
  checkable run or approval. The shared execution loader is deliberately silent.
  G1 broker/wire/client/adapter, fixed agent-facing errors and D34 are unchanged.
- Documentation covers criterion provenance, an absolute task-user interpreter
  with pytest, a committed Git workspace, and kernel loginuid/PID-1 attribution
  including container/PAM/subreaper limits. The demo intentionally retains
  derived proposals for interactive human confirmation. No auto-confirmation,
  actor semantics, frozen contract or other trial-runbook item changed.

TDD: `8fa90fb` captured **26 failures** before the command existed; `571609a`
passed **40 targeted tests**. Review strengthened nonroot-before-open and
all-status CLI/MCP leakage checks and added FIFO rejection. `608b761` captured
the additional lazy-fetch regression (**1 failed, 29 passed** on the review
working tree); `6af4efb` passed **44 targeted tests** with
`.venv/bin/python -m pytest -q tests/test_profile_check.py tests/test_pipeline.py`.
Final author self-review used a separate security/D34 pass over the complete
diff; no blocking finding remains. This was self-review, not a separate reviewer
or human approval. Root identity and broker replies in new tests are simulated;
temporary Git repositories are real. No deployed isolation is claimed.

Full Python suites, sequentially in **UTC and Europe/Berlin**, each reported
**692 passed, 2 skipped, 1 xfailed, 21 subtests passed**, without deselection:
`TZ=UTC` / `TZ=Europe/Berlin`, `umask 022`, command-scoped venv PATH and repo-local
TMPDIR, `.venv/bin/python -m pytest -q -rs --basetemp=.u` / `--basetemp=.b`.
The skips require existing host accounts/sudo; the expected failure preserves
the same-UID key-risk regression. Full Viewer `npm test` passed **422 tests /
44 files** in each timezone, including language/style/theme checks and all five
toolbar build variants; existing jsdom scrollTo notices remain.
Ruff (`src tests`), new-file formatting, Viewer lint/TypeScript/production build,
Python sdist/wheel build, shell syntax and document/link/JSON consistency passed.

Earlier full-suite failures were witnessed and resolved by test-environment
settings: eight initial Python failures from umask/PATH/Unix socket path length;
a later concurrent timezone attempt collided on the existing fixed loopback
test port. Final runs were sequential. Two initial Ruff findings were corrected.
Exact commands, intermediate results and limits are in untracked `PR_BODY.md`.
No real host setup, live-service/client qualification, separate-UID isolation,
browser/axe review, coverage measurement, publishing, push or PR action ran.
Existing temporary Unix/loopback tests ran; no network feature was added.

## Phase G2: agent setup — local qualification, 25 October 2026

Branch `feat/phase-g2-agent-setup`, base `3a7a9f7` (G1 / PR #174).
Tested application/test content is committed at
`7c1b53450bea8b3876871c4b1dbb8809bbccc2e1`; later STATUS-only edits do not change it.
This is agent work, not human approval or deployed isolation.
[Client setup and command reference](AGENT-SETUP.md).

- `agent-status` uses only the existing G1 status client. Its complete output is
  one status or canonical `{status}` JSON; exits passed=0, failed=1,
  not_checkable=2. Invalid arguments, errors and even `--help` stay status-only.
- `doctor` is read-only and human-facing: fixed socket metadata, adapter, SDK
  and standalone-snippet checks. It never connects, scans client directories,
  changes permissions/configs or reads keys/registry/runs. It always reports
  `ISOLATION_UNVERIFIED` and exits 2; metadata is no isolation certificate.
- `agent-config` emits JSON/TOML templates for Claude Code, Codex, Cursor and
  Agent Zero. It wires only `mcp-status`; an explicit output creates a new 0600
  file and refuses existing paths/symlinks. Actual client versions are unqualified.
- `demo-status` roundtrips three explicitly simulated statuses over a private
  temporary fake Unix broker, then demonstrates the real client returning
  not_checkable. No production trust check is relaxed or globally patched.

TDD: `d935eaf` witnessed 47 failing acceptance tests; `f636b34` passed those 47.
The independent reviewer identified agent-status help expanding the output
vocabulary: two additional cases failed at `f93c56b`, then `373a48c` fixed them.
Expanded G2 tests: 64 passed. An intermediate boundary run passed 208 tests
and 21 subtests. Independent Codex review and scoped re-review found no remaining
code/D34 blocker; final author self-review checked broker-only imports, output
allowlisting, read-only diagnostics, explicit file safety, demo isolation and CI
selection. Final source/test blobs match the reviewed formatting-only changes.

With `umask 022`, repo-local temporary files, local editable installation and the
three existing TCP-listener test functions deselected, Python `pytest -q -rs`
reported **651 passed, 2 skipped, 11 deselected, 1 xfailed, 21 subtests passed**
in **UTC and Europe/Berlin**. This is not an unrestricted full-suite pass.
The two skips need separate host accounts/sudo; the expected failure records the
existing same-UID key risk. Initial UTC execution had one unchanged gate test
failure (650 passed): its filtered subprocess could not import the uninstalled
checkout. The first editable-install attempt also failed because setuptools
was absent. Installing build tools and the local package only in this repo's
venv resolved that environment issue; the targeted gate test and both later
suite runs passed without changing assertions or security code.

Full Viewer `npm test` passed **422 tests / 44 files** in each timezone, including
the language/style/theme checks and five toolbar build variants. Existing jsdom
scrollTo notices were observed. Ruff (`src tests` and CI scope), formatting of new
helpers/tests, Viewer lint, TypeScript/production build, Python sdist/wheel build,
installed demo smoke and setup-document snippet/link consistency checks passed.
Initial Ruff findings were corrected before the final checks. Existing dependency
contracts, frozen specs/trust levels and G1 broker/wire/client/adapter are unchanged; no new dependency or MCP field/tool.
Exact commands, initial failures, review evidence and limits are in the requested
untracked `PR_BODY.md`; no raw test reports were committed.

- [x] Local G2 commands, four client templates, synthetic demo, leak/read-only
  regressions, independent review and author security self-review.
- [x] Permitted Python suites and full Viewer suites in both timezones; lint/build.
- [ ] Eleven existing TCP cases: not run under the explicit no-listener rule.
- [ ] Real client sessions, separate-UID/key/reader isolation, restricted SSH,
  pipx/uv installation and coverage measurement: not run.
- [ ] Remote CI, push, PR creation/merge, publishing, deployment and host setup:
  not run; not authorized by this task. No UI change or browser/axe run; only
  temporary Unix test/demo sockets, no TCP listener.

## Phase G1: status broker and status-only MCP — local qualification, 25 October 2026

Branch `feat/phase-g1-status-broker`, base `90b04b4` (main after Phase F / #173).
Implementation and test tree: `5a2d0d579a582c30937844a481e865446b5b47ba`;
subsequent commits only record documentation. This is agent work, not human
approval or deployed isolation. [Architecture and threat model](SELFHOST-MCP.md).

The separate trusted Linux broker authenticates `SO_PEERCRED` against a nonroot
UID allowlist and existing per-run registry dispatch rights. It reads stored
completed audits and immutable captured bytes, checks run/anchor/input/verifier
bindings and the existing source's explicit `verified is True` context, then
uses Phase F's shared projection. Final journal comparison/projection is locked.
No audit, admission, registration, approval, repair, execution, key read, second
store or second verifier occurs on query. Socket ancestry/owner checks, `0660`
mode, explicit existing group, two workers, bounded frames/deadlines and per-UID
rate limits fail closed. There is no status cache.

`truthlens mcp-status --socket PATH` is an unprivileged stdio adapter with exactly
one tool, `truthlens_check_status({run_id})`. Its single canonical JSON text
result contains only `status`: passed / failed / not_checkable. It uses only the
broker socket; no Phase B reader, viewer, registry, snapshot or key path is
available through this adapter. The optional official SDK is pinned to 2.3.0;
synthetic subprocess tests exercise 2025-06-18 handshake and 2026-07-28 stateless
requests. D34 requires stripping automatic SDK result metadata; full modern
client conformance and installed Claude/Codex/Cursor/Agent Zero versions are not
claimed. Legacy evidence MCP remains unchanged and explicitly non-D34.
`failed` means an authenticated scoped contradiction, not generic task failure.
Integrity is not approval.

TDD checkpoint `7000774`: 68 failed, 23 missing-module setup errors, 1 passed
before implementation. Targeted GREEN: 150 passed, 21 subtests; the independent
review then identified explicit verification-context and atomic-observation
requirements. Five added cases were witnessed RED and passed after the fixes.
Independent Codex scoped re-review found no remaining blocking finding; reviewed
broker SHA-256 `5791af5e0385345de57a6794dd345222c5e749690496b2faf41e1b700fe25408`.
Author security self-review checked authorization-before-read, stored source
bindings, absence of mutation/fallback, both peer identities, strict input and
output schemas, limits, sanitized errors, optional dependency and CI selection.

Final Python `pytest -q -rs` in **UTC and Europe/Berlin**, with `umask 022`,
repository-local temporary directories and the three existing TCP-reader test
functions deselected, each reported **587 passed, 2 skipped, 11 deselected,
1 xfailed, 21 subtests passed**. This is not an unrestricted full-suite pass:
the 11 parameterized loopback cases require TCP listeners forbidden by this
task. The two skips require host accounts/sudo; the expected failure records
the existing same-UID key risk. Earlier runs under inherited `umask 0002` had
six unchanged static-reader fixture failures (group-writable files correctly
refused); rerunning with owner-only/group-read fixture creation resolved them
without changing assertions or reader code. The initial Unix tests also required
a shorter repository-local base path to fit the Linux socket pathname limit.

Full Viewer `npm test` passed in both timezones: **422 tests / 44 files** each,
including language/style/theme guards and the five toolbar build variants.
Existing jsdom `scrollTo` notices were observed. Ruff (`src tests` and CI scope),
Viewer lint, TypeScript/production build and Python sdist/wheel build passed.
No UI code changed; browser/axe checks were not run. Exact commands, intermediate
failures and acceptance mapping remain in the requested untracked `PR_BODY.md`.

- [x] Local broker/MCP implementation, real temporary Unix and stdio roundtrips
  using signed synthetic fixtures, negative/leak tests and independent review.
- [x] Permitted Python suites in both timezones, full Viewer suites, lint/build;
  frozen event/manifest/trust contracts unchanged.
- [ ] Existing TCP-loopback cases: not run under the no-listener constraint.
- [ ] Real distinct UID/ACL/key custody, human-reader network denial, SSH forced
  command, installed model-client versions and host isolation: not run.
- [ ] Remote CI, deployment, push, PR, merge, publishing and host setup: not run.
- G2 was deferred at this G1 checkpoint; see the current G2 section above.

## Phase F: Green Deck status — local qualification, 25 October 2026

Branch `feat/phase-f-green-deck`, base `9667c9d` (main after Phase E / #172).
Application and browser harness at `b791256`; later commits publish evidence and
documentation only. One Python projection supplies a closed `status` and
`reason_code` to the existing human stored-audit GET envelope and the local
human CLI. Viewer audit views and the compact widget render that same result,
without a second browser verdict calculation. Detailed rule-group summaries
retain their existing scope. Missing checks, incomplete criterion evidence,
identity/input-digest mismatch, hash-only authentication, running/error and
interrupted/unavailable sources cannot become passed. A refresh clears cached
green immediately. The widget starts Not connected, fetches only after human
Connect, uses bounded existing reader routes and displays no events, evidence,
paths, run IDs, timestamps or arbitrary report strings. No new route or write
API. Mobile header controls wrap at 320px with enlarged text.

Human SSH shell usage: `truthlens audit status DIR --json`; optional
`--hmac-key-env VAR` or existing private `--hmac-key-file PATH`, plus optional
`--expect-last-hash HEX`. Neither keys nor paths are returned. Exit codes:
passed **0**, failed **1**, not_checkable **2**. This is the local equivalent of
the requested `/audit status` view, not a Mausbot/ACP session command, network
listener or legacy `truthlens status`/`truthlens mcp` integration. It reads and
audits local bytes without writing them; it does not consume the Phase B service.
The widget and viewer are human-only consumers of that service. No agent feed,
Phase G Unix socket, SO_PEERCRED broker or tool is implemented or activated.
Integrity is not approval; browser signature verification is not claimed.
The existing hash-only seal and production Not connected fallback remain.

TDD: `fa71988` initial RED (16 Python failures and missing viewer component),
`89e68af` GREEN (100 targeted Python / 35 viewer tests); `07d618d` four review
regressions RED and `47d4faa` GREEN (106 targeted Python); `30f4fff` four
lifecycle/CLI privacy regressions RED and `787ec9f` GREEN (24 status tests).
`0f837fc` records the real-browser 320px/200% overflow RED; `b791256` fixes it,
with both affected theme probes passing. No assertion was weakened. The older
widget test now requires the deliberate absence of evidence details.

Full Python `TZ=UTC` and `TZ=Europe/Berlin` runs each passed **493 tests,
2 skipped, 1 xfailed, 15 subtests passed**. The two skips require host users and
sudo; the expected failure records the known same-UID key risk. They establish
no live isolation. Full Viewer suites in both timezones each passed **422 tests
/ 44 files**, including language/style/theme guards and the toolbar build
matrix. Ruff, Viewer lint and TypeScript/production build passed. Each
timezone's targeted Chromium run passed **6 specs / 102 unrestricted axe
scans**, at **1440×900, 390×844 and 320×844**, both themes, normal and doubled
computed text sizes. Zero axe violations and page errors; 10 incomplete rule
results per run were classified by 78 CSS contrast probes per run, all passing.
Eight small PNGs and a bounded report per timezone are
[published with commands and limits](screenshots/feat/phase-f-green-deck/review-summary.md).
Text enlargement is a CSS test, not native browser zoom or a blanket WCAG claim.
Self-review and independent Codex review at `b791256` resolved incomplete
evidence and lifecycle/privacy findings; no blocking finding remains. The
untracked PR body retains exact commands and earlier environment/port-collision
failures. No remote CI, push, PR, merge, host setup, deployment or publishing.

Release-acceptance checklist (local scope only):

- [x] Shared projection; source/rule/evidence correlation and fixed output
  allowlist guarded by executable regressions.
- [x] Interrupted/unavailable, running, error and unchecked states stay safe;
  CLI and widget expose status only and keep the approval boundary visible.
- [x] Full Python UTC/Berlin; host-only skips and same-UID expected failure
  reported separately from passes.
- [x] Full Viewer UTC/Berlin, Ruff, lint and TypeScript/production build.
- [x] Targeted Playwright/full axe at all three widths, both themes and 200%
  CSS text enlargement; bounded screenshots/reports published above.
- [ ] Live human SSH/service, native browser zoom, other browsers and spoken
  screenreader acceptance: not run; no operational activation authorized.
- [ ] Phase G broker/agent qualification: deferred, no Phase B agent access.

## Phase E: local folders and individual exports — local review, 25 October 2026

Branch `feat/phase-e-open-export`, base `569f35a` (main after Phase D / #170).
Final application fix `6174b5a`; final manual browser test `bbb9ef4`.
Later changes publish documentation and evidence only. The Viewer can explicitly
open a local ledger folder read-only, bound its input, check canonical ledger
bytes/chain/close/approval/criterion rules, recompute manifest results and check
referenced blobs. Local files always remain **not authenticated / hash-only**;
input trust claims are ignored, and no key is accepted. Original ledger,
manifest and evidence downloads preserve captured bytes. The separately named
RunDoc download is labelled **derived**. No ZIP. Existing Phase C tabs and Phase D
evidence/changes/comparison views are reused. Local sources stay in browser
memory, outside registered catalogs, queues, the read service and Agent Zero.
D34 remains status-only; unavailable service retains Not connected. Python,
server code and frozen event/manifest/trust contracts are unchanged.

TDD checkpoints: `bf82058` missing-feature RED, `34a1778` initial 30-test GREEN;
`61c4408` calendar-normalization RED and `3b4ac55` fix; `bce4f57` one-microsecond
approval-expiry RED and `6174b5a` fix. Final targeted set: **42 passed**.
Full Viewer `TZ=UTC npm test` and `TZ=Europe/Berlin npm test` each passed
**418 tests / 43 files**, including language/style/theme guards and the toolbar
build matrix. Viewer lint, TypeScript/production build and Ruff passed. Full
Python UTC and Berlin runs each produced **469 passed, 2 skipped, 1 xfailed,
15 subtests passed**. Python code/tests are unchanged after those runs; their
results are reused. Host-only skips and the same-UID expected failure do not
prove live isolation. The untracked local PR body records exact commands,
review scope, initial copied-venv/umask/socket-path failures and the inspected
six-snapshot update; no assertion was weakened.

Final browser source `bbb9ef4`: **4 Playwright specs per timezone**, each with
**28 unrestricted axe scans and 8 small PNGs**, at **1440×900 / 390×844**, both
themes and lenses. Each timezone completed 12 exact-byte original downloads,
4 derived exports and unchanged-source comparisons, with **zero axe violations
and page errors**. Incomplete contrast/modal nodes remain in the reports, with
66 CSS contrast passes and 6 inactive modal background classifications per
run. [Published evidence, commands and limits](screenshots/feat/phase-e-open-export/review-summary.md).
The generic/browser Blob download cancellation was reproduced and fixed by
canonicalizing the repo-local temporary path, without application changes.

Self-review and independent read-only Codex review of the implementation and
scoped timestamp fixes found no blocking code issue. A required symlink blob
omitted by Chromium is rejected as missing; explicit non-file/link entries are
also rejected. Browser file APIs cannot establish a complete OS symlink audit,
including links omitted or dereferenced before selection. That literal,
browser-independent symlink guarantee remains unproven, and the UI discloses
the boundary. Native OS picker UI, slow/throttled downloads, other browsers,
screenreader, live service/SSH/private runs, signatures and human approval were
not accepted by these synthetic tests. No remote CI, push, PR, merge, deployment
or host setup occurred.

## Phase D: stored evidence, changes and comparison — local review, 25 October 2026

Branch `feat/phase-d-evidence-compare`, base `935eebc` (Phase C / #169).
Application/test commit `f6f057b`; later changes publish documentation/evidence only.
The existing Phase C source/run/renderer tabs now include Chain, Coverage,
Gated actions, Changes and Compare. Claims continues through Claimed vs proven.
The viewer reads the existing stored-audit GET route, validates source/run/head
and check shape, retains every recorded result and labels unchecked/partial,
failed and not-applicable states separately. It does not run verification,
infer per-link diagnostics, code-coverage percentages or human approval.
Original gate events keep actor/simulation labels and open the existing
Inspector/Sheets. Stored diffs reuse Renderkit's safe raw fallback; absent
blobs remain empty. Comparison keeps both loaded snapshot identities, ledger
heads and independent trust notices visible, with no reconstructed before-file.
Frozen contracts, server code, Agent Zero and its status-only boundary are unchanged.
Unavailable production service still retains Not connected.

TDD: `347cf45` initial red checkpoint (16 intended failures, 4 passes and a
missing-component suite); scoped red tests subsequently caught outcome coercion,
duplicate comparison landmarks and missing renderer-failure/gate-record access.
`f6f057b`: 33 targeted regressions passed. Full `TZ=UTC npm test` and
`TZ=Europe/Berlin npm test` each passed **376 tests / 40 files**, including
language/style/theme guards and the toolbar build matrix. Viewer lint,
TypeScript/production build and `ruff check src tests` passed. Python code/tests
are byte-identical to base; full UTC and Berlin runs each produced **469 passed,
2 skipped, 1 xfailed, 15 subtests passed**. Host-only skips and the existing
same-UID expected failure do not establish real isolation. Copied-venv import
issues, intentional snapshot updates, the reproduced mobile overflow and one
concurrent-run language-test timeout are recorded in untracked PR_BODY.md;
assertions/timeouts were retained and final isolated viewer runs passed.

Final source `f6f057b`: **4 Playwright specs in each timezone**, **44 unrestricted
axe scans and 44 screenshots per timezone**, at **1440×900 / 390×844**, both themes.
Zero axe violations at all impacts and zero page errors; incomplete-node
classifications remain in the reports. [Published evidence, exact commands and
limitations](screenshots/feat/phase-d-evidence-compare/review-summary.md).
Synthetic API fixtures prove these UI boundaries only; no real private audit,
other-browser, screenreader, live SSH/service or human approval acceptance is
claimed. Self-review and a separate read-only Codex review of the implementation
and scoped fixes found no blocking issue. No remote CI, push, PR, merge,
deployment or host setup. No mock-only claim of live-service completion.

## Phase C: Phase B catalog, workspace identity and tab navigation — 25 October 2026

Branch `feat/phase-c-catalog-tabs`, base `4b78f47` (Phase B / PR #168).
Reuses #160's source/target/renderer tab reducer, bounded close/pin/restore
metadata and single history owner. The Phase B read adapter supplies Runs;
workspace and snapshot identities are visible. An empty document cache now
starts at a canonical Runs URL, so Back returns to the initial catalog.
The existing single 64 KiB metadata slot is bound to the workspace; old unscoped
or other-workspace metadata is ignored, and switching workspaces replaces the
saved session. Claims remains a deduplicated renderer tab. Non-advancing catalog
cursors are rejected. Existing 40-open/20-closed limits, late-response guards,
memory-only storage fallback and inert unavailable references remain covered.

TDD checkpoints: `b69ba30` red tests (7 intended failures / 24 passes),
`e85ebd0` implementation (43 targeted tests passed); `9d0027b` fixes browser
test initialization inside the opaque preview iframe. Self-review reproduced
the same history gap for initial legacy renderer URLs without a run target:
`9f8764b` red (5 failed / 14 passed), `734a5a4` green (48 targeted tests passed).
Those targetless URLs now resolve to Runs; supplied-run legacy renderers retain
their behavior. Final application/Vitest tree `734a5a4`: full `TZ=UTC npm test`
and `TZ=Europe/Berlin npm test` each passed **347 tests / 37 files**, including
static guards and the toolbar build matrix.
Viewer lint/types/build and `ruff check src tests` passed. Python source is
unchanged from the base; full UTC and Berlin runs each produced **469 passed,
2 skipped, 1 xfailed, 15 subtests passed**. Repository-local test execution used
short `--basetemp` paths, virtualenv PATH and umask 022. Earlier environment
failures and one interrupted Berlin attempt are recorded in untracked PR_BODY.md;
the skips and expected same-UID failure do not prove live isolation.

Browser application/harness tree `734a5a4` (pending docs-only edits listed in
the evidence): **6 specs passed in each timezone**, with actual
Back/Forward, dedupe, reload/restore/pin, capacity, storage failure, delayed
responses and last-criterion hit testing at **390×844**. Fourteen unrestricted
axe scans and fourteen screenshots at **1440×900 / 390×844** found zero
violations/page errors; incomplete-node classifications remain recorded.
[Published screenshots, exact scope and limitations](screenshots/feat/phase-c-catalog-tabs/review-summary.md).
Browser APIs use synthetic responses against the production build; no live
private snapshot, SSH tunnel, separate UID or other-browser claim. Self-review
found no blocking scoped issue. No remote CI was run. Frozen contracts and
D34/Agent Zero status-only behavior are unchanged; unavailable production
service retains Not connected. No push, PR, merge, deployment or host setup.

## Phase B: clarified D34 local read boundary — 25 October 2026

Branch `feat/phase-b-read-service`, implementation `21343112f64e32f162c2a4b11f799b3d48c5b41c`.
Repository preparation only: the CLI now uses an unprivileged reader on fixed
`127.0.0.1:8765`, with one server-configured Shu view and GET/HEAD routes for
health, runs, document, events, artifacts, captured blobs and stored audits.
A separate protected read index selects published registered snapshots; the
root-only registry/key permissions are unchanged. No per-request audit,
`check_snapshot`, process launch or key access. RunDoc remains hash-only.
Stored audit reports must match the registered run and ledger anchor.
Agent Zero's existing disconnected adapter emits only passed / failed /
not checkable, never events, evidence, reports, paths or keys. Its separate
UID-restricted status socket remains later host work. The existing local Viewer
adapter is reused; production remains **Not connected** without the service.
Inactive systemd/tunnel examples and the D34 clarification are documented in
[operator preparation](../deploy/server/README.md). This replaces the earlier
D36 human-reader transport preparation below; legacy Unix compatibility tests
remain. Frozen event, manifest and trust-level documents are unchanged.

Witnessed against the implementation tree: full Python suite under `TZ=UTC`:
**469 passed, 2 skipped, 1 xfailed, 15 subtests passed** (22.06s), with 81%
combined coverage for the two reader modules (projection 88%, transport 77%).
The first full run failed the pre-existing host-only test because
`/srv/tl-agent/wt` was absent; its prerequisite guard now requires that existing
writable workspace before privileged probes. Both host tests remain skipped,
not passed; same-UID key access remains the existing expected failure.
Full `TZ=Europe/Berlin npm test`: **329 passed / 36 files**, including the toolbar
build matrix and language/style/theme checks. Three AgentStory timezone
snapshot failures were reproduced first and fixed by test-local UTC selection.
Ruff, Viewer lint/types/production build and 4 ACP status tests passed. New
reader and status guarantees were witnessed red before implementation; see
[local review body](../PR_BODY.md) for exact commands and checkpoints.

Independent Codex subagent reviewed the final implementation commit and found
no blocking security finding; wrong-run audit binding was separately reproduced
and fixed. No remote CI, browser/axe run, live private snapshot, OS isolation,
SSH tunnel, actual publication or Agent-Zero socket acceptance is claimed.
No host setup, push, PR, merge or deployment was performed. Live activation is
blocked pending separate authorization and witnessed worker UID/netns exclusion,
least-privilege publication/config access and real-host memory acceptance.

## Historical fixed private reader preparation — 23 October 2026

D36 authorizes one fixed Shu read view over a protected Unix socket and SSH.
The repository now prepares a key-free registered-snapshot reader, exact Unix
peer UID enforcement, a same-origin production Viewer with explicit Connect,
and an inactive service template. Registry visibility comes from protected
configuration and original dispatch authorizations; requests cannot register,
audit, approve or execute. Catalog, document and event routes are implemented;
artifact/blob/audit-report/export routes remain later work. Hash-only projection
is explicitly not fresh signature verification. See [operator preparation](../deploy/server/README.md).

Witnessed local verification: initial combined reader/CI selection: 63 tests plus
15 subtests; after the bounded-worker and normal-stop fixes, the 46 transport
tests passed. Viewer 329 tests passed, with the source-copy follow-up checked by
one affected integration test. Python/Viewer lint, static style/language/theme
checks and production build passed. Tests use synthetic data and substitute root checks;
no live isolation or actual private run is established. Independent security
review found no unresolved repository-preparation blocker. Targeted production
browser evidence and its scope are [published here](screenshots/p4/private-reader/review-summary.md).

No VPS service, user, permission, key or public deployment was activated.
Actual SSH forwarding, worker-UID denial, eligible private run acceptance and
large-input peak-memory measurement remain prerequisites for live operation.

## Viewer Phase C: source-aware local workspace navigation — 23 October 2026

[Issue #158](https://github.com/Shuwajaja/truthlens/issues/158), branch `w6/issue-158-workspace-navigation`. One navigation hook owns browser history; source/run/view identities select existing tabs, and supplied in-memory records populate Runs. Accessible in-flow Select/Pin/Close controls and the latest 20 closed references preserve explicit close/restore focus. Forty open tabs reject additional opens/restores visibly without eviction. Metadata-only storage failure stays usable and reports Unsaved on this device. Valid unavailable references remain inert; malformed routes cannot reveal stored content through a pin change. Initial restored identities are bound to their history entry with replaceState, preserving Back/Forward, unrelated query/hash and history.state. Four legacy view links remain supported.

Production remains **Not connected**, fixture-free and source-fetch-free. No reader, source URL loader, private data import, frozen contract, HMAC, dependency, host/service or Vercel changes. Development still loads only the existing validated `/run.json`. Fixture bytes are unchanged.

Tested source `5ae5c6f`: **323 units / 35 files passed**, including focused navigation/UI/legacy tests; clean lint/types/build and semantic-style/English/210-pair theme guards passed. Manual review completed 24 unrestricted axe scans and 24 screenshots across both themes and 1440×900 / 390×844: zero violations, 40 incomplete-contrast node checks passed; keyboard tab lifecycle and final-criterion reachability passed. Four disconnected production loads asserted zero fetch/XHR and no fixture ID. [Exact evidence and limits](screenshots/w6/issue-158-workspace-navigation/review-summary.md). PR fast CI, independent review and Shu approval remain required; no merge.

## Viewer Phase A: local workspace redesign — 23 October 2026

[Issue #156](https://github.com/Shuwajaja/truthlens/issues/156), independent branch `w5/issue-156-workspace-phase-a`, base main `f30320a` after #155. Owner-approved Petrol & Porcelain default / Cool Graphite alternative, existing self-hosted fonts, shared shell with independent desktop panels and mobile sheets; local fixture run → criterion → exact record. No foreign example/Agent-Plane code copied because complete provenance is absent. [Approved plan](../PLAN-redesign-2026-10-23.md) committed; phases B–F remain deferred.

Latest owner decision: **one local production build, no public demo delivery**. Historical demo bytes moved unchanged from public assets to `viewer/fixtures/demo-run.json`; Vite development alone serves the fixture. Production contains no fixture and makes no source request; it remains **Not connected** until the reader/D34 boundary is approved. No host/services/keys, local reader, private import, frozen contract or Vercel project/deployment configuration changed. Legacy Vercel toolbar/provisioning can be considered for later separately approved removal.

294 Viewer units passed locally; build, lint, language, hard-colour guard and 210 rounded contrast pairs passed. Fresh review reproduced two desktop focus-loss cases; failing tests were witnessed, then fixed (record heading/back-to-criterion and persistent Inspector control). Existing hostile preview, modal AX/keyboard, evidence-tab, overflow-scroll and incomplete-review checks are carried into the local manual workflow; no test file removed. Tested source `f55dc987`: 100 full fixture axe scans plus 4 offline-build scans, zero violations/browser errors; 32 modal AX/trap checks and 12 overflowing-code keyboard checks passed. [Screenshots and exact scope](screenshots/w5/issue-156-workspace-phase-a/review-summary.md). Final source fast CI: all four jobs green; evidence-only head CI is reported in the PR. PR CI remains build/lint/fast unit only. Security check and Shu approval remain merge prerequisites; no merge.

## Issue #48: D27 strict test counters and D35 complete-run identity — 23 October 2026

The manifest acceptance projection treats a witnessed `test.reported` as passing only when `failed` is an actual integer equal to `0` and `passed` is an actual integer greater than `0`. An actual integer `failed > 0` remains a decisive failure even when `passed` is absent; missing, malformed, boolean, negative, or skipped-only counters cannot establish a pass. Acceptance, claim findings and recomputed manifests use the same decision. The remaining #48 identity criterion is recorded as D35 in the frozen manifest changelog: completed manifest construction requires exactly one `run.started` as the first event, and manifest `agent.name` always matches that event's declared agent, including empty names. Signed malformed ledgers for missing, duplicate and noninitial starts still pass generic chain/HMAC verification but cannot produce or verify a manifest. Partial acceptance and claims projections remain valid without `run.started`.

No event or manifest wire fields, hashes, or schema versions changed, and no generic ledger verification rule was added. The capture-time `run.started` behavior is unchanged. Focused manifest, audit, and export regressions passed (80 tests); targeted CLI, wrapper and smoke checks passed (28 tests); Ruff passed for `src tests`. The signed malformed-ledger identity cases were observed failing before the D35 production check and passing afterward. Independent security review and owner integration remain required.

## PR155: Review-Nacharbeiten — 23.10.2026

Die drei Review-Punkte zu Head `7399dbf` werden im selben [PR #155](https://github.com/Shuwajaja/truthlens/pull/155) korrigiert: sudo-Leerpolicy mit Exit0 wird anhand der eindeutigen C-Meldung erkannt; unbekannte/grantierende Ausgaben bleiben abgelehnt. Worker-Ticks lassen bereits vorhandene Audits vor der Zulassung aus, statt alte Snapshots neu zu prüfen; die inaktive Timer-Vorlage steht auf1min. Vollständige Berichte liegen separat in root-only `audits/`; die32MiB-Registry enthält nur relativen Pfad und Digest. Lesen prüft Pfadbindung, sichere Datei und SHA-256. Optional ebenfalls behoben: genau ein Wiederholungsversuch nach Unterbrechung, begrenztes Budget und tatsächlicher Jobstatus bei `admit`.

157 gezielte Python-Tests lokal bestanden (2,57s), Ruff `src tests` grün. Für sudo, Idle-Verhalten, Berichtsablage, Wiederaufnahme und CLI-Status wurden Fehler jeweils zuerst reproduziert und die Korrekturen anschließend erfolgreich geprüft; zusätzlicher Pfad-/Symlinktest schützt neue Berichtsreferenzen. Ein frischer gezielter Review meldet keine Blocker und führt36 betroffene Tests unabhängig erfolgreich aus. Der abschließende CI-Head und manuelle Release-Ergebnisse stehen im PR. Viewer-Code unverändert; kein neuer lokaler Browserlauf behauptet. Frühere Security-Freigabe laut Owner für7399dbf ersetzt nicht den Check dieser Änderungen. Live bleibt **not connected**, keine Host-Änderungen und kein Merge/Force-Push.

## Wrapper #49/#50/#51 scoped follow-ups — 23 October 2026

Configured pytest probes now use the configured entry point/interpreter and test environment/user, fixed probe arguments, a bounded timeout and static diagnostics. Valid JUnit failures survive a failed probe; a confirmed unavailable runner without valid XML stays unverified. Unsupported forms are not guessed. Post-agent capture failures attach informational evidence, skip artifacts/tests, close with failed status and a manifest, preserve the agent exit code, and return `capture_failed: true` with CLI exit 2. Gate shutdown and wrapper-owned temporary cleanup cover agent spawn errors too.

The #51 parent-symlink follow-up routes repository byte reads through descriptor-relative `O_NOFOLLOW` opens. Unsafe parents are refused before bytes are read or hashed; final symlink text and legitimate deleted/nonregular handling are preserved. Post-agent capture and test-copy source refusals close with a failed manifest. Multi-command pytest strings using `;`, `&&` or newline are regression-tested to retain a failed report rather than a later passing invocation overwriting it.

Local verification for #51: 47 focused wrapper and adjacent textconv/non-UTF-8/FIFO/symlink tests passed; seven new refusal/closure regressions were observed red before the fix. Earlier #49/#50 verification: 39 focused wrapper/CLI/gate tests, 157 fast CI Python tests, and Ruff passed. Regressions were observed failing before implementation. Separate-UID probe boundaries were mocked; no real user/host/service changes or full release suite run. Independent security review remains pending. Issue #49 remains scoped: gate response conflicts are outside this batch; broader arbitrary script/close behavior is also outside scope. Frozen contracts unchanged; no push or merge.

## Prüf-Agent Teil 2: Server-Pipeline und lesende Ansichten zur Prüfung — Owner-Stand23.10.2026

[Issue #154](https://github.com/Shuwajaja/truthlens/issues/154), Branch `w5/issue-154-server-audit-integration`, Basis main `4d2907c46912ec845e9b1994729c4e9c138fbbbb` nach unabhängig geprüftem PR153-Squash. Alles in einem TruthLens-PR, keine Änderungen in vps-system. Neuer Launcher mit festem root-only Agent-Zero-Profil, getrenntem `tl-agent`, privatem Schlüssel, serverseitiger Sitzung und geschütztem Dispatch/Initiator plus `on_behalf_of=Shu`. Nur eigene signierte Server-Captures werden als read-only Snapshot registriert und automatisch in die persistente, serielle Audit-Queue übernommen. CLI `pipeline run/worker`, `admit`, `status`; keine Chat-/HTTP-Registrierung. Fremde, externe, unsignierte oder veränderte Pakete werden abgelehnt. Root-Registry-Leseports, lesender ACP-Handler und separates kompaktes Widget sind vorbereitet; Gateway-/Mausbot-Identität ist nicht konfiguriert.

144 gezielte Python-Tests lokal bestanden (2,44s), Ruff `src tests` grün. Darin28 neue Server-/Admission-/Queue-/Leseportfälle; privilegierte Grenzen in Fixtures ausdrücklich simuliert. Ein echter lokaler Audit-CLI-Subprozess und echter Timeout des eigenen Testprozesses wurden geprüft.3 Node-ACP-Units bestanden.286 Viewer-Units/29 Dateien bestanden (26,30s), Lint, Sprache, Hard-Color-/Stilprüfung,134 bestehende Kontrastpaare und Build bestanden. Ein zusätzlicher Rot/Grün-Test korrigiert den direkten Modulaufruf `python -m truthlens.cli status`: Der Einstieg steht jetzt nach den neuen Hilfsfunktionen. Der endgültige CI-Head wird im PR ausgewiesen. Voller Python-/Browser-/axe-Release-Review nur manuell oder per Label `release`, vor Owner-Merge; neue Widget-Prüfung in diesen Workflow aufgenommen. Noch keine ausgeführten Screenshots/axe für dieses neue Widget behauptet.

Frischer Whole-Branch-Review fand einen reproduzierten Root-Leserace mit Fake-Schlüssel und fehlende Verzeichnis-fsyncs. Additiver privater Root-Supervisor bereinigt reale/effektive `tl-agent`-UID-Prozesse vor und nach der Agentphase; bei unbestätigter Bereinigung kehrt er nicht in unsichere Root-Leseoperationen zurück. Parent-PID ist an den geschützten Dispatch gebunden. Profile sind vorerst auf einen Testaufruf beschränkt (darin darf eine ganze Suite laufen), weil der unveränderte Wrapper keinen sicheren Callback zwischen mehreren Kopierphasen besitzt. Verzeichnisse werden vor der Registrierung bottom-up synchronisiert; Regressionen prüfen Reihenfolge und Fehlerpfad. Gezielter Reviewer-Nachcheck: keine verbleibenden konkreten Blocker in diesen beiden Korrekturen. Das ersetzt nicht die unabhängige CodexChat-Sicherheitsabnahme.

**Live: NOT CONNECTED.** Laut Serverbefund sind TruthLens, Key, Run-Verzeichnis und aktive Capture-Pipeline noch nicht eingerichtet; bestehender ACP-Wrapper liefert keine Principal-Quelle. `codex` ist root-äquivalent (sudo/docker), daher keine D34-Isolation für bisherige codex-Workerläufe. Neues `tl-agent`-Konto, keine privilegierten Gruppen/sudo/Subuid-Delegation, dedizierter Prozesslebenszyklus, geschützte Installation/Verzeichnisse und echte Agent-Zero-Toolrechte müssen nach Shus gesonderter Host-Freigabe geprüft werden. [Inaktive Vorlagen und Voraussetzungen](../deploy/server/README.md). Keine Dienste/Benutzer/Schlüssel/öffentlichen Ports angelegt oder aktiviert, keine Host-Änderungen, kein Merge/Force-Push. PR95 unberührt.

## Gate #52 / #49: bounded follow-ups and durable delivery awaiting security review — 23 October 2026

Branch `w6/issue-52-gate-bounds`, base `931f111`: snapshot limits count directories, copied directory modes are restored deepest first, and temporary-tree creation failures after reservation record exit 127 without rearming the approval. Gate requests use bounded regular-file reads; response temps are flushed/fsynced before replacement and cleaned only after successful exclusive creation. Command-output digests scrub effective environment values and HMAC bytes before generic redaction; conservative environment over-redaction affects informational digests only. [Behavior and limits](WRAPPER-DESIGN.md#trust-boundaries).

The #49 follow-up builds on reviewed commit `1683795`: request filenames bind immutable per-run delivery identities to existing signed reservations/outcomes. Responses become durable before request removal; response directories are quarantined intact. Publication failures and restarts replay the existing result; a reserved action without outcome returns rc 2 / `indeterminate` without executing again. Separate per-ledger locks serialize duplicate requests. Fresh client IDs still permit deliberately repeated actions with separate approvals. See [the delivery contract](WRAPPER-DESIGN.md#trust-boundaries).

Locally witnessed: 115 focused gate/approval/rollback/ledger tests passed, 2 skipped and 1 expected failure (8.41s), including two approvals, a real counted command, publication failure/restart, crash reservation, cross-process duplicate acts, closed-run replay, rollback rejection and untrusted lookalikes. The full Python suite passed: 319 passed, 2 skipped, 1 expected failure (13.12s); `ruff check src tests` passed. New delivery regressions first reproduced early request removal, repeated execution after crash, stale-poll response overwrite and oversized quarantine names. These temporary fake-value fixtures do not prove live security isolation. Independent CodexChat security review remains required before closure or integration; no merge is authorized.

## Prüf-Agent: SPECC v1.2 abgeglichen — 22.10.2026

[PR #153](https://github.com/Shuwajaja/truthlens/pull/153) wird nach Eingang von `/home/codex/specs/truthlens-pruef-agent-specc-v1.2.md` ergänzt: verbindliche TL-AUD-001–012-Zuordnung, `not_applicable`, `ledger_last_hash`, `limitations` einschließlich XML-/Semantik-/Capture-Grenzen und Abbildung aller 18 Core-Abnahmefälle auf tatsächlich ausgeführte Tests. Die frühere Annahme einer fehlenden SPECC ist damit überholt. Keine Änderung der eingefrorenen Ereignisse, Rohdaten oder Freigaberegeln.

116 gezielte Tests lokal bestanden (1,87s), Ruff `src tests` grün. Neue JSON-Vertragstest-Anforderung vor Anpassung fehlgeschlagen und danach bestanden; unveränderte Ledger-Freigaberegeln zusätzlich unter TL-AUD-012 geprüft. Aktualisierter CI-Head und Ergebnis im PR; bisherige 113/CI-Grün beziehen sich auf den vorherigen Stand. Plan/SPECC nennen volle Suite in CI, abweichend von Shus neueren Fast-CI-Regeln; Abweichung gemeldet, Trigger nicht geändert. Tasks 7–9 warten weiterhin auf den vertrauenswürdigen Capture-/Snapshot-/Principal-Pfad, den der Nutzer gerade erfragt. Frischer SPECC-Abgleich fand zusätzlich den echten Wrapper-Typ `test_files_changed` statt des synthetischen Test-Typs; korrigiert und mit Fundstelle/geschützter Konfiguration getestet. Echte demo-2-Kopie und zwei beschädigte Kopien extern geprüft, jeweils Eingaben unverändert; intakte Kopie zeigt den realen widersprüchlichen Abschlussclaim, keine Authentifizierung. Kein Merge, kein Force-Push.

## Prüf-Agent: Tasks 1–6 zur Prüfung — 22.10.2026

[Issue #152](https://github.com/Shuwajaja/truthlens/issues/152), Branch `w5/issue-152-audit-verifier`, Basis main `a47ab739`. Deterministischer read-only Audit und CLI nach Plan v1.2: begrenzte sichere Dateizugriffe, wiederverwendete Chain-/Manifest-Verifikation, sämtliche Belegreferenzen, Testmetadaten und exakter Wrapper-Header, getrennte Behauptungsbefunde. Hash-only bleibt nicht prüfbar; Integrität ist keine Freigabe. Keine Änderung von Ledger, Manifest, Wrapper, Gate, Viewer, Rohdaten oder bestehenden Freigaberegeln. Additiver Entscheid D33 dokumentiert die Grenze.

Lokal 113 gezielte Audit-/Reader-/Ledger-/Tamper-/Manifest-/CLI-/Export-/MCP-Tests bestanden (1,85s), Ruff `src tests` bestanden. Frischer Whole-Branch-Review fand zwei fehlerhafte Eingabeformen mit Ausnahme statt JSON; beide mit beobachtetem Rot/Grün-Regressionstest behoben. Historisches demo-2 nur kopiert, Original unverändert und ohne vorhandenen Originalschlüssel nicht authentifiziert. Fast-PR-CI um die neuen Units ergänzt; kein voller Release-/Browser-/axe-Lauf. Der endgültige CI-Head wird im PR ausgewiesen. Sicherheitspfad: `needs-codex-review`, unabhängige CodexChat-Abnahme und Shus Merge-OK bleiben erforderlich.

SPECC v1.0 fehlt: Report-/Outcome-Vertrag und Zuordnung zu den 18 SPECC-Kriterien können nicht bestätigt werden. [Abgeleiteter Vertrag und Grenzen](spec/audit-verifier-v1.md). Tasks 7–9 sind nicht live angebunden: im geprüften ACP-Wrapper fehlt der belegte vertrauenswürdige Capture-/Snapshot-/Principal-Pfad. Rückfrage läuft; keine Live-Erfolge, Host-/Routing-Änderungen oder Widget-Abnahme behauptet. Nichts gemergt, kein Force-Push, PR95 unberührt.

# TruthLens — Status

## Issue #51: wrapper redaction follow-ups — 23.10.2026

Wrapper known-secret substitution now includes every nonempty value. Before storage and claim extraction, each valid recognized `TRUTHLENS_CLAIMS` JSON trailer is recursively redacted and serialized; malformed trailers retain ordinary text scrubbing, and claim extraction still selects the last trailer. The output blob is hashed from its sanitized stored bytes. Focused regressions cover a configured three-character secret, Unicode-escaped secret keys and values across multiple trailers, preserved neighboring output/fields, a valid signed ledger, and blob digest consistency. No ledger, gate, schema, or generic JSON decoding behavior changed.

## Viewer: Story/Timeline und schnelle PR-CI — 22.10.2026

[Issue #150](https://github.com/Shuwajaja/truthlens/issues/150), eigener Branch w4/issue-150-readable-chronology auf mainf1f6074. PR149 mit den Modusfarben wurde während der Arbeit extern gemergt; deshalb jetzt eigener unabhängiger PR, kein Stapel. Story und Timeline zeigen reale Zeit in Mono, Akteur und getrenntes Ergebnis, gruppiert nach zusammenhängenden aufgezeichneten Task/Result-Typen. Lange Texte und explizit referenzierte Originalinhalte lassen sich nativ aufklappen. Zeitlücken behaupten keine Agent-Aktivität; Behauptung/Bestätigung/Exit0 werden nicht als Erfolg gewertet. Daten, Schema und Freigaberegeln unverändert.

Quellstand `6ceb61e43071f0bf29c2027f9f9d86111311fc1e`:277 Unit-Tests lokal bestanden,22 abschließende betroffene Fälle ebenfalls; Lint/Stil/Sprache/134 Kontrastpaare/Build bestanden.66 schnelle Python-Units in0,60s. Manuell1440×900/390×844, beide Modi und beide Chronologien:8 Vorher-/16 Nachher-axe-Scans (geschlossen/geöffnet), keine Verstöße oder incomplete in diesem Umfang;8 originale3863-Zeichen-Inhalte per Tastatur geöffnet/gescrollt, keine Seitenüberläufe. [24 Bilder, Rohberichte und alte CI-Konfiguration](screenshots/w4/issue-150-readable-chronology/review-summary.md).

Shus neue Regel umgesetzt: pro PR nur Build/Lint/schnelle Units; volle Python-/UID-/Demo-/Toolbar-/Playwright-/axe-Prüfungen bleiben im manuellen workflow_dispatch release-review erhalten. Keine Tests gelöscht. Der manuelle Workflow wurde nicht ausgeführt; CI-Grün ist keine Release-/Screenreader-Abnahme. Fast-CI-Status zum endgültigen Head im PR; bei Grün merge-bereit melden, nicht selbst mergen. PR147s spätere Integration muss diese manuelle Planung beachten, keine automatische Voll-axe-PR-Schleife. PR95 unberührt.

## Viewer: Modusfarben zur Prüfung — 22.10.2026

[Issue #148](https://github.com/Shuwajaja/truthlens/issues/148), eigener Branch `w4/issue-148-mode-colours`, Basis main776212c nach den Owner-Merges von PR143/145. Client in entsättigtem Graugrün, Developer in kühlem Slate; eigene zentrale Tokens für gewählten Umschalter, schmalen Header-Streifen, dauerhaft sichtbares mobiles Moduslabel und beschriftete technische Zusatzbereiche. Keine Aussage über Prüfergebnis, Signatur oder menschliche Freigabe; tatsächliche Rollen und Daten unverändert.

Quellstand `69767fa0a0fbabb5517b554e0a11b360ce22ec2d`:272 Tests/25 Dateien, Lint, Hard-Color-/Sprach-/134 Kontrastprüfungen und Build bestanden.16 Browser-Modusfälle,32 Vorher-/Nachher-Bilder aller vier Ansichten/beider Modi bei1440×900/390×844, je36 vollständige axe-Scans vorher/nachher ohne Verstöße, je7 Tastatur-Scrollprüfungen. Neue Text-/UI-Kennfarben mindestens6,46:1;88 gezielte Scroll-/Hit-Test-Prüfungen bestehen. [Nachweise und offene incomplete-Grenzen](screenshots/w4/issue-148-mode-colours/axe-summary.md). CI zum endgültigen Head im PR. Kein Merge/Force-Push; echter Screenreader-Sprachlauf bleibt offen, PR95 unberührt. Der vollständige48-Zustands-CI-Ausbau liegt separat in PR147.

## Viewer: Hauptansicht per URL zur Prüfung — 22.10.2026

[Issue #144](https://github.com/Shuwajaja/truthlens/issues/144) / [PR #145](https://github.com/Shuwajaja/truthlens/pull/145), Branch `w4/issue-144-view-urls` auf main6c66473, nach den PR141-/PR143-Squashes. Die vier bestehenden Ansichten sind über `?view=overview`, `claimed-vs-proven`, `timeline` und `agent-story` direkt teilbar; Neuladen und Zurück/Vorwärts stellen sie wieder her. Unbekannte/fehlende Werte führen zu Overview; sonstige URL-Teile und gespeicherte Linse bleiben unabhängig. Keine neuen Share- oder Layout-Elemente, keine Stil-/Rohdaten-/Schema-/Freigabeänderung.

Geprüfter Quellstand `78681d8d90de41d01f0e8c2354e01643eb729748`:272 Tests/25 Dateien, Lint, Sprach-/Stil-/bestehende Kontrastprüfungen und Build erfolgreich.16 echte Direktlink-/Neuladen-/Kopierfälle plus4 Tastatur-/History-/Fallback-Fälle bei1440×900/390×844 und beiden Linsen;36 vollständige axe-Scans ohne Verstöße,7 Tastatur-Scrollprüfungen. Bestehende Layout-Snapshots unverändert. [Aktualisierte Screenshots, vollständige Berichte und Grenzen](screenshots/w4/issue-144-view-urls/flow-integration/axe-summary.md). Incomplete-Ergebnisse bleiben manuell offen. CI zum endgültigen Head im PR; keine pauschale WCAG- oder Nutzungsabnahme.

PR141 ist als Squashcc9929e auf main gemergt. PR143 ist inzwischen durch den Owner als Squash6c66473 auf main gemergt, einschließlich Statusakzenten. PR145 integriert denselben main-Stand ohne Force-Push; URL-Hook, URL-Tests und Browserprüfung bleiben bytegleich. Dieser P2-Branch dupliziert PR143 nicht. Kein Agent-Merge, PR95 unberührt.

## Viewer: gemeinsamer Stitch-Stil und Prüfweg auf main — 22.10.2026

[Issue #142](https://github.com/Shuwajaja/truthlens/issues/142) / [PR #143](https://github.com/Shuwajaja/truthlens/pull/143), eigener Branch `w4/issue-142-stitch-flow`. PR139 ist als Squash31dbf35 auf main gemergt. PR141 (zentrale Stitch-Farben) ist inzwischen als Squashcc9929e auf main gemergt. Sein Inhalt ist identisch zum bereits integrierten Stand ec1079a; maincc9929e ist zusätzlich als Vorfahr integriert, ohne weitere Viewer-Änderung. Main ist Vorfahr beider Branches; kein Force-Push. Der Rebase hat die Viewer-Inhalte erhalten; Shus anschließender Auftrag ergänzt semantische Statusleisten/-tönungen und Emerald-Auswahlakzente. Keine weiteren PRs gemergt. Keine menschliche Abnahme; PR95 unberührt.

Komponenten-Inventar und einzeln begründete Entscheidungen zu UX3–8 stehen in viewer/DESIGN.md. Alle vier Ansichten verwenden ein gemeinsames Seitengerüst und gemeinsame Komponenten; die dauerhafte doppelte Belegspalte samt inaktivem Navigator entfällt. Laufdetails sind global zugänglich. Ergebnis-Karte -> echtes passendes Kriterium -> vorhandener Beleg ist per Tastatur und mobil geprüft; leere Kategorien/Belege werden nicht erfunden. Auswahl führt zum Detail, Rückweg zur Overview setzt Fokus, Drawer nennt das ausgewählte Objekt. Schema, Rohdaten und Freigaberegeln unverändert.

Geprüfter Quellstand `52ed0975cc12e09e4760d22ac02cb97c17673794`:263 Tests/24 Dateien, Lint, Sprach-/Stil-/Kontrastprüfung und Build erfolgreich. Je36 vollständige axe-Scans vorher/nachher ohne Verstöße, je7 Tastatur-Scrollprüfungen, Vorher-/Nachher-Screenshots aller vier Ansichten bei1440×900/390×844. Zwölf echte Tastatur-Prüfwege und zwölf Rückwege in beiden Linsen/Größen bestanden. [Neueste Statusakzente:32 Vorher-/Nachher-Bilder,116 Kontrastpaare und volle axe-Berichte](screenshots/w4/issue-142-stitch-flow/status-accents/axe-summary.md); [Vorher/Nachher und Grenzen](screenshots/w4/issue-142-stitch-flow/axe-summary.md). Story als Liste statt Karte pro Ereignis; Ziffern zentral in JetBrains Mono, Diff-Markierungen neutral. Eigener verbindlicher Regelabschnitt in DESIGN.md aus Farb-PR141 übernommen. Incomplete-Ergebnisse bleiben manuelle Prüfpunkte; keine behauptete Nutzungsstudie, keine pauschale WCAG-Abnahme.

Dritter P1 als Squash6c66473 aus PR143 auf main ausgeliefert. Weitergehende Graph-Layouts, neue Story-Zusammenfassung, URL-Wiederherstellung und authentifizierte Kommentare sind ausdrücklich nicht erledigt. CI zum endgültigen Head steht im PR.

## Viewer: Client-Behauptung und Prüfergebnis zur Prüfung — 22.10.2026

Ausgangspunkt: `main` bei `29e930bd318dd8305e1dc6bb00e7cb6d11257669`, nach dem Squash-Merge von #137. [Issue #138](https://github.com/Shuwajaja/truthlens/issues/138) / [PR #139](https://github.com/Shuwajaja/truthlens/pull/139) ergänzt den nächsten P1: Im Client zeigt „Claimed vs proven“ Behauptung, aufgezeichnetes Kriteriumsergebnis und vorhandene Belege gemeinsam. Die Overview zeigt beim gewählten Kriterium die tatsächlich zugeordneten Behauptungstexte. Der Demo-Lauf hat einen belegten Erfolg, einen fehlgeschlagenen Test und ein ungeprüftes Kriterium mit ehrlichem Leerzustand. Kein Developer-Wechsel nötig.

Zuordnung ausschließlich über exportierte Kriterien-/Ereignis-IDs; fehlende oder teilweise fehlende Referenzen werden benannt. Keine erfundenen Belege, keine Änderung von Schema, Rohdaten, Freigaberegeln oder Integritätsgrenzen. Englische UI und Stitch-Design beibehalten. PR #95 unberührt.

Geprüfter Quellstand `c1883d531c37b137ddaea4b6496c47b68376e21e`: 237 Tests/22 Dateien, Lint, Stil-/Sprachprüfung und Build erfolgreich. 36 vollständige Baseline-axe-Scans plus8 zusätzliche Event-Drawer-Scans ohne Verstöße; sieben Tastaturprüfungen. Screenshots bei1440×900/390×844 und12 gezielte echte Client-Zustände. [Nachweise, Screenshots und Grenzen](screenshots/w4/issue-138-client-results/axe-summary.md). Incomplete-Ergebnisse bleiben manuelle Prüfpunkte. PR #139 offen, noch nicht gemergt: dieser P1 ist zur Prüfung bereit, nicht auf main ausgeliefert. Keine menschliche Abnahme. CI zum endgültigen Head steht im PR.

## Vorheriger P1: Kriterienbestätigung — Nachweis vom 22.10.2026

Aktueller Ausgangspunkt: `main` bei `980d8b7ea6be946080bbfcc2b84048af3ff85cbd`, nach den Merges von #133/#135. Dieser Auftrag ändert nur die Anzeige von `criteria.confirmed`; keine menschliche Abnahme, keine Änderung von Ereignisschema, Rohdaten oder Freigaberegeln. PR #95 bleibt unberührt.

[Issue #136](https://github.com/Shuwajaja/truthlens/issues/136) / [PR #137](https://github.com/Shuwajaja/truthlens/pull/137): In Timeline und eingebetteter Overview steht jetzt „Criteria confirmed by human“ ausschließlich bei aufgezeichnetem menschlichem Akteur, sonst „Criteria confirmation recorded“. „Confirmation is not a test result.“ grenzt die Bestätigung von tatsächlich bestandenen Prüfungen ab. Englische UI und Stitch-Design bleiben erhalten; der Drawer erhält das unveränderte Originalereignis.

Geprüfter Quellstand `961a00e083d36a663c34f12465dbc15db759b2f2`: 230 Tests/21 Dateien, Lint, Stil-/Sprachprüfung und Build erfolgreich; 36 vollständige axe-Scans ohne Verstöße, sieben Tastaturprüfungen und Screenshots bei 1440×900/390×844. [Nachweise und Grenzen](screenshots/w4/issue-136-criteria-confirmed/axe-summary.md). Axe-Incomplete-Ergebnisse bleiben manuelle Prüfpunkte. PR #137 wurde inzwischen als Squash29e930b auf main gemergt; der erste P1 ist damit dort enthalten. Die hier verlinkten Prüfungen bleiben historische Nachweise dieses früheren Quellstands. Die übrigen historischen P1/P2-Punkte wurden in diesem begrenzten Auftrag nicht neu bewertet. CI-Status zum aktuellen PR-Head steht im PR.

## Historischer Viewer-Prüfstand vor den UI-Merges vom 22.10.2026

Stand durch Codex (`actor.kind = agent`), keine menschliche Abnahme. `origin/main` steht bei `40dbb8c4f9521a56280c8b17a69e03216e1ba105`. **Im Rahmen dieses Auftrags wurde nichts gemergt.** Die nachfolgenden P0-Angaben vom 21.10. sind historische Einzelbranch-Nachweise und beschreiben nicht den heutigen Viewer-/PR-Stand.

### Erledigt bzw. zur Prüfung bereit

| Arbeit | Nachgewiesener Stand | Referenz |
| --- | --- | --- |
| Preview-only Toolbar | Technisch abgeschlossen; PR offen, nicht gemergt. CI auf `f1849ee` erfolgreich. Plattform-Script hinter `</html>` wird wiederverwendet: ein Script, ein Request; Production ohne Loader. Kein zusätzlicher Vercel-Zugriff von Shu nötig. | [PR #127](https://github.com/Shuwajaja/truthlens/pull/127), [CI #438](https://github.com/Shuwajaja/truthlens/actions/runs/39725711739), [Nachweise](https://github.com/Shuwajaja/truthlens/blob/f1849ee6f531de7a88c89f653f1bd2852fc7def7/docs/screenshots/w4/issue-126-toolbar-rules/axe-summary.md) |
| `label-content-name-mismatch` und `scrollable-region-focusable` | Mit PR #125 bereits behoben und in `main`. Kein weiterer Fix-PR nötig. Der ursprüngliche Nachweis umfasst 36 vollständige axe-Scans ohne bestätigte Verstöße und sieben erfolgreiche Tastatur-Scrollprüfungen. | [PR #125](https://github.com/Shuwajaja/truthlens/pull/125), [Fix-Nachweise](https://github.com/Shuwajaja/truthlens/blob/2e7191409b69a65de5fa3946ed231e0d67d7bbb9/docs/screenshots/w4/issue-124-axe-fixes/axe-summary.md) |
| UX-Bestandsaufnahme der Live-Seite | Fertiger Dokumentations-PR mit neun priorisierten Befunden und 28 neuen Screenshots. CI auf `d89a789` erfolgreich; PR offen. Der Live-Audit umfasst 18 vollständige axe-Scans bei 1440×900/390×844 ohne bestätigte Verstöße. | [PR #129](https://github.com/Shuwajaja/truthlens/pull/129), [Bericht](https://github.com/Shuwajaja/truthlens/blob/d89a789ce8c0ffc650831b5b43b2ba6f1ba992fa/docs/ux/review-2026-10-22.md), [CI #440](https://github.com/Shuwajaja/truthlens/actions/runs/39727154498) |

Die Live-Produktion lädt weiterhin `index-4429mvGn.js`; derselbe Bundle-Name wie beim dokumentierten Live-Audit wurde erneut per HTTP geprüft. Die verlinkten Browser-/Testnachweise stammen aus den angegebenen Läufen, nicht aus einem neu behaupteten vollständigen Testlauf. Diese Statusänderung verändert keinen Anwendungscode.

### Was für einen fertigen Viewer noch fehlt

Priorisierte Arbeitsliste aus dem Live-Review und den dokumentierten Prüflücken; Vorschläge für die nächsten Aufträge, keine Behauptung einer bereits erfolgten Produktabnahme.

| Priorität | Offene Arbeit | Woran die Erledigung erkennbar wäre |
| --- | --- | --- |
| P1 · gemergt | „Criteria met“ bei `criteria.confirmed`: Korrektur aus [PR #137](https://github.com/Shuwajaja/truthlens/pull/137) auf main (29e930b). | Menschliche Kriterienbestätigung und bestandene Prüfungen getrennt; Tests, Screenshots und vollständiger axe-Nachweis siehe aktuellen Abschnitt oben. Ereignisschema, Rohdaten und Freigaberegeln unverändert. |
| P1 · gemergt | Client-Behauptung und tatsächliches Prüfergebnis: [PR #139](https://github.com/Shuwajaja/truthlens/pull/139) auf main (Squash31dbf35). | Demo-Erfolg, fehlgeschlagener Test und ungeprüftes Kriterium ohne Developer-Wechsel mit echten bzw. ausdrücklich fehlenden Belegen; Nachweise im aktuellen Abschnitt. |
| P1 · gemergt | Gemeinsamer Stitch-Stil und Hauptweg „Ergebnis → Kriterium → Beleg“ aus [PR #143](https://github.com/Shuwajaja/truthlens/pull/143) auf main (6c66473). | Vorher-/Nachher-Nachweise und begründete UX3–8-Entscheidungen im aktuellen Abschnitt; weitergehende Graph-/Story-Arbeit bleibt separat. |
| P2 · gemergt | Gewählte Hauptansicht per URL wiederherstellbar aus [PR #145](https://github.com/Shuwajaja/truthlens/pull/145), auf main776212c. | Ein geteilter Link bzw. Neuladen öffnet die beabsichtigte Ansicht; der beobachtete Rücksprung von Timeline zu Overview ist behoben. |
| P2 | Manuelle Barrierefreiheits-Prüfpunkte abschließen und vollständigen axe-Check dauerhaft absichern. | `aria-hidden-focus`, `aria-prohibited-attr` und `color-contrast`-Incomplete werden manuell geklärt; sie sind keine bestätigten Verstöße. Fokus, Screenreader und relevante Detail-Tabs prüfen. Shus neue Regel: vollständiges axe bei1440×900/390×844 im manuellen Release-Workflow, schnelle PR-CI separat; Integration aus PR147 muss dies beachten. Echter Screenreader-Sprachlauf bleibt offen. |
| P2 | Abschließende Bedienungsprüfung mit realen Daten und Preview-Kommentaren belegen. | Eine Person kann das fehlgeschlagene Kriterium und seinen Beleg finden und die Integritäts-/Abnahmegrenze erklären. Andere gültige Exporte sowie Lade-/Fehlerfälle gezielt prüfen. Für die Toolbar ist die authentifizierte Kommentar-Abgabe noch nicht getestet; die letzte Änderung prüfte nur Laden/Reuse/Fallback. Keine Testkommentare ohne ausdrücklichen Auftrag senden. |
| Freigabe | Eigentümerprüfung der offenen PRs und des späteren Gesamtstands. | Shu gibt die gewünschten PRs ausdrücklich frei; CI und Nachweise passen zum dann geprüften Stand. Kein Agent-Merge im Rahmen dieses Auftrags. Der P0-Gesamtproduktstatus wird dadurch nicht automatisch als erledigt erklärt. |

Unverändert erforderlich: englische UI, echte Exportdaten, neutraler Hash-only-Hinweis, sichtbares „Integrity is not approval“ und „Signature checked“ ausschließlich bei `verified === true && integrity === 'hmac'`. Die Web-Oberfläche prüft keine Signaturen selbst. Neue Produktfunktionen wie ein echter Navigator sind nicht automatisch Voraussetzung dieses begrenzten Auftrags.

## Historischer P0-Stand vom 21.10.2026

Die folgenden Messungen und Integrationsaussagen bleiben als damalige Nachweise erhalten. Insbesondere „all changes are local“ und die damalige CI-Beschreibung gelten für diesen historischen Abschnitt, nicht für die oben verlinkten aktuellen PRs.

Updated: **2026-10-21 UTC** · by Codex (`actor.kind=agent`). Target: **2026-10-25**.

Scope is v1 stabilization and documentation. Event Schema v1 and Artifact Manifest v1 remain frozen. TruthLens is MIT-licensed under [LICENSE](../LICENSE), as confirmed by Shu. New product features remain outside P0.

### Repository and integration state

The baseline is local `main` at `9f7d636`. All changes below are local: no push, merge, pull request or deployment was performed. Items 1–5 were accepted by VPSMan on Shu's behalf in the task conversation. Items 6–7 have local checks; owner integration and the required HMAC security review remain open. No combined, merged P0 tree has been tested.

The hashes below identify implementation commits. Later status-only commits may follow on the same branch.

| Item | Change | Branch | Implementation commit | Observed local checks |
|---|---|---|---|---|
| 1 | Preserve old diff content; remove duplicate functions | `p0/bug-1-diff` | `f32578a` | Python: 176 passed; Ruff; offline demo. |
| 2 | Reject dictionary keys that collide after NFC normalization | `p0/bug-2-canonical` | `3e9e5c9` | Python: 173 passed; Ruff; offline demo; existing demo hashes unchanged. |
| 3 | Validate the complete RunDoc shape before rendering | `p0/bug-3-viewer-validate` | `3ee4a7b` | Vitest: 66 passed; Viewer lint/build; Python: 170 passed; Ruff. |
| 4 | Reject non-object MCP requests and keep processing | `p0/bug-4-mcp` | `663dbc1` | MCP: 9 passed; Python: 175 passed; Ruff; real stdio continuation check. |
| 5 | Repair corrupted existing blobs using atomic replacement | `p0/bug-5-store` | `37a8ae3` | Store: 3 passed; Python: 172 passed; Ruff; offline demo. |
| 7 | Report actual export integrity and the browser trust boundary | `p0/viewer-honest` | `90f6dc6` | Export integrity: 10 cases; Python: 180 passed; Vitest: 77 passed; Ruff; Viewer lint/build; offline demo. |
| 6 | MIT license text, this status and Viewer CI | `p0/docs` | `f3d29f2` | Python: 170 passed; Ruff; Viewer install/build/lint; test-script guard skips on main. |

Every listed Python suite also reported **2 skipped, 1 xfailed**. The differing pass counts are from separate branches, not a cumulative test run. No remote CI result is claimed for these unpushed commits.

### Measurements on the documentation branch

Python 3.12.3, with the clone's `.venv/bin` on the command's `PATH`:

```text
pytest -q -rs
170 passed, 2 skipped, 1 xfailed
ruff check src tests
All checks passed!
```

The two skips require a separate Unix user `tl-agent`, sudo access and its dedicated environment. The expected failure records the known same-UID key-access risk; none of these results proves OS-level isolation. Running tests from an unactivated temporary extract can instead fail `test_r6_gate_config_file_outside_refused_even_if_missing` because the `python` executable cannot be found; use the intended virtual environment.

The Viewer CI job uses Node 24 and runs, from `viewer/`:

```sh
npm ci
npm test --if-present
npm run build
```

On this branch from `main`, there is no `npm test` script yet, so the middle command deliberately skips tests; install and production build are checked locally. After `p0/bug-3-viewer-validate` is integrated, the same command runs Vitest and test failures fail CI. The flag accommodates either merge order; it does not claim tests exist on the old baseline. The script-present path was also exercised on `p0/viewer-honest`: 77 tests passed.

### Integration order and export compatibility

- `p0/viewer-honest` is based on `p0/bug-3-viewer-validate` (`3ee4a7b`), not directly on `main`; integrate bug-3 before its Item 7 follow-up.
- Items 1, 2, 4, 5 and this documentation branch are based independently on `main`. The owner controls integration; no branch has been merged by Codex.
- Item 7 changes the existing Viewer export `verified` meaning: only a real HMAC check with a key produces `true` / `hmac`; without a key, a consistent run is `false` / `hash-only`. Failed checks are `false` / `failed` and fail closed.
- The Viewer in Item 7 renders hash-only runs, rejects failed/inconsistent exports and labels the export-time check. Legacy exports without an explicit `integrity` field must be regenerated. That branch regenerates `viewer/public/run.json` from the committed `demo/runs/demo-2` without a key.
- Stored event/manifest formats and their hashes are unchanged. Item 7 records the metadata correction as D32 in the spec changelog and [TRUST-LEVELS.md](TRUST-LEVELS.md).

### Known limits

- The browser checks document shape, integrity-label consistency, card/status rules and counts. It does **not** verify ledger/blob hashes, HMAC or signatures. A consistently forged export can still be displayed.
- A same-UID agent and HMAC key holder do not form an isolation boundary: the agent can read the key and forge records. Separate-user/container isolation remains necessary; this P0 work makes no server or security-configuration changes.
- A witnessed test means the restored test command reported success. Code inside the test process can forge its result; this is the accepted v1 limit.
- The approval gate is not a sandbox. It controls capabilities routed through the gate, not everything an agent can do with its own account.

### Open work

- Owner review/integration, including the required review for wrapper/HMAC changes, and CI on the eventual combined tree.
- Prepare the 3-minute product demo. Existing scripted offline demo and tamper detection pass locally; this does not replace that product demo.
- Ledger append performance (quadratic re-read) is **post-v1**, not a P0 optimization task.
- No RenderKit, Factory, new capture features, remote hosting or deployment work is included.
