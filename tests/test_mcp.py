import io
import json
import shutil
from pathlib import Path

from truthlens.mcp import serve

DEMO = Path(__file__).parent.parent / "demo" / "runs"


def _rpc(root, *msgs):
    out = io.StringIO()
    serve(str(root), None, io.StringIO("".join(json.dumps(m) + "\n" for m in msgs)), out)
    return [json.loads(x) for x in out.getvalue().splitlines()]


def _call(i, name, **args):
    return {"jsonrpc": "2.0", "id": i, "method": "tools/call", "params": {"name": name, "arguments": args}}


def test_mcp_read_only_report_and_tamper(tmp_path):
    shutil.copytree(DEMO / "demo-2", tmp_path / "demo-2")
    r = _rpc(tmp_path, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
             {"jsonrpc": "2.0", "method": "notifications/initialized"},
             {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
             _call(3, "list_runs"), _call(4, "run_report", run="demo-2"), _call(5, "run_report", run="../etc"))
    assert [x["id"] for x in r] == [1, 2, 3, 4, 5]
    assert {t["name"] for t in r[1]["result"]["tools"]} == {"list_runs", "run_report", "run_events"}
    rep = json.loads(r[3]["result"]["content"][0]["text"])
    assert {c["criterion_id"]: c["status"] for c in rep["criteria"]} == {"c1": "met", "c2": "unmet", "c3": "unverified"}
    assert r[4]["result"]["isError"] is True
    led = tmp_path / "demo-2" / "ledger.jsonl"
    led.write_bytes(led.read_bytes().replace(b'"failed":1', b'"failed":0', 1))
    bad = json.loads(_rpc(tmp_path, _call(6, "run_report", run="demo-2"))[0]["result"]["content"][0]["text"])
    assert bad["verified"] is False
