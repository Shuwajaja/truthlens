"""Rebuildable atomic SQLite workspace catalog, separate from source configuration."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from truthlens import mapping, memory
from truthlens.imports import factory, github, otel
from truthlens.read_model import array, identifier, run_model
from truthlens.read_service import read_bytes, read_native
from truthlens.redaction import redact
from truthlens.searching import matches, searchable_text

SCHEMA = "truthlens.workspace/1"


def load_config(path: str | Path) -> dict:
    path = Path(path).absolute()
    config = json.loads(read_bytes(path, path.parent))
    if not isinstance(config, dict):
        raise ValueError("config must be an object")  # noqa: TRY004
    if config.get("schema_version", "truthlens.sources/1") != "truthlens.sources/1":
        raise ValueError("unsupported source config schema")
    for field in ("projects", "sources", "workspaces"):
        values = config.setdefault(field, [])
        if not isinstance(values, list) or any(
            not isinstance(v, dict) or not isinstance(v.get("id"), str) or not v["id"] for v in values
        ):
            raise ValueError(f"invalid {field}")
        if len({v["id"] for v in values}) != len(values):
            raise ValueError(f"duplicate {field} id")
    for field in ("projects", "sources", "workspaces"):
        for item in config[field]:
            identifier(item["id"])
            if "name" in item and (not isinstance(item["name"], str) or len(item["name"]) > 1024):
                raise ValueError("invalid display name")
            if field != "sources":
                item.setdefault("name", item["id"])
    if len(config["sources"]) > 100:
        raise ValueError("too many sources")
    projects = {p["id"] for p in config["projects"]}
    for workspace in config["workspaces"]:
        identifier(workspace.get("project_id"))
        for field in ("root", "repo_remote", "branch", "commit", "task_ref"):
            if field in workspace and (not isinstance(workspace[field], str) or len(workspace[field]) > 4096):
                raise ValueError("invalid workspace metadata")
        if workspace.get("root"):
            workspace["root"] = str((path.parent / workspace["root"]).absolute())
        if workspace.get("project_id") not in projects:
            raise ValueError("workspace missing valid project")
    for source in config["sources"]:
        if source.get("kind") not in ("native", "factory", "otel", "memory", "github"):
            raise ValueError("unsupported source kind")
        if not isinstance(source.get("path"), str) or not 1 <= len(source["path"]) <= 4096:
            raise ValueError("invalid source path")
        for field in ("project_id", "workspace_id"):
            if field in source:
                identifier(source[field])
        source["path"] = str((path.parent / source["path"]).absolute())
        mapping.assign(config, source, "")
    for override in array(config.get("overrides", []), 10000):
        if not isinstance(override, dict):
            raise ValueError("invalid override")  # noqa: TRY004
        for field in ("source_id", "source_run_id", "project_id"):
            identifier(override.get(field))
        if "workspace_id" in override:
            identifier(override["workspace_id"])
        if not isinstance(override.get("reason"), str) or not 1 <= len(override["reason"]) <= 4096:
            raise ValueError("invalid override reason")
        source = next((s for s in config["sources"] if s["id"] == override.get("source_id")), None)
        if source is None:
            raise ValueError("override references unknown source")
        mapping.assign(config, source, override.get("source_run_id", ""))
    return config


def rebuild(config_path: str | Path, db_path: str | Path, key: bytes | None = None) -> dict:
    config = load_config(config_path)
    target = Path(db_path).absolute()
    if target == Path(config_path).absolute():
        raise ValueError("catalog must not overwrite source config")
    for source in config["sources"]:
        source_path = Path(source["path"]).resolve()
        if target.resolve() == source_path or source_path in target.resolve().parents:
            raise ValueError("catalog must not be placed within a source")
    document = {
        "schema_version": SCHEMA,
        "generated_at": datetime.now(UTC).isoformat(),
        "projects": redact(config["projects"]),
        "workspaces": redact(config["workspaces"]),
        "runs": [],
        "memory": [],
        "sources": [],
        "unassigned": [],
    }
    identities: set[str] = set()
    for source in config["sources"]:
        checkpoint = {field: len(document[field]) for field in ("runs", "memory", "sources", "unassigned")}
        try:
            path = Path(source["path"])
            if path.is_symlink():
                raise ValueError("symlink source rejected")
            receipt = {
                "id": source["id"],
                "kind": source["kind"],
                "name": source.get("name", source["id"]),
                "adapter_version": "1",
                "read_only": True,
                "captured_at": document["generated_at"],
                "provenance": "local snapshot import",
            }
            if source["kind"] == "native":
                roots = (
                    [path]
                    if (path / "manifest.json").exists()
                    else sorted(p.parent for p in path.glob("*/manifest.json"))
                )
                if not roots:
                    raise ValueError("no native runs at source")
                if len(roots) > 10000:
                    raise ValueError("too many runs")
                raw_runs = []
                for root in roots:
                    if root.is_symlink():
                        raise ValueError("symlink run rejected")
                    raw = read_native(root, key)
                    local = str(raw.get("run", {}).get("run_id") or root.name)
                    raw_runs.append((local, raw))
            else:
                data = read_bytes(path, path.parent)
                receipt["snapshot_sha256"] = hashlib.sha256(data).hexdigest()
                raw_document = json.loads(data)
                if not isinstance(raw_document, dict):
                    raise ValueError("snapshot must be object")
                schema = raw_document.get("schema_version")
                schemas = {
                    "factory": "truthlens.factory-snapshot/1",
                    "memory": "truthlens.memory-snapshot/1",
                    "otel": "truthlens.otel-snapshot/1",
                    "github": "truthlens.github-snapshot/1",
                }
                if schema is not None and schema != schemas[source["kind"]]:
                    raise ValueError("unsupported snapshot schema")
                adapter = {"otel": otel, "github": github}.get(source["kind"], factory)
                raw_runs = [
                    (identifier(raw.get("run_id") or raw.get("id") or str(index)), raw)
                    for index, raw in enumerate(adapter.read(raw_document))
                ]
                scope = mapping.assign(config, source, "")["project_id"]
                document["memory"].extend(memory.records(source, raw_document, scope))
            for local, raw in raw_runs:
                run = run_model(source, raw, local, source["kind"] == "native")
                if run["id"] in identities:
                    raise ValueError("duplicate source run identity")
                identities.add(run["id"])
                run.update(mapping.assign(config, source, local, raw.get("workspace", raw)))
                document["runs"].append(run)
                if run["project_id"] is None:
                    document["unassigned"].append(run["id"])
            document["sources"].append(redact(receipt))
        except (OSError, ValueError, TypeError, KeyError, AttributeError, RecursionError):
            for field, length in checkpoint.items():
                del document[field][length:]
            failure = run_model(
                source,
                {"integrity": "failed", "errors": ["source unavailable or invalid"]},
                "source-error",
                source["kind"] == "native",
            )
            failure["errors"] = ["source unavailable or invalid"]
            failure["verification"] = "FAILED"
            failure.update(mapping.assign(config, source, "source-error"))
            document["runs"].append(failure)
            document["sources"].append(
                {
                    "id": source["id"],
                    "kind": source["kind"],
                    "name": source.get("name", source["id"]),
                    "errors": ["source unavailable or invalid"],
                }
            )
            if failure["project_id"] is None:
                document["unassigned"].append(failure["id"])
    document = redact(document)
    # Preserve structured artifacts through recursive redaction, serialize only
    # after the last redaction pass so JSON tokens cannot become invalid text.
    for run in document["runs"]:
        for artifact in run.get("artifacts", []):
            if isinstance(artifact.get("content"), (dict, list)):
                encoded = json.dumps(artifact["content"], ensure_ascii=False, allow_nan=False)
                if len(encoded.encode()) > 262144:
                    raise ValueError("structured artifact exceeds size limit after redaction")
                artifact["content"] = encoded
    for collection in ("runs", "memory"):
        for item in document[collection]:
            item["search_text"] = searchable_text(item)
    serialized = json.dumps(document)
    if len(serialized.encode()) > 64 * 1024 * 1024:
        raise ValueError("catalog exceeds total size limit")
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix=".catalog-", dir=target.parent)
    os.close(fd)
    try:
        with sqlite3.connect(temp) as connection:
            connection.execute("CREATE TABLE snapshot (document TEXT NOT NULL)")
            connection.execute("INSERT INTO snapshot VALUES (?)", (serialized,))
            connection.execute(
                "CREATE VIRTUAL TABLE search_index USING fts5(id UNINDEXED, project UNINDEXED, kind UNINDEXED, text)"
            )
            for kind in ("runs", "memory"):
                for item in document[kind]:
                    text = item["search_text"]
                    connection.execute(
                        "INSERT INTO search_index VALUES (?,?,?,?)",
                        (item["id"], item["project_id"], kind, text),
                    )
        with open(temp, "rb") as stream:
            os.fsync(stream.fileno())
        os.replace(temp, target)
        directory = os.open(target.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)
    return {
        "schema_version": SCHEMA,
        "runs": len(document["runs"]),
        "memory": len(document["memory"]),
        "projects": len(document["projects"]),
        "unassigned": len(document["unassigned"]),
    }


def export_catalog(
    db_path: str | Path, project: str | None = None, allowed_projects: list[str] | set[str] | None = None
) -> dict:
    with sqlite3.connect(Path(db_path).resolve().as_uri() + "?mode=ro", uri=True) as connection:
        row = connection.execute("SELECT document FROM snapshot").fetchone()
    if row is None:
        raise ValueError("empty catalog")
    doc = json.loads(row[0])
    if doc.get("schema_version") != SCHEMA:
        raise ValueError("unsupported catalog schema")
    allowed = set(allowed_projects) if allowed_projects is not None else {p["id"] for p in doc["projects"]}
    if project is not None:
        allowed &= {project}
    unrestricted = allowed_projects is None and project is None
    for field in ("projects", "workspaces", "runs", "memory"):
        doc[field] = [
            item
            for item in doc[field]
            if (item["id"] if field == "projects" else item.get("project_id")) in allowed
            or (unrestricted and field in ("runs", "memory") and item.get("project_id") is None)
        ]
    ids = {r["id"] for r in doc["runs"]}
    doc["unassigned"] = [rid for rid in doc["unassigned"] if rid in ids]
    source_ids = {r["source_id"] for r in doc["runs"]} | {m["source_id"] for m in doc["memory"]}
    doc["sources"] = [source for source in doc["sources"] if source["id"] in source_ids]
    return doc


def list_projects(db_path: str | Path, allowed_projects=None) -> list[dict]:
    return export_catalog(db_path, allowed_projects=allowed_projects)["projects"]


def get_run(db_path: str | Path, run_id: str, project=None, allowed_projects=None) -> dict | None:
    return next(
        (r for r in export_catalog(db_path, project, allowed_projects)["runs"] if r["id"] == run_id), None
    )


def search(
    db_path: str | Path, query: str, project=None, allowed_projects=None, limit: int = 50, offset: int = 0
) -> list[dict]:
    if not isinstance(query, str) or len(query) > 1024:
        raise ValueError("invalid query")
    if not 1 <= limit <= 100 or offset < 0:
        raise ValueError("invalid pagination")
    if not query.strip():
        return []
    doc = export_catalog(db_path, project, allowed_projects)
    visible = {item["id"]: item for kind in ("runs", "memory") for item in doc[kind]}
    # Quote input as literal FTS text: operators are not executable query syntax.
    literal = '"' + query.replace('"', '""') + '"'
    with sqlite3.connect(Path(db_path).resolve().as_uri() + "?mode=ro", uri=True) as connection:
        rows = connection.execute(
            "SELECT id,kind FROM search_index WHERE search_index MATCH ? ORDER BY rank", (literal,)
        ).fetchall()
    rank = {rid: index for index, (rid, _kind) in enumerate(rows)}
    kinds = {item["id"]: kind for kind in ("runs", "memory") for item in doc[kind]}
    # Substring semantics also support partial words/punctuation absent from FTS
    # tokenization. FTS supplies relevance order, never a wider project scope.
    results = [{"kind": kinds[rid], **item} for rid, item in visible.items() if matches(item, query)]
    results.sort(key=lambda item: (rank.get(item["id"], len(rank)), item["id"]))
    return results[offset : offset + limit]
