# Demo task fixture (golden path)

Task given to the agent (verbatim): **"Build a small landing page with a contact form."**

Run inside a throw-away fixture repo (`demo/fixture-landing/`, created by the demo script), wrapped by `truthlens run -- <agent>`.

## Criteria (derived → `proposed`, then confirmed by the human with `criteria.confirmed`)
| id | Criterion | Witness that can decide it | Expected status |
|---|---|---|---|
| `c1` | Page exists (`index.html` with a heading and a form) | `file_changed` evidence + witnessed test `test_page_exists` | `met` |
| `c2` | Form validates the e-mail address (invalid input rejected) | witnessed test run `test_email_validation` (unit test on the validation function) | `met` or `unmet` – whatever the real run shows |
| `c3` | Mobile layout works | none in MVP (no browser test) | `unverified` – even if the agent claims "done" → shown as `claimed` vs witnessed gap |

## Rules
- Numbers in the demo script come only from a real recorded run (ledger + `truthlens verify`), never typed in.
- Agent statement "all done, tests green" is recorded as `agent.claim` (`actor.kind = agent`).
- Final step of the demo: edit one byte of the ledger → `truthlens verify` fails closed.
