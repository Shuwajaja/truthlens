"""Viewer export with checked hash-chain integrity and optional HMAC verification.

Card colours follow DESIGN.md v2: green=met, yellow=claimed only, red=unmet, gray=unverified, outline=proposed.
"""

from __future__ import annotations

from truthlens.canonical import CanonicalError, canonical_bytes
from truthlens.ledger import verify_bytes
from truthlens.manifest import acceptance, check_manifest, claims

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


BLOB_MAX, BLOBS_TOTAL = 256 * 1024, 4 * 1024 * 1024


def blob_texts(events: list[dict], read_blob) -> dict[str, str]:
    """sha256 -> text for evidence/artifact blobs referenced by events (drawer diff/markdown views).
    Only blobs whose content hashes to their name, UTF-8 text, size-capped; redacted again on the way out."""
    import hashlib

    from truthlens.redaction import redact_str
    out: dict[str, str] = {}
    total = 0
    for e in events:
        sha = e["payload"].get("sha256")
        if not isinstance(sha, str) or sha in out:
            continue
        data = read_blob(sha)
        if data is None or len(data) > BLOB_MAX or total + len(data) > BLOBS_TOTAL:
            continue
        if hashlib.sha256(data).hexdigest() != sha:
            continue
        try:
            out[sha] = redact_str(data.decode("utf-8"))
        except UnicodeDecodeError:
            continue
        total += len(data)
    return out


def build(events: list[dict], manifest: dict, read_blob=None, *, hmac_key: bytes | None = None) -> dict:
    """Check event hashes, the manifest and, when supplied, HMAC before labelling an export.

    CLI/MCP additionally verify the original ledger bytes and stored blobs before calling this.
    Supplying a key alone never establishes verification: every event's HMAC must match.
    """
    try:
        result = verify_bytes(b"".join(canonical_bytes(e) + b"\n" for e in events), hmac_key)
    except CanonicalError as e:
        errors = [f"not canonical: {e}"]
    else:
        errors = [f"line {n}: {message}" for n, message in result.errors]
        if not errors:
            errors = check_manifest(manifest, events)
    if errors:
        return {"verified": False, "integrity": "failed", "errors": errors}
    verified = hmac_key is not None
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
    # A recorded claim need not assert completion; never invent a quotation.
    headline = (["Your agent made recorded claims.", "Here's what's actually proven."] if cl
                else ["Here's what this run actually proves."])
    return {
        "verified": verified,
        "integrity": "hmac" if verified else "hash-only",
        "headline": headline,
        "review_required": True,  # D7: human/domain acceptance is never automatic; shown by default
        "trust": (["integrity_verified"] if verified else []) + ["review_required"],
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
        **({"blobs": blob_texts(events, read_blob)} if read_blob else {}),
    }
