"""Acceptance: tampering and crashes are detected by verify (fail-closed); clean ledgers pass."""

import hashlib
import json
import os
import signal
import subprocess
import sys
import time

import pytest

from truthlens.canonical import canonical_bytes
from truthlens.ledger import Ledger, repair, verify

A = {"kind": "wrapper", "id": "w"}
RUN = "run_01TAMPER"


def make(tmp_path, n=5, finish=True, key=None):
    p = tmp_path / "l.jsonl"
    led = Ledger(p, key, "k1" if key else None)
    last = None
    for i in range(n):
        last = led.append(RUN, A, "x", {"i": i, "text": f"line {i}"})
    if finish:
        led.append(RUN, A, "run.finished", {"exit_code": 0, "status": "ok", "last_hash": last["hash"]})
    assert verify(p, key).ok
    return p


def lines(p):
    return p.read_bytes().split(b"\n")[:-1]


def write(p, ls):
    p.write_bytes(b"".join(x + b"\n" for x in ls))


def test_clean_ledger_no_false_positive(tmp_path):
    r = verify(make(tmp_path))
    assert r.ok and r.anchored and r.errors == []


@pytest.mark.parametrize("attack", ["byteflip", "delete", "swap", "insert", "drop_finish"])
def test_tamper_detected(tmp_path, attack):
    p = make(tmp_path)
    ls = lines(p)
    if attack == "byteflip":
        ls[2] = ls[2].replace(b"line 2", b"line X")
    elif attack == "delete":
        del ls[2]
    elif attack == "swap":
        ls[1], ls[2] = ls[2], ls[1]
    elif attack == "insert":
        ls.insert(2, ls[1])
    elif attack == "drop_finish":
        del ls[-1]
    write(p, ls)
    r = verify(p)
    if attack == "drop_finish":  # truncation after anchor: no longer anchored (manifest holds last_hash, D15)
        assert r.ok and not r.anchored
    else:
        assert not r.ok


def test_hash_recomputed_without_hmac_key_detected(tmp_path):
    key = b"secret-test-key"
    p = make(tmp_path, key=key)
    ls = lines(p)
    ev = json.loads(ls[1])
    ev["payload"]["text"] = "forged"
    ev["hash"] = hashlib.sha256(canonical_bytes({k: v for k, v in ev.items() if k not in ("hash", "hmac")})).hexdigest()
    ls[1] = canonical_bytes(ev)
    write(p, ls)
    assert any("hmac mismatch" in m for _, m in verify(p, key).errors)


def test_torn_half_last_line(tmp_path):
    p = make(tmp_path, finish=False)
    ls = lines(p)
    p.write_bytes(b"".join(x + b"\n" for x in ls[:-1]) + ls[-1][: len(ls[-1]) // 2])
    r = verify(p)
    assert not r.ok and r.torn_tail_only


def test_crash_sigkill_during_appends_then_repair(tmp_path):
    p = tmp_path / "l.jsonl"
    code = (
        "from truthlens.ledger import Ledger\n"
        f"L=Ledger({str(p)!r})\n"
        "i=0\n"
        "while True:\n"
        "    L.append('run_01TAMPER',{'kind':'wrapper','id':'w'},'x',{'i':i,'pad':'y'*2000}); i+=1\n"
    )
    pr = subprocess.Popen([sys.executable, "-c", code], env={**os.environ, "PYTHONPATH": "src"})
    deadline = time.time() + 20
    while time.time() < deadline and (not p.exists() or p.stat().st_size < 50_000):
        time.sleep(0.05)
    pr.send_signal(signal.SIGKILL)
    pr.wait()
    r = verify(p)
    assert r.ok or r.torn_tail_only
    if not r.ok:
        repair(p, {"kind": "human", "id": "tester"})
        assert verify(p).ok
