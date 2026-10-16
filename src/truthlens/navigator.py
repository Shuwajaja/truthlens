"""Bounded, project-scoped read-only navigation over an exported workspace.

This module never starts agents, opens files, invokes a shell or grants approval.
Search is deterministic; source content is data, never an instruction.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime

from truthlens.searching import matches

READ_TOOLS = frozenset({
    "list_projects", "list_workspaces", "find_runs", "get_run", "get_run_events",
    "get_artifacts", "get_evidence", "search_memory", "search_all",
    "get_project_activity", "get_renderer_options", "compose_view",
})
RENDERERS = {
    "plain": {"text", "plain", "unknown", "code"}, "markdown": {"markdown", "md"},
    "diff": {"diff", "patch"}, "json": {"json"}, "table": {"table", "csv"},
    "chart": {"chart"}, "timeline": {"timeline"}, "graph": {"graph"},
    "media": {"image", "audio", "video", "media", "pdf"}, "html": {"html"},
}
ACTIONS = frozenset({
    "navigate", "open_run", "open_artifact", "select_renderer", "set_filters",
    "set_layout", "focus_evidence",
})
VIEWS = frozenset({"overview", "runs", "results", "activity", "knowledge", "evidence", "sources"})


def _page(items: list, offset: int = 0, limit: int = 50) -> dict:
    if type(offset) is not int or offset < 0 or type(limit) is not int or not 1 <= limit <= 100:
        raise ValueError("offset must be nonnegative and limit 1..100")
    end = offset + limit
    return {"items": items[offset:end], "total": len(items),
            "next_offset": end if end < len(items) else None}


class Navigator:
    """An immutable local view whose authorization ceiling is set by its caller.

    For shared hosting the caller must derive allowed_projects from authenticated
    server-side policy, never from an untrusted tool argument.
    """

    def __init__(self, document: dict, allowed_projects: set[str] | None = None):
        self.doc = json.loads(json.dumps(document))
        known = {p["id"] for p in self.doc.get("projects", [])}
        self.allowed = known if allowed_projects is None else known & allowed_projects

    def _project(self, project: str | None) -> str:
        if project not in self.allowed:
            raise ValueError("project unavailable or access denied")
        return project

    def _items(self, collection: str, project: str) -> list[dict]:
        return [x for x in self.doc.get(collection, []) if x.get("project_id") == project]

    def _run(self, rid: str, project: str) -> dict:
        item = next((x for x in self._items("runs", project) if x["id"] == rid), None)
        if item is None:
            raise ValueError("run unavailable or access denied")
        return item

    def call(self, name: str, *, project: str | None = None, query: str = "",
             run_id: str = "", offset: int = 0, limit: int = 50, **args) -> dict:
        if name not in READ_TOOLS:
            raise ValueError("read-only tool unavailable")
        if not isinstance(query, str) or len(query) > 2048:
            raise ValueError("query must be at most 2048 characters")
        if name == "list_projects":
            return _page([x for x in self.doc.get("projects", []) if x["id"] in self.allowed], offset, limit)
        project = self._project(project)
        if name == "list_workspaces":
            return _page(self._items("workspaces", project), offset, limit)
        if name in {"find_runs", "search_memory", "search_all"}:
            collections = (["runs"] if name == "find_runs" else ["memory"] if name == "search_memory"
                           else ["runs", "memory"])
            found = []
            for collection in collections:
                for item in self._items(collection, project):
                    if matches(item, query):
                        found.append({"kind": "run" if collection == "runs" else "memory", **item})
            return _page(found, offset, limit)
        if name == "get_run":
            return {"item": self._run(run_id, project)}
        if name in {"get_run_events", "get_artifacts", "get_evidence"}:
            run = self._run(run_id, project)
            key = "events" if name != "get_artifacts" else "artifacts"
            items = run.get(key, [])
            if name == "get_evidence":
                items = [e for e in items if e.get("type") in {"evidence.attached", "test.reported"}]
            return _page(items, offset, limit)
        if name == "get_project_activity":
            items = [{**e, "run_id": r["id"]} for r in self._items("runs", project)
                     for e in r.get("events", [])]
            return _page(sorted(items, key=lambda e: e.get("ts", ""), reverse=True), offset, limit)
        if name == "get_renderer_options":
            artifact = None
            if run_id:
                run = self._run(run_id, project)
                artifact = next((a for a in run.get("artifacts", [])
                                 if a["id"] == args.get("artifact_id")), None)
                if artifact is None or run.get("integrity") == "failed":
                    raise ValueError("artifact unavailable or access denied")
            return _page([{"id": rid, "version": 1, "accepts": sorted(types)}
                          for rid, types in RENDERERS.items()
                          if artifact is None or rid == "plain" or
                          (artifact.get("content") is not None and artifact.get("kind") in types)], offset, limit)
        action = args.get("action")
        if action is None:
            run = self._run(run_id, project) if run_id else None
            runs = [run] if run else self._items("runs", project)
            panels = []
            for item in runs:
                if item.get("integrity") == "failed":
                    continue
                for artifact in item.get("artifacts", [])[:100]:
                    renderer = next((rid for rid, types in RENDERERS.items()
                                     if artifact.get("kind") in types), "plain")
                    if artifact.get("content") is None:
                        renderer = "plain"
                    panels.append({"run_id": item["id"], "artifact_id": artifact["id"], "renderer": renderer})
            return {"layout": {"schema_version": "truthlens.layout/1", "project_id": project,
                               "panels": panels[:100]}, "executed": False}
        return {"proposal": self.validate_action(action, project), "executed": False}

    def validate_action(self, action: object, project: str) -> dict:
        project = self._project(project)
        if not isinstance(action, dict) or action.get("type") not in ACTIONS:
            raise ValueError("unsupported presentation action")
        allowed_fields = {"type", "project_id", "run_id", "artifact_id", "renderer", "view", "filters",
                          "layout", "evidence_id"}
        if set(action) - allowed_fields or action.get("project_id") != project:
            raise ValueError("invalid action fields or project scope")
        kind = action["type"]
        if kind == "navigate" and action.get("view") not in VIEWS:
            raise ValueError("unknown view")
        if kind in {"open_run", "open_artifact", "select_renderer", "focus_evidence"}:
            run = self._run(action.get("run_id", ""), project)
            if run.get("integrity") == "failed":
                raise ValueError("failed integrity: content isolated")
            if kind in {"open_artifact", "select_renderer"}:
                artifact = next((a for a in run.get("artifacts", [])
                                 if a.get("id") == action.get("artifact_id")), None)
                if artifact is None:
                    raise ValueError("artifact unavailable or access denied")
                if kind == "select_renderer":
                    renderer = action.get("renderer")
                    if renderer not in RENDERERS or (renderer != "plain" and
                            (artifact.get("content") is None or artifact.get("kind") not in RENDERERS[renderer])):
                        raise ValueError("renderer does not accept artifact")
            if kind == "focus_evidence" and not any(
                    e.get("id") == action.get("evidence_id") and
                    e.get("type") in {"evidence.attached", "test.reported"} for e in run.get("events", [])):
                raise ValueError("evidence unavailable or access denied")
        if kind == "set_filters":
            filters = action.get("filters")
            if not isinstance(filters, dict) or set(filters) - {"query", "origin", "verification"}:
                raise ValueError("unsupported filter")
            if any(not isinstance(v, str) or len(v) > 2048 for v in filters.values()):
                raise ValueError("invalid filter value")
            if filters.get("origin", "") not in {"", "NATIVE", "IMPORTED"} or \
                    filters.get("verification", "") not in {"", "VERIFIED", "FAILED", "UNKNOWN"}:
                raise ValueError("invalid filter enum")
        if kind == "set_layout":
            layout = action.get("layout")
            if not isinstance(layout, dict) or set(layout) - {"density", "collection", "pane_order"}:
                raise ValueError("unsupported layout")
            if layout.get("density", "comfortable") not in {"comfortable", "compact"}:
                raise ValueError("unsupported density")
            if layout.get("collection", "list") not in {"list", "cards"}:
                raise ValueError("unsupported collection")
            order = layout.get("pane_order", ["runs", "results", "knowledge"])
            if not isinstance(order, list) or sorted(order) != ["knowledge", "results", "runs"]:
                raise ValueError("invalid pane order")
        return json.loads(json.dumps(action))

    def ask(self, question: str, project: str, *, limit: int = 20) -> dict:
        """Literal source-grounded search, with a few transparent navigation commands.

        This deliberately does not claim general natural-language reasoning.
        """
        project = self._project(project)
        if not isinstance(question, str) or not question.strip() or len(question) > 2048:
            raise ValueError("question must be 1..2048 characters")
        q = question.strip().casefold()
        view = None
        for target, words in {"knowledge": ("wissen", "memory", "knowledge"),
                              "evidence": ("nachweise", "evidence"),
                              "activity": ("ablauf", "timeline", "aktivität", "activity"),
                              "results": ("ergebnisse", "artifacts", "results")}.items():
            if q in words or any(q == prefix + word for prefix in ("zeige ", "show ", "öffne ") for word in words):
                view = target
        actions = []
        if view:
            actions.append(self.validate_action({"type": "navigate", "project_id": project, "view": view}, project))
            result = {"items": [], "total": 0, "next_offset": None}
            message = "Navigation proposed; no client has confirmed opening a view."
        elif q in {"nur fehler", "zeige nur die fehler", "show errors", "errors"}:
            actions.append(self.validate_action({"type": "set_filters", "project_id": project,
                                                  "filters": {"verification": "FAILED"}}, project))
            result = _page([r for r in self._items("runs", project) if r.get("verification") == "FAILED"], 0, limit)
            message = "Recorded failures; filter proposal awaits a client."
        else:
            result = self.call("search_all", project=project, query=question, limit=limit)
            message = "Matching recorded sources." if result["total"] else "Not found / not recorded."
        return {"message": message, "search_mode": "literal", "project_id": project,
                "results": result, "actions": actions, "client_acknowledged": False,
                "generated_at": datetime.now(UTC).isoformat()}
