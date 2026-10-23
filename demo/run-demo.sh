#!/usr/bin/env bash
# Reproducible TruthLens demo (docs/DEMO-TASK.md).
#   demo/run-demo.sh [OUT_DIR] [--offline]
# --offline uses a scripted fake agent (no API key, deterministic); default runs OpenCode via OpenRouter
# (needs OPENROUTER_API_KEY and `opencode` on PATH). The HMAC key is created in a temp dir outside repo and run dir.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$(mktemp -d)/truthlens-demo}"; MODE="${2:-}"
TL="${TL:-python -m truthlens}"
KEYDIR="$(mktemp -d)"; head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$KEYDIR/key"; chmod 600 "$KEYDIR/key"
trap 'rm -rf "$KEYDIR"' EXIT
mkdir -p "$OUT"; "$REPO_ROOT/demo/make-fixture.sh" "$OUT/fixture" "$OUT/criteria.json"
if [ "$MODE" = "--offline" ]; then
  AGENT=(python -c 'import pathlib
pathlib.Path("index.html").write_text("<h1>Hello</h1><form><input type=email></form>")
print("Done. Landing page with contact form built, tests green, looks great on mobile.")
print("TRUTHLENS_CLAIMS: [{\"text\": \"Page, e-mail validation and mobile layout done\", \"criterion_ids\": [\"c1\",\"c2\",\"c3\"]}]")')
  AGENT_NAME=scripted-fake; PASS=()
else
  AGENT=(opencode run -m openrouter/deepseek/deepseek-v4-flash "Build a small landing page with a contact form.")
  AGENT_NAME=opencode/deepseek-v4-flash; PASS=(--pass-env OPENROUTER_API_KEY)
fi
PY="$(python -c 'import sys;print(sys.executable)')"
$TL run --out "$OUT/run" --repo "$OUT/fixture" --criteria "$OUT/criteria.json" --confirm c1,c2,c3 \
  --test "c1=$PY -m pytest -q -p no:cacheprovider tests/test_page_exists.py" \
  --test "c2=$PY -m pytest -q -p no:cacheprovider tests/test_email_validation.py" \
  "${PASS[@]}" --hmac-key-file "$KEYDIR/key" --hmac-key-id demo --agent "$AGENT_NAME" --timeout 900 -- "${AGENT[@]}"
export TL_DEMO_KEY="$(cat "$KEYDIR/key")"
LAST="$(python -c "import json,sys;print(json.load(open(sys.argv[1]))['ledger_last_hash'])" "$OUT/run/manifest.json")"
$TL verify "$OUT/run/ledger.jsonl" --hmac-key-env TL_DEMO_KEY --expect-last-hash "$LAST"
$TL report "$OUT/run" --hmac-key-env TL_DEMO_KEY
$TL export "$OUT/run" --hmac-key-env TL_DEMO_KEY -o "$OUT/run.json"
echo "viewer data: $OUT/run.json  (cp to viewer/fixtures/demo-run.json; cd viewer && npm i && npm run dev)"
echo "--- tamper: flip one test result in a copy"
cp -r "$OUT/run" "$OUT/tampered"; sed -i '0,/"failed":1/s//"failed":0/;0,/"passed":0/s//"passed":1/' "$OUT/tampered/ledger.jsonl"
if $TL verify "$OUT/tampered/ledger.jsonl" --hmac-key-env TL_DEMO_KEY; then echo "UNEXPECTED: tamper not detected"; exit 1; fi
echo "tamper detected (fail-closed) ✓"
