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


def test_29_4_planted_tmp_symlink_and_directory_requests(tmp_path, monkeypatch):
    _, srv = _server(tmp_path)
    target = tmp_path / "victim"
    target.write_text("keep")
    monkeypatch.setattr("truthlens.ids.new_id", lambda prefix: f"{prefix}_fixed")
    os.symlink(target, srv.inbox / ".res_fixed.tmp")  # attacker guesses the temp name
    (srv.inbox / "x.req").write_text("null")
    (srv.inbox / "d.req").mkdir()  # directory request must not kill the gate
    srv.poll()
    assert target.read_text() == "keep"
    (srv.inbox / "y.req").write_text("null")
    os.unlink(srv.inbox / ".res_fixed.tmp")
    srv.poll()
    assert json.loads((srv.inbox / "y.res").read_text())["rc"] == 2  # gate still answers


def test_32_4_runner_check_independent_of_output(tmp_path):
    import subprocess
    import sys

    from tests.test_wrapper import _keyfile, _repo
    from truthlens.cli import main
    from truthlens.ledger import Ledger
    r, crit = _repo(tmp_path)
    (r / "test_mail.py").write_text("def test_mail():\n    raise RuntimeError('No module named pytest')\n")
    subprocess.run(["git", "-C", str(r), "add", "."], check=True)
    subprocess.run(["git", "-C", str(r), "-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "e"], check=True)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit), "--confirm", "c1,c2,c3",
                 "--test", f"c2={sys.executable} -m pytest -q -p no:cacheprovider test_mail.py",
                 "--hmac-key-file", str(_keyfile(tmp_path)), "--hmac-key-id", "k1", "--", "true"]) == 0
    rep = next(e for e in Ledger(out / "ledger.jsonl").read() if e["type"] == "test.reported")["payload"]
    assert rep["failed"] >= 1  # app text mentioning the runner does not hide a real failure
