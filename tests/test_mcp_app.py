"""Official SDK acceptance: truthful widget parity, scope and loopback isolation."""

import json

import pytest

pytest.importorskip("mcp")
from starlette.testclient import TestClient

from truthlens.catalog import export_catalog, rebuild
from truthlens.mcp_app import WIDGET_MIME, WIDGET_URI, create_app_server


@pytest.fixture
def app_files(tmp_path):
    (tmp_path / "factory.json").write_text(
        json.dumps(
            {
                "runs": [
                    {
                        "id": "one",
                        "title": "Recorded run",
                        "verified": True,
                        "status": "APPROVED",
                        "artifacts": [
                            {
                                "id": "report",
                                "path": "report.md",
                                "kind": "markdown",
                                "content": "# Recorded report",
                            }
                        ],
                    },
                ]
            }
        )
    )
    config = tmp_path / "sources.json"
    config.write_text(
        json.dumps(
            {
                "projects": [{"id": "a", "name": "Alpha"}, {"id": "b", "name": "Beta"}],
                "sources": [
                    {"id": "s1", "kind": "factory", "path": "factory.json", "project_id": "a"},
                    {"id": "s2", "kind": "factory", "path": "factory.json", "project_id": "b"},
                ],
            }
        )
    )
    db = tmp_path / "catalog.sqlite"
    rebuild(config, db)
    widget = tmp_path / "widget.html"
    widget.write_text("<!doctype html><title>TruthLens</title>")
    widget.with_name("preview.html").write_text("<!doctype html><title>Local host</title>")
    return db, widget


def rpc(client, method, params=None):
    if method != "initialize" and "Mcp-Session-Id" not in client.headers:
        rpc(
            client,
            "initialize",
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "test", "version": "1"},
            },
        )
    response = client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}},
        headers={"Accept": "application/json, text/event-stream"},
    )
    assert response.status_code == 200, response.text
    if method == "initialize":
        client.headers["Mcp-Session-Id"] = response.headers["Mcp-Session-Id"]
        client.post(
            "/mcp",
            json={"jsonrpc": "2.0", "method": "notifications/initialized"},
            headers={"Accept": "application/json, text/event-stream"},
        )
    return response.json()["result"]


def test_sdk_initialize_scope_status_and_widget_contract(app_files):
    db, widget = app_files
    with pytest.raises(ValueError, match="Configured project"):
        create_app_server(db, {"missing"}, widget)
    server = create_app_server(db, {"a"}, widget, port=4177)
    with TestClient(server.streamable_http_app(), base_url="http://127.0.0.1:4177") as client:
        init = rpc(
            client,
            "initialize",
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "truthlens-test", "version": "1"},
            },
        )
        assert init["serverInfo"]["name"] == "TruthLens"
        tools = rpc(client, "tools/list")["tools"]
        assert len(tools) == 11
        for tool in tools:
            assert tool["annotations"]["readOnlyHint"] is True
            assert tool["annotations"]["openWorldHint"] is False
            assert tool["inputSchema"]["additionalProperties"] is False
            assert "outputSchema" in tool
            assert ("ui" in tool.get("_meta", {})) == (tool["name"] == "truthlens_render_workspace_v1")
        projects = rpc(client, "tools/call", {"name": "truthlens_list_projects_v1", "arguments": {}})
        assert projects["structuredContent"]["projects"] == [{"id": "a", "name": "Alpha"}]
        found = rpc(
            client, "tools/call", {"name": "truthlens_find_runs_v1", "arguments": {"project_id": "a"}}
        )
        data = found["structuredContent"]
        assert data["runs"][0]["verification"] == "UNKNOWN"
        assert data["runs"][0]["acceptance"] == "UNKNOWN"
        rid = data["runs"][0]["id"]
        detail = rpc(
            client,
            "tools/call",
            {
                "name": "truthlens_get_run_v1",
                "arguments": {
                    "project_id": "a",
                    "run_id": rid,
                },
            },
        )
        assert detail["structuredContent"]["run"] == export_catalog(db, project="a")["runs"][0]
        rendered = rpc(
            client,
            "tools/call",
            {
                "name": "truthlens_render_workspace_v1",
                "arguments": {
                    "project_id": "a",
                    "run_ids": [rid],
                    "expected_snapshot_id": data["snapshot_id"],
                },
            },
        )
        structured = rendered["structuredContent"]
        workspace = rendered["_meta"]["truthlens/workspace"]
        assert structured["summary"] == data["runs"]
        assert structured["schema_version"] == "truthlens.widget/1"
        assert workspace["runs"] == export_catalog(db, project="a")["runs"]
        assert len(workspace["projects"]) == 1 and workspace["projects"][0]["id"] == "a"
        assert {s["id"] for s in workspace["sources"]} == {"s1"}
        assert workspace["memory"] == [] and workspace["unassigned"] == []
        assert structured["selected_run_id"] == rid
        resource = rpc(client, "resources/read", {"uri": WIDGET_URI})["contents"][0]
        assert resource["mimeType"] == WIDGET_MIME
        assert resource["text"] == widget.read_text()
        assert resource["_meta"]["ui"]["csp"]["connectDomains"] == []

        foreign = export_catalog(db, project="b")["runs"][0]["id"]
        for name, arguments in [
            ("truthlens_find_runs_v1", {"project_id": "b"}),
            (
                "truthlens_render_workspace_v1",
                {"project_id": "a", "run_ids": [rid], "verification": "VERIFIED"},
            ),
            ("truthlens_get_run_v1", {"project_id": "a", "run_id": foreign}),
            ("truthlens_find_runs_v1", {"project_id": "a", "limit": 21}),
            ("truthlens_render_workspace_v1", {"project_id": "a", "run_ids": [foreign]}),
            (
                "truthlens_render_workspace_v1",
                {"project_id": "a", "run_ids": [rid], "expected_snapshot_id": "sha256:stale"},
            ),
        ]:
            result = rpc(client, "tools/call", {"name": name, "arguments": arguments})
            assert result["isError"] is True
            assert "truthlens/workspace" not in result.get("_meta", {})


def test_http_origin_host_and_sanitized_source_failure(app_files):
    db, widget = app_files
    with pytest.raises(ValueError, match="explicit"):
        create_app_server(db, set(), widget)
    with pytest.raises(ValueError, match="Configured project"):
        create_app_server(db, {"missing"}, widget)
    server = create_app_server(db, {"a"}, widget, port=4177)
    with TestClient(server.streamable_http_app(), base_url="http://127.0.0.1:4177") as client:
        assert client.get("/preview").status_code == 200
        for path in ("/preview", "/mcp"):
            assert client.get(path, headers={"Host": "evil.example"}).status_code == 421
            assert client.get(path, headers={"Origin": "https://evil.example"}).status_code == 403
        assert client.get("/catalog.sqlite").status_code == 404
        db.unlink()
        result = rpc(
            client, "tools/call", {"name": "truthlens_find_runs_v1", "arguments": {"project_id": "a"}}
        )
        assert result["isError"] is True
        assert "Workspace snapshot unavailable" in result["content"][0]["text"]
        assert str(db) not in json.dumps(result)


def test_workspace_tools_pagination_acl_and_negotiated_ui(app_files):
    db, widget = app_files
    server = create_app_server(db, {"a", "b"}, widget, port=4177)
    with TestClient(server.streamable_http_app(), base_url="http://127.0.0.1:4177") as client:

        def call(name, **arguments):
            return rpc(client, "tools/call", {"name": name, "arguments": arguments})

        first = call("truthlens_list_projects", page_size=1)["structuredContent"]
        assert first["items"][0]["id"] == "a" and first["next_cursor"]
        second = call("truthlens_list_projects", page_size=1, cursor=first["next_cursor"])[
            "structuredContent"
        ]
        assert second["items"][0]["id"] == "b" and second["next_cursor"] is None
        assert call("truthlens_list_projects", page_size=2, cursor=first["next_cursor"])["isError"]
        assert call("truthlens_list_runs", project_id="a", cursor=first["next_cursor"])["isError"]
        assert call("truthlens_list_projects", acceptance="APPROVED")["isError"]
        run = call("truthlens_list_runs", project_id="a")["structuredContent"]["items"][0]
        assert call("truthlens_get_run", project_id="b", run_id=run["id"])["isError"]
        composed = call("truthlens_compose_view", project_id="a", view="run-timeline", run_id=run["id"])
        assert composed["structuredContent"]["view"] == "run-timeline"
        assert composed["content"][0]["text"]
        assert {r["project_id"] for r in composed["_meta"]["truthlens/workspace"]["runs"]} == {"a"}
        assert call("truthlens_compose_view", project_id="a", view="artifact-viewer")["isError"]
        assert len(rpc(client, "resources/list")["resources"]) == 1
        # A distinct initialized SDK session advertises the official UI extension.
        client.headers.pop("Mcp-Session-Id")
        rpc(
            client,
            "initialize",
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {
                    "experimental": {"io.modelcontextprotocol/ui": {"mimeTypes": [WIDGET_MIME]}}
                },
                "clientInfo": {"name": "ui-test", "version": "1"},
            },
        )
        resources = rpc(client, "resources/list")["resources"]
        assert len(resources) == 5
        compose = next(t for t in rpc(client, "tools/list")["tools"] if t["name"] == "truthlens_compose_view")
        assert compose["_meta"]["ui"]["resourceUri"] == "ui://truthlens/workspace-overview"
        for resource in resources:
            content = rpc(client, "resources/read", {"uri": resource["uri"]})["contents"][0]
            assert content["mimeType"] == WIDGET_MIME


def test_artifact_envelope_and_widget_share_authoritative_content(app_files):
    db, widget = app_files
    server = create_app_server(db, {"a"}, widget, port=4177)
    with TestClient(server.streamable_http_app(), base_url="http://127.0.0.1:4177") as client:

        def call(name, **arguments):
            return rpc(client, "tools/call", {"name": name, "arguments": arguments})

        run = call("truthlens_list_runs", project_id="a")["structuredContent"]["items"][0]
        artifacts = call("truthlens_list_artifacts", project_id="a", run_id=run["id"])["structuredContent"]
        aid = artifacts["items"][0]["id"]
        viewed = call("truthlens_get_artifact_view", project_id="a", run_id=run["id"], artifact_id=aid)[
            "structuredContent"
        ]
        assert viewed["payload"] == "# Recorded report"
        assert viewed["envelope"]["trust"]["verification"] == "UNKNOWN"
        assert viewed["envelope"]["payload_ref"] == aid
        composed = call(
            "truthlens_compose_view",
            project_id="a",
            run_id=run["id"],
            artifact_id=aid,
            view="artifact-viewer",
            expected_snapshot_id=artifacts["snapshot_id"],
        )
        assert composed["structuredContent"]["envelope"] == viewed["envelope"]
        assert (
            composed["_meta"]["truthlens/workspace"]["runs"][0]["artifacts"][0]["content"]
            == viewed["payload"]
        )
        for extra in ({"payload_ref": "/etc/passwd"}, {"renderer": "script"}):
            assert call(
                "truthlens_get_artifact_view", project_id="a", run_id=run["id"], artifact_id=aid, **extra
            )["isError"]
        search = call("truthlens_search", project_id="a", query="Recorded report", kinds=["artifact"])[
            "structuredContent"
        ]
        assert search["items"][0]["id"] == aid
        assert search["items"][0]["source_id"] == "s1"


def test_corrupt_artifact_composition_is_diagnostic_only(app_files, monkeypatch):
    db, widget = app_files
    original_export = export_catalog

    def corrupt_export(*args, **kwargs):
        doc = original_export(*args, **kwargs)
        for run in doc["runs"]:
            run["integrity"] = "failed"
        return doc

    monkeypatch.setattr("truthlens.mcp_app.export_catalog", corrupt_export)
    server = create_app_server(db, {"a"}, widget, port=4177)
    run = original_export(db, project="a")["runs"][0]
    with TestClient(server.streamable_http_app(), base_url="http://127.0.0.1:4177") as client:
        args = {"project_id": "a", "run_id": run["id"], "artifact_id": run["artifacts"][0]["id"]}
        viewed = rpc(client, "tools/call", {"name": "truthlens_get_artifact_view", "arguments": args})
        assert viewed["structuredContent"]["payload"] is None
        assert viewed["structuredContent"]["envelope"]["data_status"] == "isolated"
        composed = rpc(
            client,
            "tools/call",
            {"name": "truthlens_compose_view", "arguments": {**args, "view": "artifact-viewer"}},
        )
        assert composed["structuredContent"]["view"] == "evidence-inspector"
        assert composed["structuredContent"]["envelope"] is None
        assert composed["structuredContent"]["selected_artifact_id"] is None
        assert composed["structuredContent"]["summary"][0]["integrity"] == "failed"
        assert composed["_meta"]["truthlens/workspace"]["runs"][0]["artifacts"] == []
