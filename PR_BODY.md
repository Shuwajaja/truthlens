# Phase B: D34 local read boundary

Prepared locally on `feat/phase-b-read-service`. No push, PR, merge, deployment
or host setup. Tested implementation: `21343112f64e32f162c2a4b11f799b3d48c5b41c`;
the following evidence commit changes documentation only.

## Summary

The reader CLI serves one protected Shu view on `127.0.0.1:8765`, refuses root
execution and accepts only GET/HEAD. The private root-only registry remains
unchanged: an unprivileged reader consumes a separate protected publication
index of already registered snapshots and stored audit reports. No publisher,
registration, audit-start or approval operation is added.

Health/catalog/document/events are joined by artifact metadata, referenced
captured blob metadata/bytes and run/anchor-bound stored audit reports. Reads
reject unsafe paths, links, changed digests and resource overruns; foreign and
unregistered runs receive the same generic unavailable result. RunDoc stays
hash-only, never fresh HMAC verification. Host/Origin and no-store/nosniff/CSP
protections apply to all routes. Limits remain 50 runs/100 events per page.

The existing same-origin local Viewer adapter and Not connected fallback are
reused without changing UI source or production fixture behavior. Agent Zero's
disconnected ACP adapter now exposes only passed / failed / not checkable and
fixed notices, omitting run IDs and all private fields. Its future UID-restricted
Unix status socket is documented, not provisioned. The old Unix reader remains
compatibility code/tests, outside the module CLI. Inactive operating examples
now use `tl-reader`/`tl-readers`, no capabilities, and SSH loopback forwarding.

## Allowed paths and actual scope

- `src/truthlens/read_service.py`, `src/truthlens/read_projection.py`
- `tests/test_phase_b_reader.py`, `tests/test_read_service.py`
- `tests/test_round5.py`: require the pre-existing writable host workspace before
  running the existing separate-UID probe; security assertions unchanged.
- `viewer/tests/AgentStory.test.tsx`: pin snapshot tests to UTC and restore env.
- `integrations/agent-zero-acp/{audit-status.cjs,audit-status.test.cjs,README.md}`
- `deploy/server/{truthlens-reader.service,README.md}`: inactive examples only.
- `docs/spec/audit-verifier-v1.md`: record the owner's clarified D34, superseding
  earlier D36 human transport preparation. No frozen event/manifest/trust edits.
- `docs/STATUS.md`, `PR_BODY.md`

## Plan and red/green evidence

Plan: inspect existing reader against D34; add failing boundary tests; implement
published reads and loopback transport; review; run complete local suites and
record limitations; commit locally. ECC TDD, security-review and verification-loop
skills applied. No runtime dependency added.

- `bb71134`: new fixture boundary tests first executed with
  `TZ=UTC .venv/bin/pytest -q tests/test_phase_b_reader.py`: 12 failed, 11 errors
  because the published projection/loopback config did not exist. No missing
  dependency or syntax failure caused this red state.
- `e36e36f`: `node --test integrations/agent-zero-acp/audit-status.test.cjs`:
  2 failed, 2 passed before the closed status vocabulary was implemented.
- `867e1cb`: wrong-run stored report regression first failed because a
  digest-valid foreign report was returned; run/anchor binding fixed it.
- Original AgentStory tests under `TZ=Europe/Berlin`, from `viewer/`:
  `npx --no-install vitest run tests/AgentStory.test.tsx`: 3 failed, 4 passed.
  The same command after test-local UTC selection: 7 passed; snapshots unchanged.
- Targeted combined reader suite after implementation: 88 passed.
- `2134311`: implementation and fixes, with the complete checks below observed
  on identical source/test bytes before commit.

## Checks run and observed results

Commands use `umask 022`; temporary fixtures/caches for final checks were kept
inside ignored `.venv/` or dependency directories. Python's venv was on PATH for
subprocess tests. No host directories were created to satisfy prerequisites.
Deviation: the initial red pytest invocation used its default `/tmp` fixture
root before subsequent invocations were confined to this repo. No host
configuration was changed; no external cleanup was attempted.

```sh
PATH="$PWD/.venv/bin:$PATH" TZ=UTC TMPDIR="$PWD/.venv/tmp" \
  COVERAGE_FILE="$PWD/.venv/.coverage" .venv/bin/pytest \
  --basetemp=.venv/full-pt -q -rs --cov=truthlens.read_service \
  --cov=truthlens.read_projection --cov-report=term-missing
```

Final full Python result: **469 passed, 2 skipped, 1 xfailed, 15 subtests passed**,
22.06s. Reader-module coverage combined 81% (projection 88%, service 77%); this is
not whole-project coverage. The first full run had 469 passed, 1 failed, 1 skipped,
1 xfailed because the existing separate-UID test detected an account but lacked
`/srv/tl-agent/wt`. The corrected prerequisite guard skips that host-dependent
test; no assertion was removed or changed. The second skip requires the host
agent venv; the expected failure records same-UID key exposure. These are not
successful live isolation tests.

```sh
TZ=UTC TMPDIR="$PWD/.venv/tmp" .venv/bin/pytest --basetemp=.venv/pt -q \
  tests/test_phase_b_reader.py tests/test_read_projection.py tests/test_read_service.py
.venv/bin/ruff check src tests
node --check integrations/agent-zero-acp/audit-status.cjs
node --test integrations/agent-zero-acp/audit-status.test.cjs
```

Results: 88 targeted reader tests passed; Ruff passed; ACP syntax passed and 4
status tests passed. The reader tests exercise real synthetic ledger/blob bytes
and temporary HTTP listeners under one UID; ownership checks are substituted
for fixture ancestry. They do not prove a deployed reader or UID isolation.

From `viewer/`:

```sh
TZ=Europe/Berlin TMPDIR="$PWD/../.venv/tmp" npm test
TZ=UTC TMPDIR="$PWD/../.venv/tmp" npm run lint
TZ=UTC TMPDIR="$PWD/../.venv/tmp" npm run build
```

Results: **329 tests  / 36 files passed** (43.38s); full toolbar build matrix and
language/style/210 theme contrast-pair checks passed. Lint and production build,
including `tsc -b`, passed. Existing JSDOM `scrollTo` notices remain test-env
warnings. No new browser screenshot/axe run was required or performed because
Viewer production code and styling are unchanged. No remote CI result claimed.

Final document/diff checks passed: `git diff --check`, required-document
existence, 4 local Markdown link targets, 14 changed paths within the allowlist,
and byte comparison of frozen contracts and unchanged core security files.
Changed-content credential-pattern review found zero matches and printed only
aggregate counts, never matching values; this is a scoped check, not a
whole-history secret audit.

## Independent security review

Classification: **needs-codex-review**. Independent Codex subagent
`/root/reader_security_review` reviewed the implementation and scoped fixes,
then directly verified clean code commit `21343112f64e32f162c2a4b11f799b3d48c5b41c`.
No blocking finding remained. The audit report's run/anchor binding and the
host-prerequisite guard were included. Review was static/synthetic; the reviewer
did not duplicate the author's suites or claim live acceptance.

Reviewed Git blob IDs:

- Service: `e869bb2849d63e977ec9dfaa07a2df6db5f17be1`
- Projection: `bd7157ed65be938c62857405532706691ee5f302`
- ACP adapter: `8e72a7d31368270cf165333356e174105e087201`

## Open risks and live prerequisites

- Loopback and browser headers do not authenticate a human or exclude workers.
  Live operation requires separately authorized and witnessed worker UID/netns
  denial, SSH policy, an unprivileged reader, and least-privilege group reads.
- No trusted publisher is implemented/activated. An operator must derive the
  separate read index only from real admitted, closed Shu-authorized captures
  and publish durably. Incorrect trusted publication cannot be detected as
  fabricated origin by SHA-256. Never relax private registry/key permissions.
- Agent Zero's dedicated UID-restricted status-only Unix socket remains future
  work. Never expose this human evidence listener to its container.
- No real eligible snapshot/report, tunnel, separate UID, live key denial,
  peak-memory/load acceptance, browser flow or service sandbox was exercised.
  The verifier still buffers ledger bytes. Unit memory limits are not measured
  capacity guarantees.
- Hash-only RunDoc and stored audit findings do not establish fresh signature
  checks, current source state or human approval. Frozen contracts stay intact.
