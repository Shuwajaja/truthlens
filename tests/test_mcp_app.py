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
                    {"id": "one", "title": "Recorded run", "verified": True, "status": "APPROVED"},
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
    response = client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}},
        headers={"Accept": "application/json, text/event-stream"},
    )
    assert response.status_code == 200, response.text
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
        assert len(tools) == 4
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
