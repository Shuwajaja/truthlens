"""Versioned presentation models; never infer human acceptance from imports."""

from __future__ import annotations

import hashlib
import json

from truthlens.redaction import redact


def qualified(source_id: str, local_id: str) -> str:
    return "tl_" + hashlib.sha256(json.dumps([source_id, local_id]).encode()).hexdigest()[:32]


def text(value, default: str = "", limit: int = 65536) -> str:
    return value[:limit] if isinstance(value, str) else default


def identifier(value) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= 512 or any(ord(c) < 32 for c in value):
        raise ValueError("invalid bounded identifier")
    return value


def array(value, limit: int) -> list:
    if not isinstance(value, list) or len(value) > limit:
        raise ValueError("invalid bounded array")
    return value


def run_model(source: dict, raw: dict, local_id: str, native: bool = False) -> dict:
    identifier(local_id)
    integrity = raw.get("integrity", "unknown") if native else "unknown"
    detail = raw.get("run", {})
    if not isinstance(detail, dict):
        raise ValueError("invalid run details")  # noqa: TRY004
    run_id = qualified(source["id"], local_id)
    artifacts, artifact_ids = [], set()
    blobs = raw.get("blobs", {}) if native else {}
    for index, artifact in enumerate(array(raw.get("artifacts", []), 1000)):
        if not isinstance(artifact, dict):
            raise ValueError("invalid artifact")  # noqa: TRY004
        local_artifact = identifier(artifact.get("artifact_id", artifact.get("id", str(index))))
        artifact_id = qualified(run_id, local_artifact)
        if artifact_id in artifact_ids:
            raise ValueError("duplicate artifact identity")
        artifact_ids.add(artifact_id)
        sha = text(artifact.get("sha256"), limit=64)
        item = {
            "id": artifact_id,
            "path": text(artifact.get("path"), limit=4096),
            "kind": text(artifact.get("kind"), "text", 128) or "text",
        }
        if item["kind"] in ("file", "text"):
            suffix = item["path"].lower().rsplit(".", 1)[-1]
            item["kind"] = {
                "md": "markdown",
                "markdown": "markdown",
                "diff": "diff",
                "patch": "diff",
                "json": "json",
                "html": "html",
                "htm": "html",
                "csv": "table",
            }.get(suffix, item["kind"])
        if len(sha) == 64 and all(c in "0123456789abcdef" for c in sha):
            item["sha256"] = sha
        content = blobs.get(sha) if native else artifact.get("content")
        if isinstance(content, str):
            item["content"] = content[:262144]
        elif isinstance(content, (dict, list)):
            encoded = json.dumps(content, ensure_ascii=False)
            if len(encoded.encode()) <= 262144:
                item["content"] = content
        artifacts.append(item)
    events = []
    for index, event in enumerate(array(raw.get("events", []), 10000)):
        if not isinstance(event, dict):
            raise ValueError("invalid event")  # noqa: TRY004
        actor = event.get("actor", {})
        if not isinstance(actor, dict):
            actor = {}
        events.append(
            {
                "id": identifier(event.get("id", str(index))),
                "seq": event.get("seq") if type(event.get("seq")) is int else index + 1,
                "type": text(event.get("type"), "import.event", 256),
                "ts": text(event.get("ts"), limit=128),
                "summary": text(event.get("summary")),
                "actor": {
                    "id": text(actor.get("id"), "imported", 512),
                    "kind": text(actor.get("kind"), "agent", 64),
                },
                "payload": event.get("payload") if isinstance(event.get("payload"), dict) else {},
            }
        )
        # Evidence blobs are not necessarily manifest artifacts. Expose recorded
        # diffs and command output without inventing a new source artifact event.
        payload = event.get("payload", {})
        if native and isinstance(payload, dict) and event.get("type") == "evidence.attached":
            sha = payload.get("sha256")
            if sha in blobs and isinstance(blobs[sha], str):
                evidence_id = qualified(run_id, "evidence:" + str(event.get("id", index)))
                if evidence_id not in artifact_ids:
                    ref = text(payload.get("refers_to"), "recorded-evidence", 256)
                    is_diff = ref == "git_diff_after"
                    artifacts.append({"id": evidence_id, "path": ref + (".diff" if is_diff else ".txt"),
                                      "kind": "diff" if is_diff else "text", "sha256": sha,
                                      "content": blobs[sha][:262144], "evidence_ref": event.get("id"),
                                      "provenance": "recorded evidence blob"})
                    artifact_ids.add(evidence_id)
    errors = array(raw.get("errors", []), 100)
    if any(not isinstance(error, str) for error in errors):
        raise ValueError("invalid errors")
    criteria = raw.get("criteria", []) if native and integrity != "failed" else []
    statuses = [criterion.get("status") for criterion in criteria]
    verification = "UNKNOWN"
    if any(status == "unmet" for status in statuses):
        verification = "FAILED"
    elif statuses and all(status == "met" for status in statuses) and integrity == "hmac":
        verification = "VERIFIED"
    if errors:
        verification = "FAILED"
    return redact(
        {
            "id": run_id,
            "source_id": source["id"],
            "source_run_id": local_id,
            "title": text(raw.get("title")) or text(detail.get("project")) or local_id,
            "agent": text(raw.get("agent")) or text(detail.get("agent")),
            "started": text(raw.get("started")) or text(detail.get("started")) or None,
            "origin": "NATIVE" if native else "IMPORTED",
            "integrity": integrity,
            "verification": verification,
            "assessment_origin": "witnessed"
            if native and integrity == "hmac"
            else "hash-only"
            if native and integrity == "hash-only"
            else "source_reported"
            if not native
            else "unknown",
            "integrity_method": integrity,
            "review": "REQUIRED",
            "acceptance": "UNKNOWN",
            "errors": errors,
            "criteria": criteria,
            "claims": raw.get("claims", []) if native and integrity != "failed" else [],
            "events": events if integrity != "failed" else [],
            "artifacts": artifacts if integrity != "failed" else [],
            "reported_status": text(raw.get("status")),
            "reported_summary": text(raw.get("summary")),
        }
    )
