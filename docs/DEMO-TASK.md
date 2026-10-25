# Demo task fixture (golden path)

Task given to the agent (verbatim): **"Build a small landing page with a contact form."**

Run inside a throw-away fixture repo (`demo/fixture-landing/`, created by the demo script), wrapped by `truthlens run -- <agent>`.

## Criteria (derived → `proposed`, then confirmed by the human with `criteria.confirmed`)

`demo/make-fixture.sh` intentionally emits agent-derived proposals for this
interactive path. Server profiles have no confirmation step and must not treat
this fixture as ready-made checkable criteria; see the
[server profile guide](../deploy/server/README.md#profile-preflight-before-a-server-run).
Only criteria actually supplied by a human use `source: "user"`; copying or
running this fixture does not create a human confirmation or approval.

| id | Criterion | Witness that can decide it | Expected status |
|---|---|---|---|
| `c1` | Page exists (`index.html` with a heading and a form) | `file_changed` evidence + witnessed test `test_page_exists` | `met` |
| `c2` | Form validates the e-mail address (invalid input rejected) | witnessed test run `test_email_validation` (unit test on the validation function) | `met` or `unmet` – whatever the real run shows |
| `c3` | Mobile layout works | none in MVP (no browser test) | `unverified` – even if the agent claims "done" → shown as `claimed` vs witnessed gap |

## Rules
- Numbers in the demo script come only from a real recorded run (ledger + `truthlens verify`), never typed in.
- Agent statement "all done, tests green" is recorded as `agent.claim` (`actor.kind = agent`).
- Final step of the demo: edit one byte of the ledger → `truthlens verify` fails closed.
