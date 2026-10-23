"""CodexChat round-5 #29.3/#29.4 (gate robustness, safe response files)."""
import hashlib
import json
import multiprocessing
import os
import stat
import tempfile

import pytest

from tests.test_round5 import _open_ledger
from truthlens import gate
from truthlens.ledger import LedgerError


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
    (tmp_path / "prog").write_text("not executable")  # exec fails with PermissionError after approval
    argv = ["./prog"]
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


def test_snapshot_file_cap_counts_directories(tmp_path, monkeypatch):
    monkeypatch.setattr(gate, "MAX_SNAPSHOT_FILES", 2)
    (tmp_path / "a" / "b").mkdir(parents=True)
    assert len(gate.snapshot(str(tmp_path))) == 2
    (tmp_path / "c").mkdir()
    with pytest.raises(LedgerError, match="too large"):
        gate.snapshot(str(tmp_path))


def test_materialize_restores_directory_modes(tmp_path):
    snap = {
        "parent": ("dir", b"", 0o400),
        "parent/child": ("dir", b"", 0o510),
        "parent/child/file": ("file", b"approved", 0o640),
        "private": ("dir", b"", 0o500),
    }
    gate._materialize(snap, str(tmp_path))
    assert stat.S_IMODE((tmp_path / "parent").stat().st_mode) == 0o400
    # Restore traversal for inspection after proving even a non-executable parent is exact.
    (tmp_path / "parent").chmod(0o500)
    assert (tmp_path / "parent/child/file").read_bytes() == b"approved"
    for rel in ("parent/child", "private"):
        assert stat.S_IMODE((tmp_path / rel).stat().st_mode) == snap[rel][2]


def test_tempdir_creation_failure_consumes_once_and_records_outcome(tmp_path, monkeypatch):
    led = _open_ledger(tmp_path)
    repo = tmp_path / "repo"
    repo.mkdir()
    side_effect = tmp_path / "side-effect"
    (repo / "action.sh").write_text(f"echo ran > {side_effect}\n")
    argv, actor = ["sh", "action.sh"], {"kind": "agent", "id": "a"}
    _, info = gate.act(led, actor, argv, str(repo))
    approval = gate.approve(led, "shu", info["action_hash"])

    def fail_tempdir(*args, **kwargs):
        raise OSError("fake temporary storage failure")

    monkeypatch.setattr(tempfile, "TemporaryDirectory", fail_tempdir)
    rc, _ = gate.act(led, actor, argv, str(repo))
    assert rc == 127
    events = led.read()
    executed = [e for e in events if e["type"] == "action.executed"]
    assert len(executed) == 1
    assert executed[0]["payload"]["approval_event_id"] == approval["id"]
    outcome = events[-1]
    assert outcome["type"] == "evidence.attached"
    assert outcome["payload"]["refers_to"] == executed[0]["id"]
    assert outcome["payload"]["exit_code"] == 127
    assert outcome["payload"]["result"] == "info"
    assert gate.act(led, actor, argv, str(repo))[0] == gate.BLOCKED
    assert len([e for e in led.read() if e["type"] == "action.executed"]) == 1
    assert not side_effect.exists()


@pytest.mark.parametrize("invalid", ["oversized", "invalid-utf8", "invalid-json"])
def test_gate_rejects_invalid_request_without_reflecting_content(tmp_path, invalid):
    led, srv = _server(tmp_path)
    if invalid == "oversized":
        data = b'{"argv":["true"]}' + b" " * (64 * 1024)
    elif invalid == "invalid-utf8":
        data = b"\xff fake-sensitive-content"
    else:
        data = b'{"fake-sensitive-content": invalid}'
    (srv.inbox / "x.req").write_bytes(data)
    srv.poll()
    answer = json.loads((srv.inbox / "x.res").read_bytes())
    assert answer == {"rc": 2, "status": "error", "error": "invalid gate request"}
    assert not any(e["type"] == "action.requested" for e in led.read())


def test_gate_accepts_request_at_byte_limit(tmp_path):
    _, srv = _server(tmp_path)
    data = b'{"argv":["true"]}'
    (srv.inbox / "x.req").write_bytes(data + b" " * (64 * 1024 - len(data)))
    srv.poll()
    assert json.loads((srv.inbox / "x.res").read_bytes())["rc"] == gate.BLOCKED


def test_gate_rejects_symlink_request(tmp_path):
    led, srv = _server(tmp_path)
    outside = tmp_path / "outside"
    outside.write_text('{"argv":["true"]}')
    (srv.inbox / "x.req").symlink_to(outside)
    srv.poll()
    assert json.loads((srv.inbox / "x.res").read_bytes())["rc"] == 2
    assert outside.read_text() == '{"argv":["true"]}'
    assert not any(e["type"] == "action.requested" for e in led.read())


def test_gate_fifo_request_does_not_block(tmp_path):
    _, srv = _server(tmp_path)
    os.mkfifo(srv.inbox / "x.req")
    worker = multiprocessing.get_context("fork").Process(target=srv.poll)
    worker.start()
    try:
        worker.join(timeout=2)
        assert not worker.is_alive(), "gate blocked reading a FIFO request"
        assert worker.exitcode == 0
        assert json.loads((srv.inbox / "x.res").read_bytes())["rc"] == 2
    finally:
        if worker.is_alive():
            worker.terminate()
        worker.join(timeout=2)
        worker.close()


@pytest.mark.parametrize("failure", ["write", "replace", "fsync"])
def test_response_failure_cleans_owned_temp(tmp_path, monkeypatch, failure):
    response = tmp_path / "x.res"
    if failure == "write":
        real_fdopen = os.fdopen

        class FailingWriter:
            def __init__(self, fd, mode):
                self.file = real_fdopen(fd, mode)

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                self.file.close()

            def write(self, data):
                self.file.write(data[:1])
                raise OSError("fake write failure")

        monkeypatch.setattr(os, "fdopen", FailingWriter)
    else:
        def fail(*args):
            raise OSError("fake publication failure")

        monkeypatch.setattr(os, failure, fail)
    with pytest.raises(OSError):
        gate._write_response(response, b"complete answer")
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize("collision", ["file", "directory", "symlink"])
def test_response_collision_is_never_removed(tmp_path, monkeypatch, collision):
    monkeypatch.setattr("truthlens.ids.new_id", lambda prefix: "res_fixed")
    planted = tmp_path / ".res_fixed.tmp"
    target = tmp_path / "target"
    target.write_bytes(b"keep")
    if collision == "file":
        planted.write_bytes(b"keep")
    elif collision == "directory":
        planted.mkdir()
    else:
        planted.symlink_to(target)
    with pytest.raises(FileExistsError):
        gate._write_response(tmp_path / "x.res", b"answer")
    assert planted.lstat()
    assert target.read_bytes() == b"keep"
    if collision == "file":
        assert planted.read_bytes() == b"keep"


@pytest.mark.parametrize("destination", ["symlink", "directory"])
def test_response_destination_does_not_change_outside_target(tmp_path, destination):
    response, target = tmp_path / "x.res", tmp_path / "target"
    target.write_bytes(b"keep")
    if destination == "symlink":
        response.symlink_to(target)
        gate._write_response(response, b"answer")
        assert not response.is_symlink()
        assert response.read_bytes() == b"answer"
    else:
        response.mkdir()
        gate._write_response(response, b"answer")
        assert response.read_bytes() == b"answer"
        assert len([p for p in tmp_path.iterdir() if p.is_dir()]) == 1
    assert target.read_bytes() == b"keep"
    assert not list(tmp_path.glob(".res_*.tmp"))


def test_response_is_flushed_and_synced_before_replace(tmp_path, monkeypatch):
    response = tmp_path / "x.res"
    synced = []
    real_sync, real_replace = os.fsync, os.replace

    # Read using a separate fd because the production fd is intentionally write-only.
    def sync_written_file(fd):
        if stat.S_ISDIR(os.fstat(fd).st_mode):
            assert response.read_bytes() == b"answer"
        else:
            assert next(tmp_path.glob(".res_*.tmp")).read_bytes() == b"answer"
        real_sync(fd)
        synced.append(True)

    def replace(src, dst):
        assert synced == [True]
        real_replace(src, dst)

    monkeypatch.setattr(os, "fsync", sync_written_file)
    monkeypatch.setattr(os, "replace", replace)
    gate._write_response(response, b"answer")
    assert response.read_bytes() == b"answer"


@pytest.mark.parametrize("inherit", [False, True])
def test_gate_command_output_hash_uses_redacted_bytes(tmp_path, monkeypatch, inherit):
    import sys

    led = _open_ledger(tmp_path)
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "emit.py").write_text(
        "import os\n"
        "os.write(1, os.environ['GATED_VALUE'].encode() + b'|sk-test-pattern|')\n"
        "os.write(2, b'" + ("k" * 32) + "|\\xffend')\n"
    )
    env = {"GATED_VALUE": "opaque-fake-gated-value"}
    if inherit:
        for name in list(os.environ):
            if name != "TRUTHLENS_ANCHOR_DIR":
                monkeypatch.delenv(name)
        monkeypatch.setenv("GATED_VALUE", env["GATED_VALUE"])
    argv, actor = [sys.executable, "emit.py"], {"kind": "agent", "id": "a"}
    effective = None if inherit else env
    _, info = gate.act(led, actor, argv, str(repo), env=effective)
    gate.approve(led, "shu", info["action_hash"])
    assert gate.act(led, actor, argv, str(repo), env=effective)[0] == 0
    digest = led.read()[-1]["payload"]["sha256"]
    raw = b"opaque-fake-gated-value|sk-test-pattern|" + b"k" * 32 + b"|\xffend"
    expected = b"[REDACTED]|[REDACTED]|[REDACTED]|\xffend"
    assert digest == hashlib.sha256(expected).hexdigest()
    assert digest != hashlib.sha256(raw).hexdigest()
    assert hashlib.sha256(raw).hexdigest().encode() not in led.path.read_bytes()
    assert b"opaque-fake-gated-value" not in led.path.read_bytes()
    assert not (led.path.parent / "blobs").exists()


def test_gate_output_scrub_is_one_pass_longest_first():
    raw = b"abc|ab|R|\xff"
    assert gate._scrub_output(raw, {"a": "ab", "b": "abc", "c": "R", "d": "\udcff"}, None) == (
        b"[REDACTED]|[REDACTED]|[REDACTED]|[REDACTED]"
    )
