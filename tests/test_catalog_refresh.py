"""D52/D55: a running scoped reader observes rebuilt sources without stale data."""

import http.client
import json
import threading

from truthlens.catalog import rebuild, search
from truthlens.workspace_server import create_server


def test_running_reader_refresh_replaces_deleted_records_and_keeps_project_ceiling(tmp_path):
    source = tmp_path / "source.json"
    source.write_text(json.dumps({
        "runs": [{"id": "kept", "title": "Before refresh"}, {"id": "removed", "title": "Obsolete run"}],
        "memory": [{"id": "removed", "text": "Obsolete memory"}],
    }))
    config = tmp_path / "sources.json"
    settings = {
        "projects": [{"id": "a"}, {"id": "b"}],
        "sources": [
            {"id": "visible", "kind": "factory", "path": "source.json", "project_id": "a"},
            {"id": "foreign", "kind": "factory", "path": "source.json", "project_id": "b"},
        ],
    }
    config.write_text(json.dumps(settings))
    db = tmp_path / "catalog.sqlite"
    rebuild(config, db)
    static = tmp_path / "dist"
    static.mkdir()
    (static / "index.html").write_text("<h1>Reader</h1>")
    server = create_server(str(db), str(static), {"a"}, port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    def reload():
        connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
        try:
            connection.request("GET", "/workspace.json")
            response = connection.getresponse()
            assert response.status == 200
            assert response.getheader("Cache-Control") == "no-store"
            document = json.loads(response.read())
            assert [project["id"] for project in document["projects"]] == ["a"]
            assert all(item["project_id"] == "a" for field in ("runs", "memory") for item in document[field])
            assert all(item["id"] == "visible" for item in document["sources"])
            return document
        finally:
            connection.close()

    try:
        before = reload()
        kept_id = before["runs"][0]["id"]
        assert len(before["runs"]) == 2 and len(before["memory"]) == 1
        source.write_text(json.dumps({
            "runs": [{"id": "kept", "title": "After refresh"}],
            "memory": [{"id": "new", "text": "Replacement memory"}],
        }))
        # Source edits alone cannot change a recorded snapshot.
        assert reload()["runs"] == before["runs"]
        rebuild(config, db)
        after = reload()
        assert [(run["id"], run["title"]) for run in after["runs"]] == [(kept_id, "After refresh")]
        assert [item["text"] for item in after["memory"]] == ["Replacement memory"]
        assert search(db, "Obsolete", allowed_projects={"a"}) == []

        source.write_text("invalid JSON")
        rebuild(config, db)
        failed = reload()
        assert failed["memory"] == []
        assert len(failed["runs"]) == 1 and failed["runs"][0]["verification"] == "FAILED"
        assert failed["runs"][0]["errors"] == ["source unavailable or invalid"]
        assert search(db, "Replacement", allowed_projects={"a"}) == []

        source.write_text(json.dumps({"runs": [{"id": "recovered", "title": "Recovered source"}]}))
        rebuild(config, db)
        assert [run["title"] for run in reload()["runs"]] == ["Recovered source"]
        settings["sources"] = [settings["sources"][1]]  # Drop the permitted source; keep foreign data.
        config.write_text(json.dumps(settings))
        rebuild(config, db)
        empty = reload()
        assert empty["runs"] == empty["memory"] == empty["sources"] == []
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
