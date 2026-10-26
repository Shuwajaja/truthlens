# Demo runs

## Run 2 – current committed canonical demo

The checkout contains `demo/runs/demo-2/`, run
`run_01M4NPV2TEX4NE8M3PQNBXTPPV`, starting at
`2026-10-11T14:46:01.809Z` (16:46 Europe/Berlin), with **16 events**.
This corrects the older transcript that described a different 14-event recording.
The ledger contains HMAC fields; the public walkthrough has no signing key and
checks hashes only. It does not authenticate the recorder or grant approval.

From the repository root, with Python 3.12+ and no installation:

```bash
PYTHONPATH=src python3 -m truthlens verify demo/runs/demo-2/ledger.jsonl
PYTHONPATH=src python3 -m truthlens report demo/runs/demo-2
```

The ledger check reports `OK 16 events, anchored`. The report confirms manifest
consistency and these recorded outcomes:

| Criterion | Status | Claim finding |
|---|---|---|
| Page exists with heading and form | `met` | `supported` |
| Email validation rejects invalid input | `unmet` | `claim_unwitnessed` |
| Mobile layout works | `unverified` | `claim_unwitnessed` |

The agent recorded separate claims that it created the page, validated email
using a regex, and used a fluid layout. Wrapper-started tests support the page
criterion and contradict the validation criterion; no recorded witness decides
mobile layout. These are recorded results, not tests rerun by the walkthrough.
The [README screenshots](../README.md) show this run in the current viewer.

## Run 1 – first recorded run (before #27; claims are recomputed at report time, the ledger itself is unaffected) (2026-10-11 04:18–04:19 Europe/Berlin)

Recorded with `truthlens run` (PR #26) on the fixture from `demo/make-fixture.sh` (docs/DEMO-TASK.md).
Agent: OpenCode `opencode run -m openrouter/deepseek/deepseek-v4-flash "Build a small landing page with a contact form."`
Ledger, manifest and blobs: `demo/runs/demo-1/` (run `run_01M4MC2KEQCV2BHZYS5KSQ1JYT`, 21 events, HMAC-signed, key kept outside the repo and outside the agent env).

```
$ truthlens verify demo/runs/demo-1/ledger.jsonl --hmac-key-env TL_HMAC --expect-last-hash <manifest.ledger_last_hash>
OK 21 events, anchored
$ truthlens report demo/runs/demo-1
VERIFIED 21 events, anchored, manifest consistent
  c1     met         Page exists (index.html with a heading and a form)  (evidence: 1)
  c2     met         Form validates the e-mail address (invalid input rejected)  (evidence: 1)
  c3     unverified  Mobile layout works  (evidence: 0)
  claim  supported         'Page exists at index.html with heading and contact form' -> ['c1']
  claim  supported         'validate.js exports isValidEmail that validates according to spec' -> ['c2']
  claim  claim_unwitnessed 'Mobile layout works via CSS media queries and responsive viewport' -> ['c3']
```

Witnessed by the wrapper (not the agent): `tests/test_page_exists.py` 1 passed / 0 failed, `tests/test_email_validation.py` 1 passed / 0 failed (7 e-mail cases). Changed files: `index.html`, `style.css`, `app.js`, `validate.js` (+ two `__pycache__` files from the agent running pytest itself – the agent's own test runs are claims only).

The gap the demo shows: the agent claims c3 (mobile layout); nothing witnessed it, so c3 stays `unverified` and the claim is `claim_unwitnessed`.

Tamper check (copy of the run, `failed:0→1` in line 19, `passed:1→2` in line 20): `verify` → `FAIL line 19: hash mismatch / hmac mismatch …`, exit 1.

Cost: OpenRouter key usage 0.3468 → 0.3499 USD after the run (≈0.003 USD; provider usage may lag).
