#!/usr/bin/env bash
# Creates the throw-away demo fixture repo (docs/DEMO-TASK.md) at $1 and the criteria file at $2.
# Derived criteria need interactive human confirmation; server profiles have no confirmation step.
# See deploy/server/README.md before reusing these proposals in a server profile.
set -euo pipefail
D="$1"; C="$(realpath -m "$2")"; mkdir -p "$D/tests"; cd "$D"
cat > README.md <<'MD'
# Landing page fixture
Static site, no build step. Put the page in `index.html`.
Contact-form e-mail validation lives in `validate.js` as `function isValidEmail(s)` exported via
`module.exports = { isValidEmail }` (and usable in the browser).
MD
cat > AGENTS.md <<'MD'
# Agent notes
- Keep it plain HTML/CSS/JS, no frameworks, no npm install.
- End your final message with one line exactly in this form (JSON list, one entry per thing you claim):
  `TRUTHLENS_CLAIMS: [{"text": "<what you claim>", "criterion_ids": ["c1"]}]`
  Criteria: c1 page exists with heading and form · c2 form validates the e-mail address · c3 mobile layout works.
MD
cat > tests/test_page_exists.py <<'PY'
import pathlib, re
def test_page_exists():
    html = pathlib.Path("index.html").read_text()
    assert re.search(r"<h1[\s>]", html, re.I) and re.search(r"<form[\s>]", html, re.I)
PY
cat > tests/test_email_validation.py <<'PY'
import json, subprocess
CASES = {"a@b.co": True, "user.name+tag@example.org": True, "": False, "plain": False, "a@b": False, "@x.de": False, "a b@c.de": False}
def test_email_validation():
    js = "const {isValidEmail}=require('./validate.js');console.log(JSON.stringify(%s.map(isValidEmail)))" % json.dumps(list(CASES))
    out = subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout
    assert json.loads(out) == list(CASES.values())
PY
cat > "$C" <<'JS'
{"requirement": {"id": "r1", "text": "Build a small landing page with a contact form."},
 "criteria": [
  {"id": "c1", "text": "Page exists (index.html with a heading and a form)", "source": "derived", "derived_by": {"kind": "agent", "id": "admin-supervisor"}},
  {"id": "c2", "text": "Form validates the e-mail address (invalid input rejected)", "source": "derived", "derived_by": {"kind": "agent", "id": "admin-supervisor"}},
  {"id": "c3", "text": "Mobile layout works", "source": "derived", "derived_by": {"kind": "agent", "id": "admin-supervisor"}}]}
JS
git init -q && git add . && git -c user.email=demo@truthlens -c user.name=demo commit -qm "fixture" 
