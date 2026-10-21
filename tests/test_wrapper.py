import json
import os
import sqlite3
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

from truthlens.cli import main
from truthlens.ledger import Ledger, verify
from truthlens.store import BlobStore
from truthlens.wrapper import junit_counts

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


def _keyfile(tmp_path, value="hmac-key-outside-agent"):
    k = tmp_path / "keydir" / "key"
    k.parent.mkdir(exist_ok=True)
    k.write_text(value)
    k.chmod(0o600)
    return k


def _run(tmp_path, monkeypatch):
    r, crit = _repo(tmp_path)
    monkeypatch.setenv("FAKE_PROVIDER_KEY", "sk-or-supersecretvalue123")
    monkeypatch.setenv("TL_HMAC", "hmac-key-outside-agent")
    out = tmp_path / "run"
    py = sys.executable
    rc = main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit), "--confirm", "c1,c2,c3",
               "--test", f"c1={py} -m pytest -q -p no:cacheprovider test_page.py",
               "--test", f"c2={py} -m pytest -q -p no:cacheprovider test_mail.py",
               "--pass-env", "FAKE_PROVIDER_KEY", "--hmac-key-file", str(_keyfile(tmp_path)), "--hmac-key-id", "k1",
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
    monkeypatch.chdir(tmp_path)
    led = tmp_path / "l.jsonl"
    assert main(["init", str(led)]) == 0
    flag = tmp_path.parent / f"{tmp_path.name}-deployed"  # outside the gated tree (in-tree paths go to the copy)
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


def test_junit_counts_not_stdout(tmp_path):
    x = tmp_path / "r.xml"
    assert junit_counts(x, 0) == {"passed": 0, "failed": 0, "skipped": 0}  # "5 passed" printed, no XML -> nothing
    x.write_text('<testsuites><testsuite tests="4" failures="1" errors="0" skipped="1"/></testsuites>')
    assert junit_counts(x, 1) == {"passed": 2, "failed": 1, "skipped": 1}
    x.write_text('<testsuite tests="3" failures="0" errors="0" skipped="0"/>')
    assert junit_counts(x, 2)["failed"] == 1  # non-zero exit always fails
    x.write_text('<testsuite tests="garbage"/>')
    assert junit_counts(x, 0)["passed"] == 0
    x.write_text('<testsuite tests="0" failures="-1"/>')
    assert junit_counts(x, 0)["passed"] == 0


GATE_AGENT = textwrap.dedent("""
    import json, os, subprocess, sys, time, pathlib
    # the gate runs a private copy of the binary; uv/relocatable builds cannot start from a copy, system python can
    py = "/usr/bin/python3" if os.path.exists("/usr/bin/python3") else sys.executable
    act = [py, "-c", "import os,pathlib;pathlib.Path(%r).write_text(str(bool(os.environ.get('DEPLOY_TOKEN'))))" % os.path.abspath('../deployed')]
    subprocess.run(act)  # bypass attempt: agent runs it itself -> no capability
    bypass = pathlib.Path('../deployed').read_text()
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
    # the agent runs `python -m truthlens` itself; make the package importable without an installed dist
    src = str(Path(__file__).resolve().parents[1] / "src")
    monkeypatch.setenv("PYTHONPATH", src + os.pathsep + os.environ.get("PYTHONPATH", ""))
    out = tmp_path / "run"
    ledger = out / "ledger.jsonl"

    def human():
        for _ in range(200):
            if ledger.exists():
                blocked = [e for e in Ledger(ledger).read() if e["type"] == "action.blocked"]
                if blocked:
                    time.sleep(0.3)
                    assert (tmp_path / "deployed").read_text() != "True"  # not executed before approval
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
    assert (tmp_path / "deployed").read_text() == "True"  # executed by the wrapper with the capability
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


def test_pre_diff_is_empty_for_unchanged_worktree(tmp_path):
    r, crit = _repo(tmp_path)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit),
                 "--confirm", "c1,c2,c3", "--hmac-key-file", str(_keyfile(tmp_path)),
                 "--hmac-key-id", "k1", "--", "true"]) == 0
    ev = Ledger(out / "ledger.jsonl").read()
    git_before = next(e for e in ev if e["payload"].get("refers_to") == "git_state_before")
    data = BlobStore(out / "blobs").get(git_before["payload"]["sha256"])
    pre_diff = data.split(b"\n", 1)[1]
    assert pre_diff == b""


def test_pre_diff_ignores_gitlink_entries(tmp_path):
    r, crit = _repo(tmp_path)
    subprocess.run(["git", "-C", str(r), "update-index", "--add", "--cacheinfo",
                    "160000," + "deadbeef" * 5 + ",vendored"], check=True)
    subprocess.run(["git", "-C", str(r), "-c", "user.email=a@b", "-c", "user.name=a",
                    "commit", "-qm", "add gitlink"], check=True)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit),
                 "--confirm", "c1,c2,c3", "--hmac-key-file", str(_keyfile(tmp_path)),
                 "--hmac-key-id", "k1", "--", "true"]) == 0
    ev = Ledger(out / "ledger.jsonl").read()
    git_before = next(e for e in ev if e["payload"].get("refers_to") == "git_state_before")
    data = BlobStore(out / "blobs").get(git_before["payload"]["sha256"])
    pre_diff = data.split(b"\n", 1)[1]
    assert pre_diff == b""


def _pre_diff_of(out):
    ev = Ledger(out / "ledger.jsonl").read()
    git_before = next(e for e in ev if e["payload"].get("refers_to") == "git_state_before")
    return BlobStore(out / "blobs").get(git_before["payload"]["sha256"]).split(b"\n", 1)[1]


@pytest.mark.parametrize("when", ["before", "before-staged", "after"])
def test_diff_preserves_old_and_new_text(tmp_path, when):
    r, _ = _repo(tmp_path)
    (r / "notes.txt").write_text("old text\n")
    for c in (["add", "notes.txt"], ["-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "notes"]):
        subprocess.run(["git", "-C", str(r), *c], check=True)
    command = [sys.executable, "-c", "from pathlib import Path; Path('notes.txt').write_text('new text\\n')"]
    if when.startswith("before"):
        subprocess.run(command, cwd=r, check=True)
        if when == "before-staged":
            subprocess.run(["git", "-C", str(r), "add", "notes.txt"], check=True)
        command = ["true"]
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--hmac-key-file", str(_keyfile(tmp_path)),
                 "--hmac-key-id", "k1", "--", *command]) == 0
    if when.startswith("before"):
        diff = _pre_diff_of(out)
    else:
        events = Ledger(out / "ledger.jsonl").read()
        sha = next(e["payload"]["sha256"] for e in events if e["payload"].get("refers_to") == "git_diff_after")
        diff = BlobStore(out / "blobs").get(sha)
    assert b"-old text" in diff.splitlines()
    assert b"+new text" in diff.splitlines()


@pytest.mark.parametrize("deleted", [False, True])
def test_diff_without_capture_refuses_unrecoverable_old_content(tmp_path, deleted):
    from truthlens.wrapper import _make_diff, snapshot

    r, _ = _repo(tmp_path)
    notes = r / "uncommitted.txt"
    notes.write_text("old text\n")
    before = snapshot(r)
    if deleted:
        notes.unlink()
    else:
        notes.write_text("new text\n")
    with pytest.raises(RuntimeError, match="pre-run content.*uncommitted.txt"):
        _make_diff(r, before, snapshot(r))


def test_pre_diff_preserves_old_symlink_target(tmp_path):
    r, _ = _repo(tmp_path)
    link = r / "link"
    link.symlink_to("old-target")
    for c in (["add", "link"], ["-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "link"]):
        subprocess.run(["git", "-C", str(r), *c], check=True)
    link.unlink()
    link.symlink_to("new-target")
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--hmac-key-file", str(_keyfile(tmp_path)),
                 "--hmac-key-id", "k1", "--", "true"]) == 0
    diff = _pre_diff_of(out)
    assert b"-symlink:old-target" in diff.splitlines()
    assert b"+symlink:new-target" in diff.splitlines()


def test_pre_diff_omits_unreadable_head_object(tmp_path):
    """A HEAD object that cannot be read must not turn an unchanged file into "new file" evidence."""
    r, crit = _repo(tmp_path)
    sha = subprocess.run(["git", "-C", str(r), "rev-parse", "HEAD:README.md"],
                         capture_output=True, text=True, check=True).stdout.strip()
    obj = r / ".git" / "objects" / sha[:2] / sha[2:]
    assert obj.exists(), "expected a loose object in a fresh test repository"
    obj.unlink()
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit),
                 "--confirm", "c1,c2,c3", "--hmac-key-file", str(_keyfile(tmp_path)),
                 "--hmac-key-id", "k1", "--", "true"]) == 0
    pre_diff = _pre_diff_of(out)
    assert b"README.md" not in pre_diff  # no phantom "fully added" entry for an unchanged file


def test_pre_diff_head_reads_do_not_lazy_fetch(tmp_path, monkeypatch):
    """The pre-diff reads HEAD objects with lazy fetch disabled, so a partial clone cannot fetch."""
    from truthlens import wrapper

    r, _ = _repo(tmp_path)
    sha = subprocess.run(["git", "-C", str(r), "rev-parse", "HEAD:README.md"],
                         capture_output=True, text=True, check=True).stdout.strip()
    envs: list[dict] = []
    real_run = subprocess.run

    def spy(cmd, *a, **kw):
        if isinstance(cmd, list) and "cat-file" in cmd:
            envs.append(dict(kw.get("env") or {}))
        return real_run(cmd, *a, **kw)

    monkeypatch.setattr(wrapper.subprocess, "run", spy)
    assert wrapper._read_head_blob(r, sha) == b"x"
    assert envs and all(e.get("GIT_NO_LAZY_FETCH") == "1" for e in envs)
    assert wrapper._read_head_blob(r, "deadbeef" * 5) is None  # unreadable is never empty content


def test_pre_diff_handles_symlink_like_snapshot(tmp_path):
    r, crit = _repo(tmp_path)
    os.symlink("README.md", r / "link")
    for c in (["add", "link"], ["-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "link"]):
        subprocess.run(["git", "-C", str(r), *c], check=True)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit),
                 "--confirm", "c1,c2,c3", "--hmac-key-file", str(_keyfile(tmp_path)),
                 "--hmac-key-id", "k1", "--", "true"]) == 0
    ev = Ledger(out / "ledger.jsonl").read()
    git_before = next(e for e in ev if e["payload"].get("refers_to") == "git_state_before")
    data = BlobStore(out / "blobs").get(git_before["payload"]["sha256"])
    pre_diff = data.split(b"\n", 1)[1]
    assert pre_diff == b""


DIFF_AGENT = textwrap.dedent("""
    import pathlib
    pathlib.Path("notes.txt").write_text("keep\\n")
    pathlib.Path("README.md").unlink()
""")


def test_file_changed_keeps_removed_and_deleted_evidence(tmp_path):
    """The `-` side is captured before the agent runs, so removed lines / deleted content survive (#81)."""
    r, crit = _repo(tmp_path)
    (r / "notes.txt").write_text("keep\nremove me\n")
    for c in (["add", "notes.txt"], ["-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "notes"]):
        subprocess.run(["git", "-C", str(r), *c], check=True)
    (r / "diff_agent.py").write_text(DIFF_AGENT)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit),
                 "--confirm", "c1,c2,c3", "--hmac-key-file", str(_keyfile(tmp_path)),
                 "--hmac-key-id", "k1", "--agent", "fake", "--", sys.executable, "diff_agent.py"]) == 0
    ev = Ledger(out / "ledger.jsonl").read()
    diff = BlobStore(out / "blobs").get(
        next(e["payload"]["sha256"] for e in ev if e["payload"].get("refers_to") == "git_diff_after"))
    assert b"-remove me" in diff  # modified file: the removed line is witnessed
    assert b"-x" in diff          # deleted file: its original content is witnessed


def test_pre_run_capture_refuses_silent_loss(tmp_path):
    """A failed pre-run copy must raise, not fake an empty `-` side (#81 review)."""
    import pytest

    from truthlens.wrapper import _capture_before, _read_captured
    (tmp_path / "notes.txt").write_text("keep\nremove me\n")
    with pytest.raises(RuntimeError):
        _capture_before(tmp_path, {"notes.txt": "0" * 64}, tmp_path / "dest")  # hash mismatch = changed
    dest = tmp_path / "captured"
    dest.mkdir()
    with pytest.raises(RuntimeError):
        _read_captured(dest, "notes.txt")  # existed before the run, so a missing capture is an error
