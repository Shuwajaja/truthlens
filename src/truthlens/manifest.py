"""Artifact Manifest v1 builder + acceptance computation (pure functions over ledger events).

Rules: D19 traceability, D22 confirmation, D23 authorship, D25 evidence result, D26 claim support,
D27 "tests green", D28 manifest written after run.finished and never trusted (recomputed + compared).
Works on a list of already-verified event dicts; it does not read or write the ledger itself.
"""

from __future__ import annotations

from typing import Any

WITNESS_ACTORS = {"wrapper", "system"}


def _decision(ev: dict) -> str | None:
    """'pass' | 'fail' | None (not decisive) for a witnessed event (D25, D27)."""
    if ev["actor"].get("kind") not in WITNESS_ACTORS:
        return None
    p = ev["payload"]
    if ev["type"] == "test.reported":
        failed = p.get("failed")
        if type(failed) is int and failed > 0:
            return "fail"
        passed = p.get("passed")
        if type(failed) is int and failed == 0 and type(passed) is int and passed > 0:
            return "pass"
        return None
    if ev["type"] == "evidence.attached" and p.get("result") in ("pass", "fail"):
        return p["result"]
    return None


def acceptance(events: list[dict]) -> list[dict]:
    """Per criterion: status met|unmet|unverified|proposed + witnessed evidence ids (latest decisive wins)."""
    crits: dict[str, dict] = {}
    confirmed: set[str] = set()
    for ev in events:
        p = ev["payload"]
        if ev["type"] == "criterion.recorded":
            human_user = p.get("source") == "user" and ev["actor"].get("kind") == "human"
            crits[p["criterion_id"]] = {"criterion_id": p["criterion_id"], "text": p.get("text", ""),
                                        "text_sha256": p.get("text_sha256"), "evidence": [],
                                        "_ok": human_user, "_last": None}
        elif ev["type"] == "criteria.confirmed" and ev["actor"].get("kind") == "human":
            for c in p.get("criteria", []):
                cid = c.get("criterion_id")
                if cid in crits and c.get("text_sha256") == crits[cid]["text_sha256"]:
                    confirmed.add(cid)
        else:
            d = _decision(ev)
            for cid in p.get("criterion_ids") or []:
                if cid in crits and d is not None:
                    crits[cid]["evidence"].append(ev["id"])
                    crits[cid]["_last"] = d
    out = []
    for cid, c in crits.items():
        if not (c["_ok"] or cid in confirmed):
            status = "proposed"
        else:
            status = {"pass": "met", "fail": "unmet"}.get(c["_last"], "unverified")
        out.append({"criterion_id": cid, "text": c["text"], "evidence": c["evidence"], "status": status})
    return out


def claims(events: list[dict]) -> list[dict]:
    """D26: a claim is supported only if every listed criterion's latest decisive witness in the run passes.

    Evaluated over the whole run: the wrapper's tests run after the agent has spoken, so a claim is
    judged by what was witnessed by the end of the run, not at the moment it was made."""
    status = {a["criterion_id"]: a["status"] for a in acceptance(events)}  # #27.4: proposed never supports
    out = []
    for ev in events:
        if ev["type"] == "agent.claim":
            ids = ev["payload"].get("criterion_ids") or []
            ok = (ev["payload"].get("kind") == "completion" and bool(ids)
                  and all(status.get(c) == "met" for c in ids))
            out.append({"claim_id": ev["payload"].get("claim_id"), "text": ev["payload"].get("text", ""),
                        "criterion_ids": ids, "finding": "supported" if ok else "claim_unwitnessed"})
    return out


def build_manifest(events: list[dict], agent: dict[str, Any]) -> dict:
    """D28: call only after run.finished; ledger_last_hash = hash of run.finished."""
    if not events or events[-1]["type"] not in ("run.finished", "ledger.repaired"):
        raise ValueError("manifest requires a closed run (run.finished last)")
    fin = next((e for e in reversed(events) if e["type"] == "run.finished"), None)
    if fin is None:  # #27.5: repaired ledger without run.finished
        raise ValueError("manifest requires run.finished")
    arts = [
        {
            "artifact_id": e["payload"]["artifact_id"], "path": e["payload"]["path"], "sha256": e["payload"]["sha256"],
            "criterion_ids": e["payload"].get("criterion_ids", []), "kind": e["payload"].get("kind"),
            "provenance": e["payload"].get("provenance", "original"), "events": {"recorded": e["id"]},
        }
        for e in events if e["type"] == "artifact.recorded"
    ]
    return {"manifest_version": 1, "run_id": fin["run_id"], "ledger_last_hash": fin["hash"], "agent": agent,
            "artifacts": arts, "acceptance": acceptance(events)}


def check_manifest(manifest: dict, events: list[dict], blob_exists=None) -> list[str]:
    """Recompute and compare (D28). Returns a list of findings; empty = consistent."""
    errs = []
    try:
        expected = build_manifest(events, manifest.get("agent", {}))
    except ValueError as e:
        return [str(e)]
    if manifest.get("ledger_last_hash") != expected["ledger_last_hash"]:
        errs.append("ledger_last_hash does not match ledger (truncated or foreign ledger)")
    for key in ("run_id", "artifacts", "acceptance"):
        if manifest.get(key) != expected[key]:
            errs.append(f"{key} differs from ledger")
    started = next((e for e in events if e["type"] == "run.started"), None)
    mag = manifest.get("agent")
    if not isinstance(mag, dict):
        errs.append("manifest agent must be an object")
    elif started is not None and mag.get("name", "") != started["payload"].get("agent", ""):
        errs.append("agent differs from run.started")  # #27.5, empty names compared too
    if blob_exists is not None:
        errs += [f"blob missing: {a['sha256'][:12]}" for a in expected["artifacts"] if not blob_exists(a["sha256"])]
    return errs
