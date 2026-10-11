import json
import sqlite3
import subprocess
import sys
import textwrap

from truthlens.cli import main
from truthlens.ledger import Ledger, verify
from truthlens.wrapper import parse_pytest_counts

AGENT = textwrap.dedent("""
    import os, pathlib
    pathlib.Path("index.html").write_text("<h1>Hi</h1><form></form>")
    pathlib.Path("README.md").write_text("changed")
    print("env-has-hmac:", "TL_HMAC" in os.environ, "key-visible:", os.environ.get("FAKE_PROVIDER_KEY"))
    print()
    print("All done, everything works on mobile too.")
    print('TRUTHLENS_CLAIMS: [{"text": "page, validation and mobile done", "criterion_ids": ["c1","c2","c3"]}]')
""")


def _repo(tmp_path):
    r = tmp_path / "repo"
    r.mkdir()
    (r / "README.md").write_text("x")
    (r / "agent.py").write_text(AGENT)
    (r / "test_page.py").write_text("import pathlib\ndef test_page():\n    assert pathlib.Path('index.html').exists()\n")
    (r / "test_mail.py").write_text("def test_mail():\n    assert False\n")
    for c in (["init", "-q"], ["add", "."], ["-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "i"]):
        subprocess.run(["git", "-C", str(r), *c], check=True)
    crit = tmp_path / "criteria.json"
    crit.write_text(json.dumps({"requirement": {"id": "r1", "text": "Build a small landing page with a contact form."},
                                "criteria": [{"id": c, "text": t} for c, t in
                                             [("c1", "page exists"), ("c2", "email validated"), ("c3", "mobile ok")]]}))
    return r, crit


def _run(tmp_path, monkeypatch):
    r, crit = _repo(tmp_path)
    monkeypatch.setenv("FAKE_PROVIDER_KEY", "sk-or-supersecretvalue123")
    monkeypatch.setenv("TL_HMAC", "hmac-key-outside-agent")
    out = tmp_path / "run"
    py = sys.executable
    rc = main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit), "--confirm", "c1,c2,c3",
               "--test", f"c1={py} -m pytest -q -p no:cacheprovider test_page.py",
               "--test", f"c2={py} -m pytest -q -p no:cacheprovider test_mail.py",
               "--pass-env", "FAKE_PROVIDER_KEY", "--hmac-key-env", "TL_HMAC", "--hmac-key-id", "k1",
               "--agent", "fake", "--", py, "agent.py"])
    assert rc == 0
    return out


def test_witnessed_run_claims_vs_witnessed(tmp_path, monkeypatch, capsys):
    out = _run(tmp_path, monkeypatch)
    assert verify(out / "ledger.jsonl", b"hmac-key-outside-agent").anchored
    capsys.readouterr()
    assert main(["report", str(out), "--hmac-key-env", "TL_HMAC", "--json"]) == 0
    rep = json.loads(capsys.readouterr().out)
    assert {c["criterion_id"]: c["status"] for c in rep["criteria"]} == {"c1": "met", "c2": "unmet", "c3": "unverified"}
    assert rep["claims"][0]["finding"] == "claim_unwitnessed"  # c2 failed, c3 has no witness
    events = Ledger(out / "ledger.jsonl").read()
    assert sorted(e["payload"]["path"] for e in events if e["type"] == "artifact.recorded") == ["README.md", "index.html"]
    everything = (out / "ledger.jsonl").read_bytes() + b"".join(p.read_bytes() for p in out.rglob("blobs/**/*") if p.is_file())
    assert b"supersecretvalue" not in everything and b"hmac-key-outside" not in everything
    assert b"env-has-hmac: False" in everything  # agent never saw the HMAC key


def test_tampered_run_fails_report_and_projection_rebuilds(tmp_path, monkeypatch, capsys):
    out = _run(tmp_path, monkeypatch)
    assert main(["project", str(out), "--hmac-key-env", "TL_HMAC"]) == 0
    con = sqlite3.connect(out / "projection.sqlite")
    rows = dict(con.execute("SELECT criterion_id, status FROM criteria"))
    con.close()
    assert rows == {"c1": "met", "c2": "unmet", "c3": "unverified"}
    m = json.loads((out / "manifest.json").read_text())
    m["acceptance"][1]["status"] = "met"
    (out / "manifest.json").write_text(json.dumps(m))
    assert main(["report", str(out), "--hmac-key-env", "TL_HMAC"]) == 1
    data = (out / "ledger.jsonl").read_bytes()
    (out / "ledger.jsonl").write_bytes(data.replace(b'"failed":1', b'"failed":0', 1))
    assert main(["project", str(out), "--hmac-key-env", "TL_HMAC"]) == 1


def test_gate_blocks_until_human_approval(tmp_path, monkeypatch, capsys):
    led = tmp_path / "l.jsonl"
    assert main(["init", str(led)]) == 0
    flag = tmp_path / "deployed"
    action = ["touch", str(flag)]
    assert main(["act", str(led), "--", *action]) == 3
    assert not flag.exists()
    ah = json.loads(capsys.readouterr().out.strip().splitlines()[-1])["action_hash"]
    assert main(["act", str(led), "--", *action]) == 3 and not flag.exists()
    assert main(["approve", str(led), ah]) == 0
    assert main(["act", str(led), "--", *action]) == 0 and flag.exists()
    flag.unlink()
    assert main(["act", str(led), "--", *action]) == 3 and not flag.exists()  # approval consumed
    assert verify(led).ok


def test_pytest_counts():
    assert parse_pytest_counts("1 failed, 2 passed, 1 skipped in 0.1s", 1) == {"passed": 2, "failed": 1, "skipped": 1}
    assert parse_pytest_counts("no tests ran in 0.01s", 5) == {"passed": 0, "failed": 0, "skipped": 0}
    assert parse_pytest_counts("ImportError", 2)["failed"] == 1
    assert parse_pytest_counts("1 passed, 1 error in 0.1s", 1) == {"passed": 1, "failed": 1, "skipped": 0}


GATE_AGENT = textwrap.dedent("""
    import json, os, subprocess, sys, time, pathlib
    act = [sys.executable, "-c", "import os,pathlib;pathlib.Path('deployed').write_text(str(bool(os.environ.get('DEPLOY_TOKEN'))))"]
    subprocess.run(act)  # bypass attempt: agent runs it itself -> no capability
    bypass = pathlib.Path('deployed').read_text()
    req = [sys.executable, "-m", "truthlens", "request", "--", *act]
    first = subprocess.run(req, capture_output=True, text=True)
    for _ in range(100):
        r = subprocess.run(req, capture_output=True, text=True)
        if r.returncode != 3:
            break
        time.sleep(0.1)
    print("first", first.returncode, "final", r.returncode, "bypass", bypass, "token-seen", "DEPLOY_TOKEN" in os.environ)
""")


def test_gate_channel_blocks_until_human_approves(tmp_path, monkeypatch):
    import threading
    import time

    r, _ = _repo(tmp_path)
    (r / "gate_agent.py").write_text(GATE_AGENT)
    monkeypatch.setenv("DEPLOY_TOKEN", "deploy-secret-123456")
    keyf = tmp_path / "key"
    keyf.write_text("hmac-outside")
    keyf.chmod(0o600)
    monkeypatch.setenv("TL_HMAC", "hmac-outside")
    out = tmp_path / "run"
    ledger = out / "ledger.jsonl"

    def human():
        for _ in range(200):
            if ledger.exists():
                blocked = [e for e in Ledger(ledger).read() if e["type"] == "action.blocked"]
                if blocked:
                    time.sleep(0.3)
                    assert (r / "deployed").read_text() != "True"  # not executed before approval
                    main(["approve", str(ledger), blocked[0]["payload"]["action_hash"],
                          "--hmac-key-env", "TL_HMAC", "--hmac-key-id", "k1"])
                    return
            time.sleep(0.05)

    t = threading.Thread(target=human)
    t.start()
    rc = main(["run", "--out", str(out), "--repo", str(r), "--gate-env", "DEPLOY_TOKEN",
               "--hmac-key-file", str(keyf), "--hmac-key-id", "k1", "--", sys.executable, "gate_agent.py"])
    t.join()
    assert rc == 0
    types = [e["type"] for e in Ledger(ledger).read()]
    assert types.count("action.blocked") == 1 and types.count("action.executed") == 1
    assert types.index("approval.granted") < types.index("action.executed")
    assert (r / "deployed").read_text() == "True"  # executed by the wrapper with the capability
    log = b"".join(p.read_bytes() for p in (out / "blobs").rglob("*") if p.is_file())
    assert b"first 3 final 0 bypass False token-seen False" in log
    assert b"deploy-secret" not in log + ledger.read_bytes()
    assert verify(ledger, b"hmac-outside").anchored


def test_key_file_inside_repo_refused(tmp_path):
    import pytest
    r, _ = _repo(tmp_path)
    (r / "k").write_text("x")
    (r / "k").chmod(0o600)
    with pytest.raises(SystemExit):
        main(["run", "--out", str(tmp_path / "o"), "--repo", str(r), "--hmac-key-file", str(r / "k"),
              "--hmac-key-id", "k", "--", "true"])


def test_export_cards_follow_design_v2(tmp_path, monkeypatch, capsys):
    out = _run(tmp_path, monkeypatch)
    capsys.readouterr()
    assert main(["export", str(out), "--hmac-key-env", "TL_HMAC"]) == 0
    doc = json.loads(capsys.readouterr().out)
    assert {c["criterion_id"]: c["card"] for c in doc["criteria"]} == {"c1": "green", "c2": "red", "c3": "yellow"}
    assert doc["counts"]["green"] == 1 and doc["verified"] is True
