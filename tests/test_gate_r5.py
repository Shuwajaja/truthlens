"""CodexChat round-5 #29.3/#29.4 (gate robustness, safe response files)."""
import json
import os

from tests.test_round5 import _open_ledger
from truthlens import gate


def _server(tmp_path):
    led = _open_ledger(tmp_path)
    return led, gate.GateServer(led, tmp_path / "inbox", str(tmp_path), {}, {"kind": "agent", "id": "a"})


def test_29_3_bad_requests_answered_and_exec_failure_recorded(tmp_path):
    led, srv = _server(tmp_path)
    (srv.inbox / "a.req").write_text("null")
    (srv.inbox / "b.req").write_text(json.dumps({"argv": None}))
    srv.poll()
    for r in ("a", "b"):
        assert json.loads((srv.inbox / f"{r}.res").read_text())["rc"] == 2
    argv = ["/nonexistent/prog"]
    _, info = gate.act(led, {"kind": "agent", "id": "a"}, argv, str(tmp_path))
    gate.approve(led, "shu", info["action_hash"])
    rc, _ = gate.act(led, {"kind": "agent", "id": "a"}, argv, str(tmp_path))
    assert rc == 127 and led.read()[-1]["payload"]["exit_code"] == 127


def test_29_4_response_does_not_follow_planted_symlink(tmp_path):
    _, srv = _server(tmp_path)
    target = tmp_path / "victim"
    target.write_text("keep")
    os.symlink(target, srv.inbox / "x.res")
    (srv.inbox / "x.req").write_text("null")
    srv.poll()
    assert target.read_text() == "keep" and not (srv.inbox / "x.res").is_symlink()
