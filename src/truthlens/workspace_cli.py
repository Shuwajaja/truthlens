"""Additive local workspace commands; legacy commands keep their original parser."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

COMMANDS = frozenset({"catalog", "projects", "search", "show", "ask", "navigator", "serve"})


def _write(doc: object, dest: str) -> None:
    text = json.dumps(doc, ensure_ascii=False, indent=2) + "\n"
    if dest == "-":
        print(text, end="")
        return
    target = Path(dest)
    if target.is_symlink():
        raise ValueError("export target must not be a symlink")
    if target.exists():
        # Export is an output operation, not a way to replace source packages,
        # configuration, SQLite, or unrelated user documents.
        if target.stat().st_size > 64 * 1024 * 1024:
            raise ValueError("existing export target too large")
        try:
            existing = json.loads(target.read_text())
        except (ValueError, UnicodeError):
            raise ValueError("refusing to replace a non-workspace file") from None
        if not isinstance(existing, dict) or existing.get("schema_version") != "truthlens.workspace/1":
            raise ValueError("refusing to replace source or unrelated data")
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=target.parent, prefix=".workspace-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(name, target)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def main(argv: list[str]) -> int:
    from truthlens import catalog
    from truthlens.navigator import Navigator

    parser = argparse.ArgumentParser(prog="truthlens")
    subs = parser.add_subparsers(dest="command", required=True)
    p = subs.add_parser("catalog", help="build/export the local rebuildable workspace catalog")
    actions = p.add_subparsers(dest="operation", required=True)
    rebuild = actions.add_parser("rebuild")
    rebuild.add_argument("--config", required=True)
    rebuild.add_argument("--db", required=True)
    rebuild.add_argument("--hmac-key-env", help="optional key variable, never written to the catalog")
    export = actions.add_parser("export")
    export.add_argument("--db", required=True)
    export.add_argument("--project")
    export.add_argument("--allow-project", action="append")
    export.add_argument("-o", "--output", default="-")
    server = subs.add_parser("serve", help="optional loopback-only reader and Codex Navigator")
    server.add_argument("--db", required=True)
    server.add_argument("--static", required=True, help="built viewer/dist directory")
    server.add_argument("--project", action="append", required=True, help="explicit project read ceiling")
    server.add_argument("--port", type=int, default=4174)
    for command in ("projects", "search", "show", "ask", "navigator"):
        p = subs.add_parser(command)
        p.add_argument("--db", required=True)
        p.add_argument("--allow-project", action="append", help="local authorization ceiling; repeatable")
        p.add_argument("--json", action="store_true")
        if command != "projects":
            p.add_argument("--project", required=True)
        if command in {"search", "ask"}:
            p.add_argument("query")
            p.add_argument("--limit", type=int, default=20)
            p.add_argument("--offset", type=int, default=0)
        if command == "ask":
            p.add_argument("--provider", choices=("local", "codex"), default="local")
            p.add_argument("--model", help="optional Codex CLI model; default uses CLI selection")
        if command == "show":
            p.add_argument("kind", choices=("run", "artifact", "memory"))
            p.add_argument("id")
        if command == "navigator":
            p.add_argument("tool", help="one of the read-only Navigator tools")
            p.add_argument("--args", default="{}", help="bounded JSON tool arguments")
    a = parser.parse_args(argv)
    try:
        if a.command == "serve":
            from truthlens.workspace_server import serve
            if not 0 <= a.port <= 65535:
                raise ValueError("invalid port")
            serve(a.db, a.static, set(a.project), a.port)
            return 0
        if a.command == "catalog" and a.operation == "rebuild":
            key = None
            if a.hmac_key_env:
                value = os.environ.get(a.hmac_key_env)
                if not value:
                    raise ValueError("configured key environment variable is unset or empty")
                key = value.encode()
            _write(catalog.rebuild(a.config, a.db, key=key), "-")
            return 0
        allowed = set(a.allow_project) if a.allow_project is not None else None
        if a.command == "catalog":
            if a.output != "-" and Path(a.output).resolve() == Path(a.db).resolve():
                raise ValueError("export must not overwrite its catalog")
            _write(catalog.export_catalog(a.db, project=a.project, allowed_projects=allowed), a.output)
            return 0
        document = catalog.export_catalog(a.db, allowed_projects=allowed)
        nav = Navigator(document, allowed_projects=allowed)
        if a.command == "projects":
            result = nav.call("list_projects", limit=100)
        elif a.command == "search":
            result = nav.call("search_all", project=a.project, query=a.query, limit=a.limit, offset=a.offset)
        elif a.command == "ask":
            if a.provider == "codex":
                from truthlens.codex_navigator import ask_codex
                result = ask_codex(document, a.query, a.project, model=a.model)
            else:
                result = nav.ask(a.query, a.project, limit=a.limit)
        elif a.command == "navigator":
            if len(a.args) > 16384:
                raise ValueError("tool arguments exceed 16 KiB")
            args = json.loads(a.args)
            if not isinstance(args, dict) or set(args) & {"project", "project_id"}:
                raise ValueError("tool arguments must be an object; project comes from --project")
            result = nav.call(a.tool, project=a.project, **args)
        elif a.kind == "run":
            result = nav.call("get_run", project=a.project, run_id=a.id)
        else:
            nav._project(a.project)
            collection = document.get("memory", []) if a.kind == "memory" else [
                {**artifact, "project_id": r["project_id"], "run_id": r["id"]}
                for r in document.get("runs", []) if r.get("integrity") != "failed"
                for artifact in r.get("artifacts", [])]
            result = {"item": next((x for x in collection if x.get("id") == a.id and
                                    x.get("project_id") == a.project), None)}
            if result["item"] is None:
                raise ValueError("object unavailable or access denied")
        if a.json:
            _write(result, "-")
        else:
            _print_readable(result)
        return 0
    except (ValueError, OSError, KeyError, TypeError, sqlite3.Error) as exc:
        # Do not echo source text, credential values or raw paths in diagnostics.
        print(f"workspace error ({type(exc).__name__}): request invalid or source/catalog unavailable; "
              "check schema, project scope and catalog build diagnostics", file=sys.stderr)
        return 2


def _print_readable(result: dict) -> None:
    if "message" in result:
        print(result["message"])
        print(f"Search mode: {result.get('search_mode', 'literal')}. UI actions are proposals; no view was opened.")
        if "results" not in result:
            for rid in result.get("source_ids", []):
                print(f"Source: {rid}")
            return
        result = result["results"]
    if "items" in result:
        print(f"{len(result['items'])} of {result['total']} shown")
        for item in result["items"]:
            print(f"{item.get('id', '')}  {item.get('title', item.get('name', item.get('text', '')))}")
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
