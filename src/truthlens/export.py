"""Viewer export: one JSON document for the web viewer, built only from a verified run (fail-closed upstream).

Card colours follow DESIGN.md v2: green=met, yellow=claimed only, red=unmet, gray=unverified, outline=proposed.
"""

from __future__ import annotations

from truthlens.manifest import acceptance, claims

PLAIN = {
    "met": "Proven – witnessed evidence passed.",
    "unmet": "Failed – the witnessed check did not pass.",
    "proposed": "Waiting for your confirmation.",
}


def _summary(e: dict) -> str:
    p, t = e["payload"], e["type"]
    if t == "test.reported":
        return f"Tests run by TruthLens: {p.get('passed', 0)} passed, {p.get('failed', 0)} failed, {p.get('skipped', 0)} skipped"
    if t == "agent.claim":
        return f"Agent said: {p.get('text', '')}"
    if t == "evidence.attached" and p.get("refers_to") == "git_diff_after":
        return f"Files changed: {', '.join(p.get('changed', [])) or 'none'}"
    if t == "evidence.attached" and p.get("kind") == "command_run":
        return f"Agent process finished (exit {p.get('exit_code')})"
    if t == "artifact.recorded":
        return f"File recorded: {p.get('path')}"
    if t == "run.finished":
        return f"Run closed (exit {p.get('exit_code')})"
    if t == "criterion.recorded":
        return f"Criterion {p.get('criterion_id')}: {p.get('text')}"
    return t


def build(events: list[dict], manifest: dict) -> dict:
    acc, cl = acceptance(events), claims(events)
    claimed = {c for x in cl for c in x["criterion_ids"]}
    cards = []
    for a in acc:
        st, is_claimed = a["status"], a["criterion_id"] in claimed
        if st == "met":
            card, plain = "green", PLAIN["met"]
        elif st == "unmet":
            card, plain = "red", PLAIN["unmet"]
        elif st == "proposed":
            card, plain = "outline", PLAIN["proposed"]
        elif is_claimed:
            card, plain = "yellow", "Claimed only – nothing checked this yet."
        else:
            card, plain = "gray", "Not checked yet."
        cards.append({**a, "claimed": is_claimed, "card": card, "plain": plain})
    start = events[0]
    fin = next((e for e in reversed(events) if e["type"] == "run.finished"), None)
    req = next((e["payload"]["text"] for e in events if e["type"] == "requirement.recorded"), "")
    return {
        "verified": True,
        "run": {"run_id": start["run_id"], "project": req, "agent": manifest.get("agent", {}).get("name", ""),
                "command": start["payload"].get("command", ""), "started": start["ts"],
                "finished": fin["ts"] if fin else None, "exit_code": fin["payload"].get("exit_code") if fin else None,
                "ledger_last_hash": manifest.get("ledger_last_hash"), "events": len(events)},
        "counts": {k: sum(1 for c in cards if c["card"] == k) for k in ("green", "yellow", "red", "gray", "outline")},
        "criteria": cards,
        "claims": cl,
        "artifacts": manifest.get("artifacts", []),
        "events": [{"seq": e["seq"], "id": e["id"], "ts": e["ts"], "type": e["type"], "actor": e["actor"],
                    "summary": _summary(e), "hash": e["hash"], "payload": e["payload"]} for e in events],
    }
