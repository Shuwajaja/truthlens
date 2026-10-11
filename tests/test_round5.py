"""Regression tests for CodexChat round-5 findings (one per finding)."""
import json
import subprocess
import sys
import textwrap

import pytest

from tests.test_mcp import DEMO, _call, _rpc
from tests.test_wrapper import _keyfile, _repo
from truthlens import gate
from truthlens.cli import main
from truthlens.ledger import Ledger, LedgerError

KEY = b"k" * 32


def _open_ledger(tmp_path):
    led = Ledger(tmp_path / "l.jsonl", KEY, "k1")
    led.append("run_1", {"kind": "system", "id": "t"}, "run.started", {"agent": "a"})
    return led


def _approve_and_act(led, argv, cwd, state=None):
    rc, info = gate.act(led, {"kind": "agent", "id": "a"}, argv, cwd, state=state)
    assert rc == gate.BLOCKED
    gate.approve(led, "shu", info["action_hash"])
    return gate.act(led, {"kind": "agent", "id": "a"}, argv, cwd, state=state)


@pytest.mark.xfail(strict=True, reason="KNOWN RISK (same UID): agent reads the key via /proc/$PPID; "
                   "fix needs a separate Unix user/sandbox, see TRUST-LEVELS")
def test_a_same_uid_agent_cannot_read_key(tmp_path):
    r, crit = _repo(tmp_path)
    (r / "steal.py").write_text(textwrap.dedent("""
        import os, pathlib
        args = pathlib.Path(f"/proc/{os.getppid()}/cmdline").read_bytes().split(b"\\0")
        p = args[args.index(b"--hmac-key-file") + 1].decode()
        pathlib.Path("stolen").write_text(str(pathlib.Path(p).read_text() == "hmac-key-outside-agent"))
    """))
    out = tmp_path / "run"
    # real CLI process, so the agent's parent cmdline is the one an attacker would see
    subprocess.run([sys.executable, "-m", "truthlens", "run", "--out", str(out), "--repo", str(r),
                    "--criteria", str(crit), "--hmac-key-file", str(_keyfile(tmp_path)), "--hmac-key-id", "k1",
                    "--", sys.executable, "steal.py"], check=True, capture_output=True)
    assert (r / "stolen").read_text() == "False"


def test_b_approval_binds_referenced_script(tmp_path):
    led = _open_ledger(tmp_path)
    (tmp_path / "deploy.sh").write_text("echo ok > out\n")
    assert _approve_and_act(led, ["sh", "deploy.sh"], str(tmp_path))[0] == 0
    gate.approve(led, "shu", gate.action_hash(["sh", "deploy.sh"], str(tmp_path)))  # second approval, old content
    (tmp_path / "deploy.sh").write_text("echo EVIL > out\n")
    rc, _ = gate.act(led, {"kind": "agent", "id": "a"}, ["sh", "deploy.sh"], str(tmp_path))
    assert rc == gate.BLOCKED and (tmp_path / "out").read_text() == "ok\n"


def test_c_shadow_pytest_and_ignored_conftest_do_not_count(tmp_path):
    r, crit = _repo(tmp_path)
    (r / ".gitignore").write_text("conftest.py\n")
    (r / "evil.py").write_text(textwrap.dedent("""
        import pathlib
        pathlib.Path("pytest.py").write_text("print('1 passed')\\n")
        pathlib.Path("conftest.py").write_text("import pytest\\n@pytest.hookimpl(tryfirst=True)\\n"
            "def pytest_runtest_call(item):\\n    pass\\ndef pytest_collection_modifyitems(items):\\n    items.clear()\\n")
    """))
    subprocess.run(["git", "-C", str(r), "add", "."], check=True)
    subprocess.run(["git", "-C", str(r), "-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "e"], check=True)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit), "--confirm", "c1,c2,c3",
                 "--test", f"c2={sys.executable} -m pytest -q -p no:cacheprovider test_mail.py",
                 "--hmac-key-file", str(_keyfile(tmp_path)), "--hmac-key-id", "k1",
                 "--", sys.executable, "evil.py"]) == 0
    rep = next(e for e in Ledger(out / "ledger.jsonl").read() if e["type"] == "test.reported")["payload"]
    assert rep["passed"] == 0 and rep["failed"] >= 1 and rep["exit_code"] == 1  # real red test_mail.py ran


def test_d_rollback_cannot_rearm_approval(tmp_path):
    led = _open_ledger(tmp_path)
    state: dict = {"consumed": set()}
    flag = tmp_path / "f"
    argv = ["touch", str(flag)]
    _, info = gate.act(led, {"kind": "agent", "id": "a"}, argv, str(tmp_path), state=state)
    gate.approve(led, "shu", info["action_hash"])
    snap = led.path.read_bytes()  # agent saves the signed state right after approval.granted
    assert gate.act(led, {"kind": "agent", "id": "a"}, argv, str(tmp_path), state=state)[0] == 0
    flag.unlink()
    led.path.write_bytes(snap)  # rollback
    with pytest.raises(LedgerError, match="rollback"):
        gate.act(led, {"kind": "agent", "id": "a"}, argv, str(tmp_path), state=state)
    assert not flag.exists()


def test_e_mcp_without_key_is_not_verified_true(tmp_path):
    import shutil
    shutil.copytree(DEMO / "demo-2", tmp_path / "demo-2")
    rep = json.loads(_rpc(tmp_path, _call(1, "run_report", run="demo-2"))[0]["result"]["content"][0]["text"])
    assert rep["verified"] is False and rep["integrity"] == "hash-only"


def _tl_agent_ok() -> bool:
    import shutil
    return (shutil.which("sudo") is not None and subprocess.run(["id", "tl-agent"], capture_output=True, check=False).returncode == 0
            and subprocess.run(["sudo", "-n", "-u", "tl-agent", "true"], capture_output=True, check=False).returncode == 0)


@pytest.mark.skipif(not _tl_agent_ok(), reason="needs local unix user tl-agent + sudo (box only, not CI)")
def test_a_separate_uid_agent_cannot_read_key(tmp_path):
    """Same attack as test_a, but the agent runs as tl-agent via `sudo -u tl-agent env -i`: it can still see
    the key PATH in a parent cmdline, but reading the key file (owned by the box user, 600) must fail."""
    import tempfile
    from pathlib import Path
    wt = Path("/srv/tl-agent/wt")
    with tempfile.TemporaryDirectory(dir=wt) as d:
        r = Path(d)
        r.chmod(0o2770)
        steal = textwrap.dedent("""
            import os, sys
            pid = os.getppid()
            while pid > 1:
                args = open(f"/proc/{pid}/cmdline", "rb").read().split(b"\\0")
                if b"--hmac-key-file" in args:
                    p = args[args.index(b"--hmac-key-file") + 1].decode()
                    try:
                        open(p).read()
                        sys.exit(0)  # stolen
                    except OSError:
                        sys.exit(42)  # path visible, key unreadable
                pid = int(open(f"/proc/{pid}/stat").read().rsplit(")", 1)[1].split()[1])
            sys.exit(2)
        """)
        (r / "steal.py").write_text(steal)
        subprocess.run(["git", "init", "-q", str(r)], check=True)
        subprocess.run(["git", "-C", str(r), "add", "."], check=True)
        subprocess.run(["git", "-C", str(r), "-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "i"], check=True)
        crit = tmp_path / "c.json"
        crit.write_text(json.dumps({"requirements": [], "criteria": []}))
        p = subprocess.run([sys.executable, "-m", "truthlens", "run", "--out", str(tmp_path / "run"), "--repo", str(r),
                            "--criteria", str(crit), "--hmac-key-file", str(_keyfile(tmp_path)), "--hmac-key-id", "k1",
                            "--", "sudo", "-n", "-u", "tl-agent", "env", "-i", "PATH=/usr/bin:/bin",
                            "/usr/bin/python3", "steal.py"], capture_output=True, text=True, check=True)
        assert json.loads(p.stdout.strip().splitlines()[-1])["exit_code"] == 42


def test_b2_argv0_script_bound_and_proc_args_ignored(tmp_path):
    (tmp_path / "deploy.sh").write_text("#!/bin/sh\necho ok\n")
    h1 = gate.action_hash(["./deploy.sh"], str(tmp_path))
    (tmp_path / "deploy.sh").write_text("#!/bin/sh\necho EVIL\n")
    assert gate.action_hash(["./deploy.sh"], str(tmp_path)) != h1
    gate.action_hash(["echo", "/proc/self/mem"], str(tmp_path))  # must not raise


def test_34_review_symlinked_tests_dir_and_key_filename(tmp_path):
    r, crit = _repo(tmp_path)
    ext = tmp_path / "ext"
    ext.mkdir()
    (ext / "test_mail.py").write_text("def test_mail():\n    assert True\n")
    key = "hmac-key-outside-agent"
    (r / "evil.py").write_text(textwrap.dedent(f"""
        import os, pathlib, subprocess
        subprocess.run(["git", "rm", "-q", "--cached", "test_mail.py"])
        os.remove("test_mail.py")
        os.symlink({str(ext / "test_mail.py")!r}, "test_mail.py")
        pathlib.Path({key!r}).write_text("x")
    """))
    subprocess.run(["git", "-C", str(r), "add", "."], check=True)
    subprocess.run(["git", "-C", str(r), "-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "e"], check=True)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit), "--confirm", "c1,c2,c3",
                 "--test", f"c2={sys.executable} -m pytest -q -p no:cacheprovider test_mail.py",
                 "--hmac-key-file", str(_keyfile(tmp_path)), "--hmac-key-id", "k1",
                 "--", sys.executable, "evil.py"]) == 0
    rep = next(e for e in Ledger(out / "ledger.jsonl").read() if e["type"] == "test.reported")["payload"]
    assert rep["passed"] == 0 and rep["failed"] >= 1  # original failing test restored, external one not run
    assert key.encode() not in (out / "ledger.jsonl").read_bytes()
