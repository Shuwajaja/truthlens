"""The demo association sidecar is beside the ledger and not part of it."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "demo" / "runs" / "demo-2"


def test_association_sidecar_does_not_change_demo_ledger_bytes():
    ledger = DEMO / "ledger.jsonl"
    before = ledger.read_bytes()
    sidecar = json.loads((DEMO / "association.json").read_text(encoding="utf-8"))
    assert sidecar["association_version"] == 1
    assert "status" not in sidecar
    assert ledger.read_bytes() == before
    result = subprocess.run(
        [sys.executable, "-m", "truthlens", "verify", "demo/runs/demo-2/ledger.jsonl"],
        cwd=ROOT,
        env={**os.environ, "PYTHONPATH": "src"},
        check=False,
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode == 0
    assert result.stderr == ""
    assert result.stdout.strip() == "OK 16 events, anchored"
