"""Shared literal search text for CLI, Navigator and exported browser snapshots."""

from __future__ import annotations


def searchable_text(item: dict) -> str:
    values = [item.get(k, "") for k in ("title", "agent", "reported_summary", "text", "source_ref")]
    for event in item.get("events", []):
        values.append(event.get("summary", ""))
    for artifact in item.get("artifacts", []):
        values.extend(artifact.get(k, "") for k in ("path", "content"))
    return "\n".join(v for v in values if isinstance(v, str)).casefold()


def matches(item: dict, query: str) -> bool:
    return query.strip().casefold() in searchable_text(item)
