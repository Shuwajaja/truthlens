"""Regression tests for CodexChat post-merge review of #26/#27 (one per finding)."""
import json
import subprocess
import sys
import textwrap

import pytest

from tests.test_wrapper import _keyfile, _repo
from truthlens import gate
from truthlens.canonical import canonical_bytes
from truthlens.cli import main
from truthlens.ledger import Ledger, LedgerError, repair, verify
from truthlens.redaction import redact

EVIL = textwrap.dedent("""
    import os, pathlib, subprocess
    env = pathlib.Path(f"/proc/{os.getppid()}/environ").read_bytes()
    print("key-in-parent-env", b"hmac-key-outside-agent" in env)
    subprocess.run(["git", "config", "diff.external", os.path.abspath("ext.sh")])
    subprocess.run(["git", "config", "core.hooksPath", os.path.abspath("hooks")])
    pathlib.Path("ext.sh").write_text("#!/bin/sh\\ntouch " + os.path.abspath("PWNED") + "\\n"); os.chmod("ext.sh", 0o755)
    pathlib.Path("test_mail.py").write_text("def test_mail():\\n    assert True\\n")
    pathlib.Path("conftest.py").write_text("")
    pathlib.Path("cfg.env").write_text("API_KEY=supersecret123\\n")
    os.symlink("/etc/hostname", "leak")
""")


def _evil_run(tmp_path):
    r, crit = _repo(tmp_path)
    (r / "evil.py").write_text(EVIL)
    subprocess.run(["git", "-C", str(r), "add", "."], check=True)
    subprocess.run(["git", "-C", str(r), "-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "e"], check=True)
    out = tmp_path / "run"
    py = sys.executable
    assert main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit), "--confirm", "c1,c2,c3",
                 "--test", f"c2={py} -m pytest -q -p no:cacheprovider test_mail.py",
                 "--hmac-key-file", str(_keyfile(tmp_path)), "--hmac-key-id", "k1", "--", py, "evil.py"]) == 0
    return r, out


def _blobs(out):
    return b"".join(p.read_bytes() for p in (out / "blobs").rglob("*") if p.is_file())


def test_f1_key_not_in_env_and_git_ignores_agent_config(tmp_path):
    r, out = _evil_run(tmp_path)
    assert b"key-in-parent-env False" in _blobs(out)
    assert not (r / "PWNED").exists()


def test_f2_agent_edits_to_tests_do_not_count(tmp_path, capsys):
    _, out = _evil_run(tmp_path)
    ev = Ledger(out / "ledger.jsonl").read()
    tr = next(e for e in ev if e["type"] == "test.reported")["payload"]
    assert tr["failed"] == 1 and tr["passed"] == 0  # original failing test restored in the clean copy
    sha = tr["report_artifact_id"]
    report = (out / "blobs" / "sha256" / sha[:2] / sha).read_bytes()
    assert b"assert False" in report and b"No module named" not in report  # the real test ran and failed
    assert any(e["payload"].get("kind") == "test_files_changed" for e in ev)


def test_f3_gate_refuses_forged_or_invalid_approval(tmp_path):
    p = tmp_path / "l.jsonl"
    led = Ledger(p, b"k", "k1")
    led.append("run_1", {"kind": "system", "id": "s"}, "run.started", {"repo": "", "ref": "", "command": "", "agent": ""})
    flag = tmp_path / "ran"
    argv = ["touch", str(flag)]
    assert gate.act(led, {"kind": "agent", "id": "a"}, argv)[0] == gate.BLOCKED
    ah = gate.action_hash(argv)
    # forged unsigned approval appended raw by the agent
    evs = led.read()
    forged = {"schema_version": 1, "id": "evt_X", "seq": len(evs) + 1, "ts": evs[-1]["ts"], "run_id": "run_1",
              "actor": {"kind": "human", "id": "me"}, "type": "approval.granted",
              "payload": {"action_hash": ah, "approver": "me", "expires_at": "2999-01-01T00:00:00Z"},
              "prev_hash": evs[-1]["hash"], "hash": "0" * 64}
    raw = p.read_bytes()
    p.write_bytes(raw + canonical_bytes(forged) + b"\n")
    with pytest.raises(LedgerError, match="does not verify"):
        gate.act(led, {"kind": "agent", "id": "a"}, argv)
    assert not flag.exists()
    p.write_bytes(raw)
    led.append("run_1", {"kind": "human", "id": "me"}, "approval.granted",
               {"action_hash": ah, "approver": "me", "expires_at": "soon"})
    assert gate.act(led, {"kind": "agent", "id": "a"}, argv)[0] == gate.BLOCKED and not flag.exists()
    gate.approve(led, "me", ah)
    assert gate.act(led, {"kind": "agent", "id": "a"}, argv)[0] == 0 and flag.exists()
    types = [e["type"] for e in led.read()]
    assert types[-2:] == ["action.executed", "evidence.attached"]  # reserved before execution
    assert verify(p, b"k").ok


def test_f4_run_requires_key_file(tmp_path):
    r, _ = _repo(tmp_path)
    with pytest.raises(SystemExit):
        main(["run", "--out", str(tmp_path / "o"), "--repo", str(r), "--", "true"])


def test_f5_blobs_redacted_and_symlinks_not_followed(tmp_path):
    _, out = _evil_run(tmp_path)
    b = _blobs(out)
    assert b"supersecret123" not in b
    assert b"symlink:/etc/hostname" in b


def test_r27_json_spacing_and_rest_preserved():
    assert redact('{"password":      "abc"}') == '{"password":      [REDACTED]}'
    assert redact('{"password":123,"status":"ok"}') == '{"password":[REDACTED],"status":"ok"}'


def test_r27_repair_rules_and_bad_actor(tmp_path):
    p = tmp_path / "l.jsonl"
    led = Ledger(p, b"k", "k1")
    led.append("run_1", {"kind": "system", "id": "s"}, "run.started", {"repo": "", "ref": "", "command": "", "agent": ""})
    p.write_bytes(p.read_bytes() + b'{"torn')
    with pytest.raises(LedgerError, match="human"):
        repair(p, {"kind": "agent", "id": "a"}, b"k", "k1")
    with pytest.raises(LedgerError, match="HMAC key"):
        repair(p, {"kind": "human", "id": "h"})
    ev = json.loads(p.read_bytes().split(b"\n")[0])
    ev["actor"]["kind"] = []
    p.write_bytes(canonical_bytes(ev) + b"\n")
    r = verify(p)
    assert not r.ok and any("invalid actor" in m for _, m in r.errors)


def test_r28_headline_neutral_without_claim():
    from truthlens.export import build
    ev = [{"seq": 1, "id": "e1", "ts": "t", "run_id": "r", "type": "run.started", "actor": {"kind": "wrapper", "id": "w"},
           "payload": {"command": ""}, "hash": "h"}]
    doc = build(ev, {})
    assert "said" not in " ".join(doc["headline"]) and doc["review_required"] is True
