"""Project-scoped read-only memory models, redacted before persistence/indexing."""

from __future__ import annotations

from truthlens.read_model import array, identifier, qualified, text
from truthlens.redaction import redact


def records(source: dict, document: dict, project_id: str | None) -> list[dict]:
    out, seen = [], set()
    for index, item in enumerate(array(document.get("memory", document.get("records", [])), 10000)):
        if not isinstance(item, dict):
            raise ValueError("invalid memory record")  # noqa: TRY004
        local = identifier(item.get("id", str(index)))
        if local in seen:
            raise ValueError("duplicate memory identity")
        seen.add(local)
        if item.get("access_policy", "project") not in ("project", "public"):
            continue
        if item.get("project_scope", project_id) != project_id:
            continue
        refs = {}
        for field in ("claim_refs", "retrieval_refs"):
            refs[field] = [
                qualified(source["id"], identifier(ref)) for ref in array(item.get(field, []), 1000)
            ]
        out.append(
            redact(
                {
                    "id": qualified(source["id"], "memory:" + local),
                    "project_id": project_id,
                    "source_id": source["id"],
                    "source_ref": text(item.get("source_ref"), local, 4096),
                    "text": text(item.get("text")),
                    "schema_version": "truthlens.memory/1",
                    "captured_at": text(item.get("captured_at")) or None,
                    "valid_from": text(item.get("valid_from")) or None,
                    "valid_to": text(item.get("valid_to")) or None,
                    "revision_of": qualified(source["id"], "memory:" + identifier(item["revision_of"]))
                    if item.get("revision_of")
                    else None,
                    **refs,
                    "access_policy": item.get("access_policy", "project"),
                }
            )
        )
    visible = {item["id"] for item in out}
    for item in out:
        if item["revision_of"] not in visible:
            item["revision_of"] = None
    return out
