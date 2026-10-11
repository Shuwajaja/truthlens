"""Regression tests for CodexChat round-5 findings (one per finding)."""
import json
import os
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
    repo, out = tmp_path / "repo", tmp_path / "out"
    repo.mkdir()
    (repo / "deploy.sh").write_text(f"echo ok > {out}\n")
    assert _approve_and_act(led, ["sh", "deploy.sh"], str(repo))[0] == 0
    gate.approve(led, "shu", gate.action_hash(["sh", "deploy.sh"], str(repo)))  # second approval, old content
    (repo / "deploy.sh").write_text(f"echo EVIL > {out}\n")
    rc, _ = gate.act(led, {"kind": "agent", "id": "a"}, ["sh", "deploy.sh"], str(repo))
    assert rc == gate.BLOCKED and out.read_text() == "ok\n"


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
    flag = tmp_path.parent / f"{tmp_path.name}-f"
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


def test_b2_snapshot_covers_sourced_files_and_refuses_outside_paths(tmp_path):
    led = _open_ledger(tmp_path)
    repo, out = tmp_path / "repo", tmp_path / "out"
    repo.mkdir()
    (repo / "lib.sh").write_text(f"echo ok > {out}\n")
    (repo / "d2.sh").write_text(". ./lib.sh\n")
    _, info = gate.act(led, {"kind": "agent", "id": "a"}, ["sh", "d2.sh"], str(repo))
    gate.approve(led, "shu", info["action_hash"])
    (repo / "lib.sh").write_text(f"echo EVIL > {out}\n")  # sourced file changed after approval
    assert gate.act(led, {"kind": "agent", "id": "a"}, ["sh", "d2.sh"], str(repo))[0] == gate.BLOCKED
    assert not out.exists()
    (tmp_path / "out2").write_text("x")
    with pytest.raises(LedgerError, match="outside"):
        gate.act(led, {"kind": "agent", "id": "a"}, ["cat", str(tmp_path / "out2")], str(repo))


def test_d2_cli_act_rollback_refused_via_external_anchor(tmp_path, monkeypatch, capsys):
    monkeypatch.chdir(tmp_path)
    led, flag = tmp_path / "l.jsonl", tmp_path.parent / f"{tmp_path.name}-flag"
    assert main(["init", str(led)]) == 0
    assert main(["act", str(led), "--", "touch", str(flag)]) == 3
    ah = json.loads(capsys.readouterr().out.strip().splitlines()[-1])["action_hash"]
    assert main(["approve", str(led), ah]) == 0
    snap = led.read_bytes()
    assert main(["act", str(led), "--", "touch", str(flag)]) == 0 and flag.exists()
    flag.unlink()
    led.write_bytes(snap)  # rollback to the state right after approval.granted
    assert main(["act", str(led), "--", "touch", str(flag)]) != 0
    assert not flag.exists()


def test_6_key_redacted_in_binary_blob():
    from truthlens.wrapper import _scrub_bytes
    key = "hmac-key-outside-agent"
    out = _scrub_bytes(b"\xff\x00" + key.encode() + b"\x01", [key])
    assert key.encode() not in out and out.startswith(b"\xff\x00")
    raw = b"\xfe\xffkey\x80"  # non-UTF-8 key bytes
    assert raw not in _scrub_bytes(b"x" + raw, [raw.decode("utf-8", "surrogateescape")])


@pytest.mark.skipif(not (_tl_agent_ok() and __import__("os").path.exists("/srv/tl-agent/venv/bin/python")),
                    reason="needs tl-agent + /srv/tl-agent/venv (box only)")
def test_witnessed_tests_run_as_test_user_cannot_read_key(tmp_path):
    keyf = _keyfile(tmp_path)
    r = tmp_path / "repo"
    r.mkdir()
    (r / "test_k.py").write_text(
        "import getpass, pytest\n"
        f"def test_key_unreadable():\n    assert getpass.getuser() == 'tl-agent'\n"
        f"    with pytest.raises(PermissionError):\n        open({str(keyf)!r}).read()\n")
    subprocess.run(["git", "init", "-q", str(r)], check=True)
    subprocess.run(["git", "-C", str(r), "add", "."], check=True)
    subprocess.run(["git", "-C", str(r), "-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "i"], check=True)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--test-user", "tl-agent",
                 "--test-path", "/srv/tl-agent/venv/bin:/usr/bin:/bin",
                 "--test", "c1=python -m pytest -q -p no:cacheprovider test_k.py",
                 "--hmac-key-file", str(keyf), "--hmac-key-id", "k1", "--", "true"]) == 0
    rep = next(e for e in Ledger(out / "ledger.jsonl").read() if e["type"] == "test.reported")["payload"]
    assert rep["passed"] == 1 and rep["failed"] == 0

def test_b2_argv0_script_bound_and_proc_args_ignored(tmp_path):
    (tmp_path / "deploy.sh").write_text("#!/bin/sh\necho ok\n")
    h1 = gate.action_hash(["./deploy.sh"], str(tmp_path))
    (tmp_path / "deploy.sh").write_text("#!/bin/sh\necho EVIL\n")
    assert gate.action_hash(["./deploy.sh"], str(tmp_path)) != h1
    with pytest.raises(LedgerError, match="outside"):  # snapshot gate (#42): paths outside the tree refused
        gate.action_hash(["echo", "/proc/self/mem"], str(tmp_path))


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


def test_34_review_relative_path_entry_fifo_and_external_symlink(tmp_path):
    led = _open_ledger(tmp_path)
    repo = tmp_path / "repo"
    (repo / "bin").mkdir(parents=True)
    (repo / "bin" / "tool").write_text("#!/bin/sh\necho ok\n")
    (repo / "bin" / "tool").chmod(0o755)
    with pytest.raises(LedgerError, match="absolute PATH"):  # relative PATH entry ignored
        gate.act(led, {"kind": "agent", "id": "a"}, ["tool"], str(repo), env={"PATH": "bin"})
    os.mkfifo(tmp_path / "fifo")
    with pytest.raises(LedgerError, match="outside"):
        gate.act(led, {"kind": "agent", "id": "a"}, ["cat", str(tmp_path / "fifo")], str(repo))
    os.symlink(tmp_path / "fifo", repo / "ext")
    with pytest.raises(LedgerError, match="symlink points outside"):
        gate.act(led, {"kind": "agent", "id": "a"}, ["cat", "ext"], str(repo))


def test_45_review_non_utf8_key_in_agent_stdout_not_stored(tmp_path):
    r, crit = _repo(tmp_path)
    raw = b"\xfe\xffnon-utf8-key\x80"
    keyf = tmp_path / "kd" / "key"
    keyf.parent.mkdir()
    keyf.write_bytes(raw)
    keyf.chmod(0o600)
    (r / "leak.py").write_text(f"import sys\nsys.stdout.buffer.write(b'DONE: ' + {raw!r} + b'\\n')\n")
    subprocess.run(["git", "-C", str(r), "add", "."], check=True)
    subprocess.run(["git", "-C", str(r), "-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "e"], check=True)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit), "--hmac-key-file", str(keyf),
                 "--hmac-key-id", "k1", "--", sys.executable, "leak.py"]) == 0
    stored = (out / "ledger.jsonl").read_bytes() + b"".join(p.read_bytes() for p in (out / "blobs").rglob("*")
                                                             if p.is_file())
    assert b"non-utf8-key" not in stored

def test_42_review_absolute_in_tree_paths_modes_and_git_file(tmp_path):
    led = _open_ledger(tmp_path)
    repo, out = tmp_path / "repo", tmp_path / "out"
    repo.mkdir()
    (repo / ".git").write_text("gitdir: /elsewhere\n")  # worktree pointer is never copied/bound
    (repo / "d.sh").write_text(f"echo ok > {out}\n")
    h1 = gate.action_hash(["sh", str(repo / "d.sh")], str(repo), gate.snapshot(str(repo)))
    (repo / ".git").write_text("gitdir: /other\n")
    assert gate.action_hash(["sh", str(repo / "d.sh")], str(repo), gate.snapshot(str(repo))) == h1
    (repo / "d.sh").chmod(0o755)
    assert gate.action_hash(["sh", str(repo / "d.sh")], str(repo), gate.snapshot(str(repo))) != h1  # mode bound
    rc, info = gate.act(led, {"kind": "agent", "id": "a"}, ["sh", str(repo / "d.sh")], str(repo))
    gate.approve(led, "shu", info["action_hash"])
    rc, _ = gate.act(led, {"kind": "agent", "id": "a"}, ["sh", str(repo / "d.sh")], str(repo))
    assert rc == 0 and out.read_text() == "ok\n"  # absolute in-tree path ran from the approved copy


def test_46_review_isolation_failure_is_no_evidence_and_run_finishes(tmp_path):
    r, crit = _repo(tmp_path)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit), "--confirm", "c1,c2,c3",
                 "--test-user", "no-such-user-tl", "--test", "c1=python -m pytest -q test_page.py",
                 "--hmac-key-file", str(_keyfile(tmp_path)), "--hmac-key-id", "k1", "--", "true"]) == 0
    ev = Ledger(out / "ledger.jsonl").read()
    rep = next(e for e in ev if e["type"] == "test.reported")["payload"]
    assert rep["passed"] == 0 and rep["failed"] == 0 and rep["exit_code"] == 125
    assert ev[-1]["type"] == "run.finished"

def test_34_r6_cwd_bound_in_action_hash(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    a.mkdir()
    b.mkdir()
    assert gate.action_hash(["true"], str(a)) != gate.action_hash(["true"], str(b))


def _approve_and_run(tmp_path, repo, argv, env=None, during=None, monkeypatch=None):
    led = _open_ledger(tmp_path)
    rc, info = gate.act(led, {"kind": "agent", "id": "a"}, argv, str(repo), env=env)
    assert rc == gate.BLOCKED
    gate.approve(led, "shu", info["action_hash"])
    if during:
        real = gate._materialize

        def swap(snap, td):
            during()  # live tree / program changes after the hash was taken, before execution
            real(snap, td)
        monkeypatch.setattr(gate, "_materialize", swap)
    return gate.act(led, {"kind": "agent", "id": "a"}, argv, str(repo), env=env)


def test_42_r6_dotdot_program_refused(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    (tmp_path / "evil.sh").write_text("#!/bin/sh\necho evil\n")
    (tmp_path / "evil.sh").chmod(0o755)
    with pytest.raises(LedgerError, match="outside"):
        gate.act(_open_ledger(tmp_path), {"kind": "agent", "id": "a"}, ["../evil.sh"], str(repo))


def test_42_r6_external_program_not_re_resolved(tmp_path, monkeypatch):
    repo, bind, out = tmp_path / "repo", tmp_path / "bin", tmp_path / "out"
    repo.mkdir()
    bind.mkdir()
    (bind / "tool").write_text(f"#!/bin/sh\necho old > {out}\n")
    (bind / "tool").chmod(0o755)
    rc, _ = _approve_and_run(tmp_path, repo, ["tool"], env={"PATH": f"{bind}:/usr/bin:/bin"}, monkeypatch=monkeypatch,
                             during=lambda: (bind / "tool").write_text(f"#!/bin/sh\necho new > {out}\n"))
    assert rc == 0 and out.read_text() == "old\n"


def test_42_r6_arg_mapping_ignores_live_symlink(tmp_path, monkeypatch):
    repo, out = tmp_path / "repo", tmp_path / "out"
    repo.mkdir()
    (repo / "d.sh").write_text(f"echo approved > {out}\n")
    (tmp_path / "evil.sh").write_text(f"echo evil > {out}\n")

    def swap():
        (repo / "d.sh").unlink()
        os.symlink(tmp_path / "evil.sh", repo / "d.sh")
    rc, _ = _approve_and_run(tmp_path, repo, ["sh", str(repo / "d.sh")], during=swap, monkeypatch=monkeypatch)
    assert rc == 0 and out.read_text() == "approved\n"


def test_46_r6_sudo_failure_not_read_as_no_processes(tmp_path, monkeypatch):
    import truthlens.wrapper as w
    real = subprocess.run

    def fake(argv, *a, **k):
        j = " ".join(map(str, argv)) if isinstance(argv, list) else str(argv)
        if "pkill" in j or "/bin/true" in j:  # sudo itself fails with exit 1 (e.g. not permitted)
            return subprocess.CompletedProcess(argv, 1, b"", b"sudo: not allowed")
        if "chown" in j:
            return subprocess.CompletedProcess(argv, 0, b"", b"")
        return real(argv, *a, **k)
    monkeypatch.setattr(w.subprocess, "run", fake)
    r, crit = _repo(tmp_path)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit), "--confirm", "c1,c2,c3",
                 "--test-user", "no-such-user-tl", "--test", "c1=python -m pytest -q test_page.py",
                 "--hmac-key-file", str(_keyfile(tmp_path)), "--hmac-key-id", "k1", "--", "true"]) == 0
    rep = next(e for e in Ledger(out / "ledger.jsonl").read() if e["type"] == "test.reported")["payload"]
    assert rep["exit_code"] == 125  # isolation not established -> tests not run


def test_46_r6_key_filename_in_blobs_and_probe_ignores_test_path_sudo(tmp_path):
    r, crit = _repo(tmp_path)
    key = "hmac-key-outside-agent"
    (r / key).write_text("x")  # key as filename already in the start snapshot
    subprocess.run(["git", "-C", str(r), "add", "."], check=True)
    subprocess.run(["git", "-C", str(r), "-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "k"], check=True)
    fake = tmp_path / "fakebin"
    fake.mkdir()
    marker = tmp_path / "fake-sudo-ran"
    (fake / "sudo").write_text(f"#!/bin/sh\ntouch {marker}\nexit 1\n")
    (fake / "sudo").chmod(0o755)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit), "--confirm", "c1,c2,c3",
                 "--test-user", "no-such-user-tl", "--test-path", f"{fake}:/usr/bin:/bin",
                 "--test", "c1=python -m pytest -q test_page.py",
                 "--hmac-key-file", str(_keyfile(tmp_path)), "--hmac-key-id", "k1", "--", "true"]) == 0
    assert not marker.exists()
    stored = b"".join(p.read_bytes() for p in (out / "blobs").rglob("*") if p.is_file())
    assert key.encode() not in stored + (out / "ledger.jsonl").read_bytes()


def test_r6_absolute_test_path_into_live_repo_runs_the_copy(tmp_path):
    r, crit = _repo(tmp_path)
    (r / "evil.py").write_text("open('test_mail.py','w').write('def test_mail():\\n    assert True\\n')\n")
    subprocess.run(["git", "-C", str(r), "add", "evil.py"], check=True)
    subprocess.run(["git", "-C", str(r), "-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "e"], check=True)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(r), "--criteria", str(crit), "--confirm", "c1,c2,c3",
                 "--test", f"c2={sys.executable} -m pytest -q -p no:cacheprovider {r.resolve()}/test_mail.py",
                 "--hmac-key-file", str(_keyfile(tmp_path)), "--hmac-key-id", "k1",
                 "--", sys.executable, "evil.py"]) == 0
    rep = next(e for e in Ledger(out / "ledger.jsonl").read() if e["type"] == "test.reported")["payload"]
    assert rep["passed"] == 0 and rep["failed"] >= 1

def test_34_r6_cli_act_binds_cwd(tmp_path, monkeypatch, capsys):
    led = tmp_path / "l.jsonl"
    assert main(["init", str(led)]) == 0
    a, b = tmp_path / "a", tmp_path / "b"
    a.mkdir()
    b.mkdir()
    monkeypatch.chdir(a)
    assert main(["act", str(led), "--", "true"]) == 3
    ha = json.loads(capsys.readouterr().out.strip().splitlines()[-1])["action_hash"]
    monkeypatch.chdir(b)
    assert main(["act", str(led), "--", "true"]) == 3
    hb = json.loads(capsys.readouterr().out.strip().splitlines()[-1])["action_hash"]
    assert ha != hb  # approval for dir A does not cover dir B
