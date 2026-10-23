"""Durable gate delivery: an immutable request may execute at most once."""
import json
import multiprocessing
import os

import pytest

from tests.test_round5 import _open_ledger
from truthlens import gate

ACTOR = {"kind": "agent", "id": "a"}


def _prepared(tmp_path):
    led = _open_ledger(tmp_path)
    repo = tmp_path / "repo"
    repo.mkdir()
    count = tmp_path / "count"
    (repo / "action.sh").write_text(f"echo ran >> {count}\n")
    argv = ["sh", "action.sh"]
    _, info = gate.act(led, ACTOR, argv, str(repo), env={})
    approvals = [gate.approve(led, "shu", info["action_hash"]) for _ in range(2)]
    srv = gate.GateServer(led, tmp_path / "inbox", str(repo), {}, ACTOR)
    return led, srv, argv, count, approvals


def _submit(srv, argv, name="x"):
    req = srv.inbox / f"{name}.req"
    req.write_text(json.dumps({"argv": argv}))
    return req


def _executions(led):
    return [e for e in led.read() if e["type"] == "action.executed"]


def test_response_directory_quarantined_and_request_removed_after_durable_answer(tmp_path, monkeypatch):
    led, srv, argv, count, approvals = _prepared(tmp_path)
    req = _submit(srv, argv)
    res = srv.inbox / "x.res"
    res.mkdir()
    (res / "keep").write_text("preserve")
    real_unlink = type(req).unlink
    synced = []
    real_sync = os.fsync

    def sync(fd):
        real_sync(fd)
        if res.is_file() and req.exists():
            synced.append(True)

    def unlink(path, *args, **kwargs):
        if path == req:
            assert synced
            assert json.loads(res.read_text())["rc"] == 0
        return real_unlink(path, *args, **kwargs)

    monkeypatch.setattr(os, "fsync", sync)
    monkeypatch.setattr(type(req), "unlink", unlink)
    srv.poll()
    assert not req.exists()
    assert json.loads(res.read_text())["status"] == "executed"
    assert count.read_text() == "ran\n"
    assert len(_executions(led)) == 1
    assert len({a["id"] for a in approvals} - {e["payload"]["approval_event_id"] for e in _executions(led)}) == 1
    quarantined = [p for p in srv.inbox.iterdir() if p.is_dir()]
    assert len(quarantined) == 1
    assert (quarantined[0] / "keep").read_text() == "preserve"


@pytest.mark.parametrize("restart", [False, True])
def test_failed_publication_replays_outcome_without_second_execution(tmp_path, monkeypatch, restart):
    led, srv, argv, count, _ = _prepared(tmp_path)
    req = _submit(srv, argv)
    with monkeypatch.context() as m:
        def fail(*args):
            raise OSError("publication unavailable")
        m.setattr(gate, "_write_response", fail)
        srv.poll()
    assert req.exists()
    assert count.read_text() == "ran\n"
    if restart:
        srv = gate.GateServer(led, srv.inbox, srv.cwd, {}, ACTOR)
    srv.poll()
    answer = json.loads((srv.inbox / "x.res").read_text())
    assert answer["rc"] == 0
    assert answer["event"] == _executions(led)[0]["id"]
    assert not req.exists()
    assert count.read_text() == "ran\n"
    assert len(_executions(led)) == 1
    _submit(srv, ["false"])  # filename identity is immutable even if its contents change
    srv.poll()
    assert json.loads((srv.inbox / "x.res").read_text()) == answer
    _submit(srv, argv, "new")
    srv.poll()
    assert json.loads((srv.inbox / "new.res").read_text())["rc"] == 0
    assert count.read_text() == "ran\nran\n"
    assert len(_executions(led)) == 2


def test_reserved_without_outcome_restarts_indeterminate(tmp_path, monkeypatch):
    led, srv, argv, count, _ = _prepared(tmp_path)
    req = _submit(srv, argv)
    with monkeypatch.context() as m:
        def crash(*args):
            raise SystemExit("simulated crash after durable reservation")
        m.setattr(gate, "_materialize", crash)
        with pytest.raises(SystemExit):
            srv.poll()
    assert req.exists()
    assert not count.exists()
    restarted = gate.GateServer(led, srv.inbox, srv.cwd, {}, ACTOR)
    restarted.poll()
    answer = json.loads((srv.inbox / "x.res").read_text())
    assert answer["rc"] == 2 and answer["status"] == "indeterminate"
    assert len(_executions(led)) == 1
    assert not count.exists()


def test_duplicate_acts_across_processes_execute_once(tmp_path):
    led, srv, argv, count, _ = _prepared(tmp_path)
    ctx = multiprocessing.get_context("fork")
    start, answers = ctx.Event(), ctx.Queue()

    def run():
        start.wait()
        answers.put(gate.act(led, ACTOR, argv, srv.cwd, {}, request_id="gate:test"))

    workers = [ctx.Process(target=run) for _ in range(2)]
    for worker in workers:
        worker.start()
    start.set()
    try:
        results = [answers.get(timeout=5) for _ in workers]
        assert results[0] == results[1]
        assert results[0][0] == 0
        assert count.read_text() == "ran\n"
        assert len(_executions(led)) == 1
    finally:
        for worker in workers:
            worker.join(timeout=2)
            if worker.is_alive():
                worker.terminate()
                worker.join(timeout=2)
            worker.close()
        answers.close()


def test_replay_closed_run_but_new_identity_cannot_append(tmp_path):
    led, srv, argv, count, _ = _prepared(tmp_path)
    expected = gate.act(led, ACTOR, argv, srv.cwd, {}, request_id="gate:closed")
    last = led.read()[-1]
    led.append(last["run_id"], {"kind": "system", "id": "t"}, "run.finished",
               {"exit_code": 0, "status": "ok", "last_hash": last["hash"]})
    before = led.path.read_bytes()
    assert gate.act(led, ACTOR, ["missing"], "/missing", {}, request_id="gate:closed") == expected
    with pytest.raises(gate.LedgerError, match="closed"):
        gate.act(led, ACTOR, argv, srv.cwd, {}, request_id="gate:new")
    assert led.path.read_bytes() == before
    assert count.read_text() == "ran\n"


def test_agent_authored_identity_cannot_be_replayed_or_execute(tmp_path):
    led, srv, argv, count, approvals = _prepared(tmp_path)
    led.append("run_1", ACTOR, "action.executed",
               {"action_hash": approvals[0]["payload"]["action_hash"],
                "approval_event_id": approvals[0]["id"], "result": "started"}, request_id="gate:fake")
    with pytest.raises(gate.LedgerError, match="verified gate reservation"):
        gate.act(led, ACTOR, argv, srv.cwd, {}, request_id="gate:fake")
    assert not count.exists()


def test_replay_checks_rollback_before_returning_outcome(tmp_path):
    led, srv, argv, count, _ = _prepared(tmp_path)
    gate.act(led, ACTOR, argv, srv.cwd, {}, request_id="gate:earlier")
    earlier = led.path.read_bytes()
    gate.act(led, ACTOR, argv, srv.cwd, {}, request_id="gate:later")
    led.path.write_bytes(earlier)
    with pytest.raises(gate.LedgerError, match="rollback"):
        gate.act(led, ACTOR, argv, srv.cwd, {}, request_id="gate:earlier")
    assert count.read_text() == "ran\nran\n"


def test_request_lock_failure_never_executes(tmp_path):
    led, srv, argv, count, _ = _prepared(tmp_path)
    identity = gate.hashlib.sha256(os.fsencode(os.path.realpath(led.path))).hexdigest()
    path = gate._anchor_path("gate-lock").with_name(f"gate-{identity}.lock")
    target = tmp_path / "untouched"
    target.write_text("keep")
    path.symlink_to(target)
    with pytest.raises(OSError):
        gate.act(led, ACTOR, argv, srv.cwd, {}, request_id="gate:locked")
    assert target.read_text() == "keep"
    assert not count.exists()


def test_stale_poll_request_does_not_overwrite_completed_response(tmp_path, monkeypatch):
    led, srv, argv, count, _ = _prepared(tmp_path)
    req = _submit(srv, argv)
    srv.poll()
    response = (srv.inbox / "x.res").read_bytes()
    # A concurrent poll may have enumerated this name before the first removed it.
    monkeypatch.setattr(type(req), "glob", lambda self, pattern: iter([req]))
    srv.poll()
    assert (srv.inbox / "x.res").read_bytes() == response
    assert count.read_text() == "ran\n"
    assert len(_executions(led)) == 1


def test_long_response_directory_name_still_delivers(tmp_path):
    _led, srv, argv, count, _ = _prepared(tmp_path)
    name = "x" * 240
    req = _submit(srv, argv, name)
    (srv.inbox / f"{name}.res").mkdir()
    srv.poll()
    assert not req.exists()
    assert json.loads((srv.inbox / f"{name}.res").read_text())["rc"] == 0
    assert count.read_text() == "ran\n"
