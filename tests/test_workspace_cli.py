"""CLI/export identity parity and read-only scope acceptance."""

import json

from truthlens.cli import main


def test_workspace_flow_and_legacy_parser(tmp_path, capsys):
    source = tmp_path / "report.json"
    source.write_text(json.dumps({"runs": [{"id": "job-1", "title": "Recorded update"}]}))
    config = tmp_path / "sources.json"
    config.write_text(json.dumps({"projects": [{"id": "project", "name": "Project"}], "sources": [
        {"id": "factory", "kind": "factory", "path": "report.json", "project_id": "project"}]}))
    db = str(tmp_path / "catalog.db")
    before = source.read_bytes()
    assert main(["catalog", "rebuild", "--config", str(config), "--db", db]) == 0
    capsys.readouterr()
    assert main(["catalog", "export", "--db", db, "--project", "project"]) == 0
    export = json.loads(capsys.readouterr().out)
    rid = export["runs"][0]["id"]
    original_db = (tmp_path / "catalog.db").read_bytes()
    assert main(["catalog", "export", "--db", db, "-o", db]) == 2
    assert (tmp_path / "catalog.db").read_bytes() == original_db
    assert main(["catalog", "export", "--db", db, "-o", str(config)]) == 2
    capsys.readouterr()
    assert main(["search", "Recorded", "--db", db, "--project", "project", "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["items"][0]["id"] == rid
    assert main(["show", "run", rid, "--db", db, "--project", "project", "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["item"]["id"] == rid
    assert main(["ask", "show evidence", "--db", db, "--project", "project", "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["client_acknowledged"] is False
    assert main(["show", "run", rid, "--db", db, "--project", "project",
                 "--allow-project", "foreign", "--json"]) == 2
    capsys.readouterr()
    assert main(["navigator", "approve", "--db", db, "--project", "project"]) == 2
    capsys.readouterr()
    assert source.read_bytes() == before
    assert main(["verify", str(tmp_path / "absent-ledger")]) == 1
