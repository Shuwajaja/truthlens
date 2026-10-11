# Demo run 1 – first real recorded OpenCode run (2026-10-11 04:18–04:19 Europe/Berlin)

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
