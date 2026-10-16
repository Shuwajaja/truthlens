"""GitHub JSON export adapter; statuses are reports, never native attestations."""

from __future__ import annotations

from truthlens.read_model import array, identifier, text


def read(document: dict) -> list[dict]:
    runs = []
    for kind in ("issues", "pulls", "commits"):
        for item in array(document.get(kind, []), 10000):
            if not isinstance(item, dict):
                raise ValueError("invalid GitHub item")  # noqa: TRY004
            local = item.get("id", item.get("sha", item.get("number")))
            if type(local) is int:
                local = str(local)
            local = identifier(local)
            url = text(item.get("html_url"), limit=4096)
            runs.append(
                {
                    "run_id": kind + ":" + local,
                    "title": text(item.get("title")) or text(item.get("commit", {}).get("message")) or local,
                    "summary": text(item.get("body")),
                    "status": text(item.get("state")),
                    "started": text(item.get("created_at")),
                    "events": [
                        {
                            "id": "github:" + local,
                            "type": "github." + kind,
                            "summary": text(item.get("title")) or local,
                            "payload": {"url": url, "reported_state": text(item.get("state"))},
                        }
                    ],
                }
            )
    return runs
