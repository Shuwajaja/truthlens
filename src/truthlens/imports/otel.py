"""OTLP JSON resourceSpans snapshot adapter (no network or runtime capture)."""

from __future__ import annotations


def read(document: dict) -> list[dict]:
    traces: dict[str, dict] = {}
    for resource in document.get("resourceSpans", []):
        for scope in resource.get("scopeSpans", []):
            for span in scope.get("spans", []):
                trace = str(span.get("traceId", ""))
                if not trace:
                    raise ValueError("OTel span missing traceId")
                run = traces.setdefault(
                    trace, {"run_id": trace, "title": span.get("name", trace), "events": []}
                )
                run["events"].append(
                    {
                        "id": str(span.get("spanId", "")),
                        "type": "otel.span",
                        "summary": span.get("name", ""),
                        "payload": span,
                    }
                )
                if len(run["events"]) > 10000:
                    raise ValueError("too many spans")
    return list(traces.values())
