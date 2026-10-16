"""Factory JSON snapshot adapter; foreign attestations remain reported claims."""

from __future__ import annotations


def read(document: dict) -> list[dict]:
    runs = document.get("runs", [document] if "run_id" in document or "id" in document else [])
    if not isinstance(runs, list) or len(runs) > 10000 or any(not isinstance(r, dict) for r in runs):
        raise ValueError("invalid factory runs")
    return runs
