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
