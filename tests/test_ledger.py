import json
import subprocess
import sys

import pytest

from truthlens.ledger import GENESIS, Ledger, LedgerError, verify

A = {"kind": "wrapper", "id": "wrap_1"}
RUN = "run_01TEST"


def test_roundtrip_chain_and_anchor(tmp_path):
    p = tmp_path / "l.jsonl"
    led = Ledger(p)
    e1 = led.append(RUN, A, "run.started", {"repo": "r", "ref": "main", "command": "x", "agent": "a"})
    assert e1["seq"] == 1 and e1["prev_hash"] == GENESIS
    e2 = led.append(RUN, A, "run.finished", {"exit_code": 0, "status": "ok", "last_hash": e1["hash"]})
    assert e2["prev_hash"] == e1["hash"]
    r = verify(p)
    assert r.ok and r.anchored and r.events == 2 and r.last_hash == e2["hash"]


def test_hmac_ok_and_wrong_key(tmp_path):
    p = tmp_path / "l.jsonl"
    Ledger(p, b"k1", "key1").append(RUN, A, "x", {"a": 1})
    assert verify(p, b"k1").ok
    assert any("hmac mismatch" in m for _, m in verify(p, b"bad").errors)


def test_request_id_idempotent(tmp_path):
    led = Ledger(tmp_path / "l.jsonl")
    a = led.append(RUN, A, "x", {"a": 1}, request_id="r1")
    assert led.append(RUN, A, "x", {"a": 1}, request_id="r1") == a
    with pytest.raises(LedgerError):
        led.append(RUN, A, "x", {"a": 2}, request_id="r1")
    assert len(led.read()) == 1


def test_oversize_and_float_rejected(tmp_path):
    led = Ledger(tmp_path / "l.jsonl")
    with pytest.raises(LedgerError):
        led.append(RUN, A, "x", {"blob": "a" * (64 * 1024)})
    with pytest.raises(LedgerError):
        led.append(RUN, A, "x", {"v": 1.5})


def test_secret_never_on_disk(tmp_path):
    p = tmp_path / "l.jsonl"
    Ledger(p).append(RUN, A, "x", {"api_key": "sk-test-abcdefghijkl", "cmd": "curl -H 'Bearer abcdefghijklmnop'"})
    raw = p.read_text()
    assert "sk-test-abcdefghijkl" not in raw and "abcdefghijklmnop" not in raw and verify(p).ok


def test_append_refused_on_tampered_ledger(tmp_path):
    p = tmp_path / "l.jsonl"
    led = Ledger(p)
    led.append(RUN, A, "x", {"a": 1})
    p.write_text(p.read_text().replace('"a":1', '"a":2'))
    with pytest.raises(LedgerError):
        led.append(RUN, A, "x", {"a": 3})


def test_approval_granted_requires_human_and_single_use(tmp_path):
    p = tmp_path / "l.jsonl"
    led = Ledger(p)
    g = led.append(RUN, {"kind": "human", "id": "u"}, "approval.granted", {"action_hash": "h", "approver": "u", "expires_at": "z"})
    use = {"action_hash": "h", "approval_event_id": g["id"], "result": "ok"}
    led.append(RUN, A, "action.executed", use)
    with pytest.raises(LedgerError, match="consumed"):
        led.append(RUN, A, "action.executed", use)
    with pytest.raises(LedgerError, match="human"):
        led.append(RUN, {"kind": "agent", "id": "bot"}, "approval.granted", {"action_hash": "h2"})
    assert len(led.read()) == 2 and verify(p).ok


def test_concurrent_appends_two_processes(tmp_path):
    p = tmp_path / "l.jsonl"
    code = (
        "import sys;from truthlens.ledger import Ledger\n"
        f"L=Ledger({str(p)!r})\n"
        "for i in range(30): L.append('run_01TEST',{'kind':'wrapper','id':sys.argv[1]},'x',{'i':i})\n"
    )
    procs = [subprocess.Popen([sys.executable, "-c", code, w]) for w in ("w1", "w2")]
    assert all(pr.wait(60) == 0 for pr in procs)
    r = verify(p)
    assert r.ok and r.events == 60
    assert [json.loads(x)["seq"] for x in p.read_text().splitlines()] == list(range(1, 61))


def test_criterion_rules_d23_d24(tmp_path):
    led = Ledger(tmp_path / "l.jsonl")
    agent, human = {"kind": "agent", "id": "a"}, {"kind": "human", "id": "u"}
    with pytest.raises(LedgerError, match="D23"):
        led.append(RUN, agent, "criterion.recorded", {"criterion_id": "c1", "text": "t", "source": "user"})
    led.append(RUN, agent, "criterion.recorded",
               {"criterion_id": "c1", "text": "t", "text_sha256": "h1", "source": "derived", "derived_by": agent})
    with pytest.raises(LedgerError, match="duplicate"):
        led.append(RUN, human, "criterion.recorded", {"criterion_id": "c1", "text": "t2", "source": "user"})
    with pytest.raises(LedgerError, match="text_sha256"):
        led.append(RUN, human, "criteria.confirmed", {"criteria": [{"criterion_id": "c1", "text_sha256": "x"}]})
    led.append(RUN, human, "criteria.confirmed", {"criteria": [{"criterion_id": "c1", "text_sha256": "h1"}]})
    with pytest.raises(LedgerError, match="D25"):
        led.append(RUN, agent, "test.reported", {"suite": "s", "passed": 1, "failed": 0, "criterion_ids": ["c1"]})
