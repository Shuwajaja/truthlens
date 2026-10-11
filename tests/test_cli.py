import os
import subprocess
import sys

from truthlens.ids import new_id
from truthlens.ledger import Ledger

ENV = {**os.environ, "PYTHONPATH": os.path.join(os.path.dirname(__file__), "..", "src")}


def tl(*args, env=None):
    return subprocess.run([sys.executable, "-m", "truthlens", *args], check=False, capture_output=True, text=True, env=env or ENV)


def test_init_verify_ok(tmp_path):
    p = str(tmp_path / "l.jsonl")
    r = tl("init", p)
    assert r.returncode == 0 and r.stdout.startswith("run_")
    r = tl("verify", p)
    assert r.returncode == 0 and r.stdout.strip() == "OK 1 events, unanchored"


def test_verify_fail_and_usage(tmp_path):
    p = tmp_path / "l.jsonl"
    tl("init", str(p))
    p.write_text(p.read_text().replace('"agent":""', '"agent":"x"'))
    r = tl("verify", str(p))
    assert r.returncode == 1 and "FAIL line 1: hash mismatch" in r.stdout
    assert tl("verify").returncode == 2


def test_repair_torn_tail_only(tmp_path):
    p = tmp_path / "l.jsonl"
    tl("init", str(p))
    with open(p, "ab") as fh:
        fh.write(b'{"schema_version":1,"id":"evt_')
    assert tl("verify", str(p)).returncode == 1
    assert tl("repair", str(p)).returncode == 0
    assert tl("verify", str(p)).stdout.strip() == "OK 2 events, unanchored"
    p.write_text(p.read_text().replace('"seq":2', '"seq":3'))
    assert tl("repair", str(p)).returncode == 1


def test_repair_with_hmac_key(tmp_path):
    p = str(tmp_path / "l.jsonl")
    env = {**ENV, "MY_HMAC": "supersecret"}
    rid = new_id("run")
    led = Ledger(p, b"supersecret", "k1")
    led.append(rid, {"kind": "system", "id": "test"}, "run.started", {"a": 1})
    with open(p, "ab") as fh:
        fh.write(b'{"schema_version":1,"id":"evt_')
    r = tl("repair", p, "--hmac-key-env", "MY_HMAC", "--hmac-key-id", "k1", env=env)
    assert r.returncode == 0
    r = tl("verify", p, "--hmac-key-env", "MY_HMAC", env=env)
    assert r.returncode == 0 and "anchored" in r.stdout


def test_verify_expect_last_hash_mismatch(tmp_path):
    p = str(tmp_path / "l.jsonl")
    tl("init", p)
    r = tl("verify", p, "--expect-last-hash", "0" * 64)
    assert r.returncode == 1 and "FAIL" in r.stdout


def test_repair_torn_first_line(tmp_path):
    p = tmp_path / "l.jsonl"
    raw = b'{"schema_version":1,"id":"part'
    p.write_bytes(raw)
    r = tl("repair", str(p))
    assert r.returncode == 1 and "error:" in r.stderr
    assert p.read_bytes() == raw
