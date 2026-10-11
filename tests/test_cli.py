import os
import subprocess
import sys

ENV = {**os.environ, "PYTHONPATH": os.path.join(os.path.dirname(__file__), "..", "src")}


def tl(*args):
    return subprocess.run([sys.executable, "-m", "truthlens", *args], check=False, capture_output=True, text=True, env=ENV)


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
