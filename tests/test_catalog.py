"""Workspace acceptance: isolation, provenance, rebuild and source identities."""

import json

import pytest

from truthlens.catalog import export_catalog, get_run, rebuild, search


def test_catalog_scope_receipts_memory_and_atomic_rebuild(tmp_path):
    source = tmp_path / "factory.json"
    source.write_text(
        json.dumps(
            {
                "runs": [{"id": "same", "title": "Alpha", "verified": True, "status": "APPROVED"}],
                "memory": [
                    {"id": "m1", "text": "alpha recollection"},
                    {"id": "m2", "text": "revision", "revision_of": "m1"},
                ],
            }
        )
    )
    original = source.read_bytes()
    config = tmp_path / "sources.json"
    settings = {
        "projects": [{"id": "a", "name": "Alpha"}, {"id": "b", "name": "Beta"}],
        "workspaces": [
            {"id": "w1", "project_id": "a", "root": "/one"},
            {"id": "w2", "project_id": "a", "root": "/two"},
        ],
        "sources": [
            {"id": "s1", "kind": "factory", "path": "factory.json", "project_id": "a"},
            {"id": "s2", "kind": "factory", "path": "factory.json", "project_id": "b"},
        ],
        "overrides": [
            {
                "source_id": "s1",
                "source_run_id": "same",
                "project_id": "a",
                "workspace_id": "w2",
                "reason": "owner selected worktree",
            }
        ],
    }
    config.write_text(json.dumps(settings))
    db = tmp_path / "catalog.db"
    rebuild(config, db)
    doc = export_catalog(db)
    assert len(doc["runs"]) == 2
    first, second = doc["runs"]
    assert first["id"] != second["id"]
    assert first["origin"] == "IMPORTED" and first["verification"] == "UNKNOWN"
    assert first["acceptance"] == "UNKNOWN" and first["workspace_id"] == "w2"
    assert get_run(db, second["id"], allowed_projects=["a"]) is None
    assert len(search(db, "alpha", project="a")) == 2
    scoped = export_catalog(db, allowed_projects=["a"])
    assert len(scoped["memory"]) == 2 and scoped["memory"][1]["revision_of"] == scoped["memory"][0]["id"]
    assert {s["id"] for s in scoped["sources"]} == {"s1"}
    assert export_catalog(db, allowed_projects=[])["runs"] == []
    rebuild(config, db)
    assert export_catalog(db)["runs"][0]["id"] == first["id"]
    assert source.read_bytes() == original
    old = db.read_bytes()
    source.write_text("broken")
    rebuild(config, db)
    assert export_catalog(db)["runs"][0]["errors"]
    old = db.read_bytes()
    config.write_text("broken")
    with pytest.raises(ValueError):
        rebuild(config, db)
    assert db.read_bytes() == old


def test_unassigned_and_otel_stay_imported(tmp_path):
    (tmp_path / "otel.json").write_text(
        json.dumps(
            {
                "resourceSpans": [
                    {
                        "scopeSpans": [
                            {
                                "spans": [
                                    {
                                        "traceId": "trace",
                                        "spanId": "span",
                                        "name": "compile",
                                        "status": {"code": 1},
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        )
    )
    config = tmp_path / "sources.json"
    config.write_text(json.dumps({"sources": [{"id": "o", "kind": "otel", "path": "otel.json"}]}))
    db = tmp_path / "index.db"
    rebuild(config, db)
    doc = export_catalog(db)
    assert doc["unassigned"] == [doc["runs"][0]["id"]]
    assert doc["runs"][0]["verification"] == "UNKNOWN"
    assert export_catalog(db, allowed_projects=[])["sources"] == []


def test_recorded_worktree_mapping_ambiguity_and_forks():
    from truthlens.mapping import assign

    config = {
        "projects": [{"id": "a"}, {"id": "b"}],
        "workspaces": [
            {
                "id": "one",
                "project_id": "a",
                "root": "/tree/one",
                "repo_remote": "git@github.com:owner/repo.git",
                "branch": "main",
            },
            {
                "id": "two",
                "project_id": "a",
                "root": "/tree/two",
                "repo_remote": "https://github.com/owner/repo",
                "branch": "work",
            },
            {
                "id": "fork",
                "project_id": "b",
                "root": "/tree/one",
                "repo_remote": "https://github.com/fork/repo",
            },
        ],
    }
    metadata = {"root": "/tree/two", "repo_remote": "https://github.com/owner/repo.git", "branch": "work"}
    assert assign(config, {"id": "s"}, "r", metadata)["workspace_id"] == "two"
    metadata["root"] = "/unknown"
    assert assign(config, {"id": "s"}, "r", metadata)["project_id"] is None
    metadata.update(root="/tree/one", repo_remote="https://github.com/fork/repo", branch="")
    assert assign(config, {"id": "s"}, "r", metadata)["project_id"] == "b"
    config["workspaces"].append({**config["workspaces"][-1], "id": "duplicate"})
    ambiguous = assign(config, {"id": "s"}, "r", metadata)
    assert ambiguous["project_id"] is None and len(ambiguous["mapping_candidates"]) == 2


def test_adapter_validation_isolation_and_github_snapshot(tmp_path):
    github = tmp_path / "github.json"
    github.write_text(
        json.dumps(
            {
                "schema_version": "truthlens.github-snapshot/1",
                "issues": [
                    {"id": 92, "title": "Reported completion", "state": "closed", "body": "source report"}
                ],
            }
        )
    )
    bad = tmp_path / "bad.json"
    config = tmp_path / "sources.json"
    settings = {
        "projects": [{"id": "a"}],
        "sources": [
            {"id": "g", "kind": "github", "path": "github.json", "project_id": "a"},
            {"id": "f", "kind": "factory", "path": "bad.json", "project_id": "a"},
        ],
    }
    config.write_text(json.dumps(settings))
    db = tmp_path / "index.db"
    invalid_snapshots = [
        {"schema_version": "future/99", "runs": []},
        {"runs": [{"id": "r", "artifacts": [{"id": "same"}, {"id": "same"}]}]},
        {"memory": [{"id": "same"}, {"id": "same"}]},
        {"runs": [{"id": {"bad": "type"}}]},
    ]
    for snapshot in invalid_snapshots:
        bad.write_text(json.dumps(snapshot))
        rebuild(config, db)
        runs = export_catalog(db)["runs"]
        assert runs[0]["origin"] == "IMPORTED" and runs[0]["verification"] == "UNKNOWN"
        assert runs[1]["verification"] == "FAILED" and runs[1]["errors"]
    bad.write_text("[" * 1100 + "]" * 1100)
    rebuild(config, db)
    runs = export_catalog(db)["runs"]
    assert runs[0]["verification"] == "UNKNOWN"
    assert runs[1]["verification"] == "FAILED" and runs[1]["errors"]
    # Wrong runtime types in global configuration fail before replacing generation.
    before = db.read_bytes()
    settings["projects"][0]["name"] = {"invalid": True}
    config.write_text(json.dumps(settings))
    with pytest.raises(ValueError):
        rebuild(config, db)
    assert db.read_bytes() == before
