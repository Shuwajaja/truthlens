import hashlib
import json
import subprocess
import sys

import pytest

from truthlens.canonical import canonical_bytes
from truthlens.ledger import GENESIS, Ledger, LedgerError, repair, verify

A = {"kind": "wrapper", "id": "wrap_1"}
RUN = "run_01TEST"
H = {"kind": "human", "id": "u"}


def _event(seq, prev_hash, type="x", payload=None, **kw):
    if payload is None:
        payload = {"a": 1}
    ev = {
        "schema_version": 1, "id": f"evt_t{seq}", "seq": seq,
        "ts": "2026-10-11T00:00:00.000Z", "run_id": RUN,
        "actor": A, "type": type, "payload": payload,
        "prev_hash": prev_hash,
    }
    ev.update(kw)
    body = canonical_bytes({k: v for k, v in ev.items() if k not in ("hash", "hmac")})
    ev["hash"] = hashlib.sha256(body).hexdigest()
    return ev


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


def test_f1_executed_needs_action_hash(tmp_path):
    """Finding 1: action.executed must always have a non-empty action_hash."""
    p = tmp_path / "l.jsonl"
    e1 = _event(1, GENESIS)
    bad = _event(2, e1["hash"], type="action.executed", payload={"result": "ok"})
    p.write_bytes(canonical_bytes(e1) + b"\n" + canonical_bytes(bad) + b"\n")
    r = verify(p)
    assert not r.ok
    assert any("without action_hash" in m for _, m in r.errors)


def test_f2_simulated_approval(tmp_path):
    """Finding 2: simulated approval never authorizes action.executed."""
    p = tmp_path / "l.jsonl"
    led = Ledger(p)
    led.append(RUN, H, "approval.granted",
               {"action_hash": "h1", "approver": "u", "expires_at": "z", "simulated": True})
    g = led.read()[-1]
    with pytest.raises(LedgerError, match="simulated approval"):
        led.append(RUN, A, "action.executed",
                   {"action_hash": "h1", "approval_event_id": g["id"], "result": "ok"})


def test_f3_duplicate_keys_rejected(tmp_path):
    """Finding 3: duplicate JSON keys anywhere in a line are rejected."""
    p = tmp_path / "l.jsonl"
    line = (b'{"seq":1,"seq":1,"schema_version":1,"id":"evt_d","ts":"2026-10-11T00:00:00.000Z",'
            b'"run_id":"run_01TEST","actor":{"kind":"wrapper","id":"w"},"type":"x",'
            b'"payload":{"a":1},"prev_hash":"' + GENESIS.encode() +
            b'","hash":"00000000000000000000000000000000000000000000000000000000000000000000000000"}\n')
    p.write_bytes(line)
    r = verify(p)
    assert not r.ok
    assert any("unparseable" in m for _, m in r.errors)


def test_f4_repair_under_lock(tmp_path):
    """Finding 4: repair holds same exclusive lock; append inside repair no deadlock."""
    p = tmp_path / "l.jsonl"
    Ledger(p).append(RUN, A, "x", {"v": 1})
    Ledger(p).append(RUN, A, "x", {"v": 2})
    p.write_bytes(p.read_bytes() + b"garbage_tail")
    ev = repair(p, H)
    assert ev["type"] == "ledger.repaired"
    assert verify(p).ok


def test_f5_repair_nothing_to_anchor(tmp_path):
    """Finding 5: repair on torn first line raises without modifying file."""
    p = tmp_path / "l.jsonl"
    p.write_bytes(b"garbage_only")
    with pytest.raises(LedgerError, match="nothing valid to anchor repair"):
        repair(p, H)
    assert p.read_bytes() == b"garbage_only"


def test_f6_repair_with_hmac(tmp_path):
    """Finding 6: repair with hmac_key signs ledger.repaired."""
    p = tmp_path / "l.jsonl"
    Ledger(p, b"key1", "k1").append(RUN, A, "x", {"v": 1})
    p.write_bytes(p.read_bytes() + b"garbage")
    repair(p, H, hmac_key=b"key1", hmac_key_id="k1")
    r = verify(p, b"key1")
    assert r.ok
    events = [json.loads(x) for x in p.read_text().splitlines() if x.strip()]
    assert "hmac" in events[-1]


def test_f7_expected_last_hash(tmp_path):
    """Finding 7: verify with expected_last_hash detects truncation/extend."""
    p = tmp_path / "l.jsonl"
    led = Ledger(p)
    led.append(RUN, A, "x", {"v": 1})
    e2 = led.append(RUN, A, "x", {"v": 2})
    r = verify(p, expected_last_hash=GENESIS)
    assert not r.ok
    assert any("anchor mismatch" in m for _, m in r.errors)
    r = verify(p, expected_last_hash=e2["hash"])
    assert r.ok and r.anchored


def test_blocked_action_needs_unexpired_approval(tmp_path):
    led = Ledger(tmp_path / "l.jsonl")
    led.append(RUN, A, "action.blocked", {"action_hash": "h9", "policy": "p", "reason": "r"})
    with pytest.raises(LedgerError, match="without approval_event_id"):
        led.append(RUN, A, "action.executed", {"action_hash": "h9", "result": "ok"})
    g = led.append(RUN, H, "approval.granted", {"action_hash": "h9", "approver": "u", "expires_at": "2000-01-01T00:00:00Z"})
    with pytest.raises(LedgerError, match="expired"):
        led.append(RUN, A, "action.executed", {"action_hash": "h9", "approval_event_id": g["id"], "result": "ok"})
