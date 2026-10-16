"""Scoped read-only workspace tools shared by official SDK transports."""

import hashlib
import secrets
from collections import OrderedDict
from collections.abc import Callable
from typing import Annotated, Literal

from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations
from pydantic import Field

from truthlens.render_envelope import ClosedModel, RenderEnvelope, artifact_view
from truthlens.searching import matches

Identifier = Annotated[str, Field(min_length=1, max_length=400, strict=True)]
PageSize = Annotated[int, Field(ge=1, le=50, strict=True)]
Cursor = Annotated[str | None, Field(max_length=100)]
View = Literal["workspace-overview", "artifact-viewer", "evidence-inspector", "run-timeline"]
UI_URIS = tuple("ui://truthlens/" + name for name in View.__args__)


class Page(ClosedModel):
    schema_version: Literal["truthlens.mcp/1"] = "truthlens.mcp/1"
    snapshot_id: str
    project_id: str | None = None
    items: list[dict]
    total: int
    next_cursor: str | None = None


class ArtifactView(ClosedModel):
    schema_version: Literal["truthlens.artifact-view/1"] = "truthlens.artifact-view/1"
    snapshot_id: str
    envelope: RenderEnvelope
    payload: str | None


def isolated(run: dict) -> dict:
    if run.get("integrity") != "failed":
        return run
    return {**run, **{key: [] for key in ("events", "artifacts", "claims", "criteria")}}


def register_workspace_tools(
    server: FastMCP, snapshot: Callable, result: Callable, widget_model: type, summary: Callable
) -> None:
    readonly = ToolAnnotations(
        readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False
    )
    cursors: OrderedDict[str, tuple[str, int]] = OrderedDict()

    def page(
        items: list[dict], sid: str, query: tuple, size: int, cursor: str | None, project: str | None = None
    ):
        fingerprint = hashlib.sha256(repr((sid, query, size)).encode()).hexdigest()
        offset = 0
        if cursor is not None:
            record = cursors.get(cursor)
            if record is None or record[0] != fingerprint:
                raise ValueError("Cursor invalid or snapshot changed; restart pagination.")
            offset = record[1]
        next_cursor = None
        if offset + size < len(items):
            next_cursor = secrets.token_urlsafe(24)
            cursors[next_cursor] = (fingerprint, offset + size)
            if len(cursors) > 1024:
                cursors.popitem(last=False)
        return result(
            Page(
                snapshot_id=sid,
                project_id=project,
                items=items[offset : offset + size],
                total=len(items),
                next_cursor=next_cursor,
            )
        )

    def get_run(doc: dict, run_id: str) -> dict:
        run = next((r for r in doc["runs"] if r["id"] == run_id), None)
        if run is None:
            raise ValueError("Run unavailable or access denied.")
        return run

    @server.tool(annotations=readonly)
    def truthlens_list_projects(page_size: PageSize = 20, cursor: Cursor = None) -> Page:
        """List only owner-authorized projects; cursors are snapshot and query bound."""
        doc, sid = snapshot()
        return page(
            sorted([{"id": p["id"], "name": p["name"]} for p in doc["projects"]], key=lambda p: p["id"]),
            sid,
            ("projects",),
            page_size,
            cursor,
        )

    @server.tool(annotations=readonly)
    def truthlens_list_runs(
        project_id: Identifier,
        workspace_id: Identifier | None = None,
        query: Annotated[str, Field(max_length=1024)] = "",
        page_size: PageSize = 20,
        cursor: Cursor = None,
    ) -> Page:
        """List recorded run summaries with independent trust axes; query is literal text."""
        doc, sid = snapshot(project_id)
        runs = sorted(
            [
                r
                for r in doc["runs"]
                if (workspace_id is None or r.get("workspace_id") == workspace_id) and matches(r, query)
            ],
            key=lambda r: r["id"],
        )
        return page(
            [summary(r) for r in runs],
            sid,
            ("runs", project_id, workspace_id, query),
            page_size,
            cursor,
            project_id,
        )

    @server.tool(annotations=readonly)
    def truthlens_get_run(project_id: Identifier, run_id: Identifier) -> Page:
        """Read a scoped run, recorded events and criteria; corrupt content is isolated."""
        doc, sid = snapshot(project_id)
        return result(
            Page(snapshot_id=sid, project_id=project_id, items=[isolated(get_run(doc, run_id))], total=1)
        )

    @server.tool(annotations=readonly)
    def truthlens_list_artifacts(
        project_id: Identifier, run_id: Identifier, page_size: PageSize = 20, cursor: Cursor = None
    ) -> Page:
        """List canonical artifact references and safe renderer choices without payloads."""
        doc, sid = snapshot(project_id)
        run = get_run(doc, run_id)
        items = []
        for artifact in sorted(run["artifacts"], key=lambda a: a["id"]):
            envelope, _ = artifact_view(run, artifact["id"])
            items.append(
                {
                    "id": artifact["id"],
                    "path": artifact.get("path", ""),
                    "envelope": envelope.model_dump(mode="json"),
                }
            )
        return page(items, sid, ("artifacts", project_id, run_id), page_size, cursor, project_id)

    @server.tool(annotations=readonly)
    def truthlens_get_artifact_view(
        project_id: Identifier,
        run_id: Identifier,
        artifact_id: Identifier,
        renderer: Annotated[str | None, Field(max_length=100)] = None,
    ) -> ArtifactView:
        """Read an authoritative render envelope and bounded payload. No HTML template is required."""
        doc, sid = snapshot(project_id)
        envelope, payload = artifact_view(get_run(doc, run_id), artifact_id, renderer)
        return result(ArtifactView(snapshot_id=sid, envelope=envelope, payload=payload))

    @server.tool(annotations=readonly)
    def truthlens_search(
        project_id: Identifier,
        query: Annotated[str, Field(min_length=1, max_length=1024)],
        kinds: Annotated[list[Literal["run", "artifact", "memory"]], Field(max_length=3)] | None = None,
        page_size: PageSize = 20,
        cursor: Cursor = None,
    ) -> Page:
        """Literal scoped search with recorded references; source text is untrusted data."""
        doc, sid = snapshot(project_id)
        wanted = sorted(set(kinds or ["run", "artifact", "memory"]))
        items = []
        for raw in doc["runs"]:
            run = isolated(raw)
            if "run" in wanted and matches(run, query):
                items.append({"kind": "run", **summary(run), "source_id": run["source_id"]})
            if "artifact" in wanted:
                for a in run["artifacts"]:
                    text = a.get("path", "") + "\n" + a.get("content", "")
                    if query.casefold() in text.casefold():
                        items.append(
                            {
                                "kind": "artifact",
                                "id": a["id"],
                                "run_id": run["id"],
                                "source_id": run["source_id"],
                                "title": a.get("path", ""),
                            }
                        )
        if "memory" in wanted:
            for item in doc["memory"]:
                if matches(item, query):
                    items.append({"kind": "memory", **item})
        items.sort(key=lambda item: (item["kind"], item["id"]))
        return page(items, sid, ("search", project_id, query, tuple(wanted)), page_size, cursor, project_id)

    @server.tool(annotations=readonly, meta={"ui": {"resourceUri": UI_URIS[0]}})
    def truthlens_compose_view(
        project_id: Identifier,
        view: View = "workspace-overview",
        run_id: Identifier | None = None,
        artifact_id: Identifier | None = None,
        expected_snapshot_id: Annotated[str | None, Field(max_length=80)] = None,
    ) -> widget_model:
        """Compose a read-only authoritative presentation. Without UI support returns usable JSON/text."""
        doc, sid = snapshot(project_id)
        if expected_snapshot_id is not None and expected_snapshot_id != sid:
            raise ValueError("Snapshot changed; read the selection again.")
        if (artifact_id is not None and run_id is None) or (
            view == "artifact-viewer" and artifact_id is None
        ):
            raise ValueError("Artifact views require a canonical run and artifact selection.")
        runs = [get_run(doc, run_id)] if run_id else sorted(doc["runs"], key=lambda r: r["id"])[:10]
        envelope = None
        if artifact_id is not None:
            envelope, _ = artifact_view(runs[0], artifact_id)
            if runs[0].get("integrity") == "failed":
                # Keep diagnostics readable without carrying corrupt evidence into
                # the widget snapshot or selecting an artifact that was isolated.
                envelope, artifact_id, view = None, None, "evidence-inspector"
        doc = {**doc, "runs": [isolated(r) for r in runs], "memory": [], "unassigned": []}
        sources = {r["source_id"] for r in runs}
        doc["sources"] = [s for s in doc["sources"] if s["id"] in sources]
        return result(
            widget_model(
                project_id=project_id,
                snapshot_id=sid,
                selected_run_id=runs[0]["id"] if runs else None,
                selected_artifact_id=artifact_id,
                view=view,
                envelope=envelope,
                summary=[summary(r) for r in runs],
                generated_at=doc["generated_at"],
            ),
            doc,
        )
