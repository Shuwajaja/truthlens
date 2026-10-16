"""Loopback HTTP boundary acceptance; no live model calls in tests."""

import http.client
import json
import threading

from truthlens.catalog import rebuild
from truthlens.workspace_server import create_server


def test_local_reader_origin_project_and_session_boundaries(tmp_path, monkeypatch):
    (tmp_path / "factory.json").write_text(json.dumps({"runs": [{"id": "one", "title": "Local report"}]}))
    config = tmp_path / "sources.json"
    config.write_text(json.dumps({"projects": [{"id": "a", "name": "A"}, {"id": "b", "name": "B"}],
                                 "sources": [{"id": "s", "kind": "factory", "path": "factory.json", "project_id": "a"}]}))
    db = tmp_path / "catalog.db"
    rebuild(config, db)
    static = tmp_path / "dist"
    static.mkdir()
    (static / "index.html").write_text("<h1>Local reader</h1>")
    (static / "workspace.json").write_text('{"private":"foreign-project-snapshot"}')
    server = create_server(str(db), str(static), {"a"}, port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    def request(method, path, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        status, data = response.status, response.read()
        connection.close()
        return status, json.loads(data)

    try:
        status, doc = request("GET", "/workspace.json")
        assert status == 200 and [p["id"] for p in doc["projects"]] == ["a"]
        assert request("GET", "/api/session", headers={"Origin": "https://foreign.example"})[0] == 403
        assert request("GET", "/api/session", headers={"Host": "foreign.example"})[0] == 403
        assert request("GET", "/assets/../../sources.json")[0] == 404
        assert request("GET", "/assets/..%2Fworkspace.json")[0] == 404
        assert request("GET", "/sources.json")[0] == 404
        assert request("POST", "/api/navigator", "{}", {"Content-Type": "application/json"})[0] == 403
        token = request("GET", "/api/session")[1]["token"]
        headers = {"Content-Type": "application/json", "X-TruthLens-Token": token}
        assert request("POST", "/api/navigator", json.dumps({"question": "x", "project_id": "b"}), headers)[0] == 400
        observed = []

        def presentation(document, question, project, **_kwargs):
            observed.append((document, question, project))
            return {"message": "Recorded source", "source_ids": [], "actions": []}

        monkeypatch.setattr("truthlens.workspace_server.ask_codex", presentation)
        assert request("POST", "/api/navigator", json.dumps({"question": "x", "project_id": "a"}), headers)[0] == 200
        assert observed[0][2] == "a" and len(observed[0][0]["projects"]) == 1
        assert request("POST", "/api/navigator/cancel", "{}", headers)[1]["cancel_requested"] is True
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
