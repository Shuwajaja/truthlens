"""Read-only MCP server over stdio (JSON-RPC 2.0, newline-delimited), no dependencies.

`truthlens mcp --root DIR` exposes verified run dirs below DIR. Every tool verifies the run first
(fail-closed) and never writes. Tools: list_runs, run_report, run_events.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROTOCOL = "2025-06-18"
TOOLS = [
    {"name": "list_runs", "description": "List run directories (with manifest.json) under the root.",
     "inputSchema": {"type": "object", "properties": {}}},
    {"name": "run_report", "description": "Verify a run and return criteria status, claims vs witnessed and counts.",
     "inputSchema": {"type": "object", "properties": {"run": {"type": "string"}}, "required": ["run"]}},
    {"name": "run_events", "description": "Verify a run and return its timeline (seq, ts, type, actor, summary).",
     "inputSchema": {"type": "object", "properties": {"run": {"type": "string"}}, "required": ["run"]}},
]


class Server:
    def __init__(self, root: str, hmac_key: bytes | None = None):
        self.root = Path(root).resolve()
        self.key = hmac_key

    def _run_dir(self, name: str) -> Path:
        d = (self.root / name).resolve()
        if d != self.root and self.root not in d.parents:
            raise ValueError("run outside root")
        if not (d / "manifest.json").is_file():
            raise ValueError("not a run dir")
        return d

    def _doc(self, name: str) -> dict:
        from truthlens import export
        from truthlens.cli import _verified_dir
        d = self._run_dir(name)
        events, errs = _verified_dir(str(d), self.key)
        if events is None:
            return {"verified": False, "errors": errs}
        doc = export.build(events, json.loads((d / "manifest.json").read_text()))
        if self.key is None and any("hmac" in e for e in events):
            # round-5 finding e: without the key HMACs are not checked; a rewritten ledger would still pass
            doc["verified"] = doc["integrity"] = "hash-only, unsigned"
        return doc

    def call(self, name: str, args: dict) -> dict:
        if name == "list_runs":
            return {"runs": sorted(str(p.parent.relative_to(self.root)) for p in self.root.rglob("manifest.json"))}
        doc = self._doc(str(args.get("run", "")))
        if not doc.get("verified"):
            return doc
        if name == "run_report":
            return {k: doc[k] for k in ("verified", "run", "counts", "criteria", "claims")}
        if name == "run_events":
            return {"events": [{k: e[k] for k in ("seq", "ts", "type", "actor", "summary")} for e in doc["events"]]}
        raise ValueError(f"unknown tool {name}")

    def handle(self, msg: dict) -> dict | None:
        mid, method = msg.get("id"), msg.get("method")
        if mid is None:
            return None  # notification
        try:
            if method == "initialize":
                res = {"protocolVersion": PROTOCOL, "capabilities": {"tools": {}},
                       "serverInfo": {"name": "truthlens", "version": "0.1"}}
            elif method == "tools/list":
                res = {"tools": TOOLS}
            elif method == "tools/call":
                p = msg.get("params") or {}
                try:
                    out = self.call(p.get("name", ""), p.get("arguments") or {})
                    res = {"content": [{"type": "text", "text": json.dumps(out)}], "isError": False}
                except (ValueError, OSError) as e:
                    res = {"content": [{"type": "text", "text": str(e)}], "isError": True}
            elif method == "ping":
                res = {}
            else:
                return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": "method not found"}}
        except Exception as e:  # noqa: BLE001
            return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32603, "message": str(e)}}
        return {"jsonrpc": "2.0", "id": mid, "result": res}


def serve(root: str, hmac_key: bytes | None = None, inp=sys.stdin, out=sys.stdout) -> None:
    srv = Server(root, hmac_key)
    for line in inp:
        if not line.strip():
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            resp = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "parse error"}}
        else:
            resp = srv.handle(msg)
        if resp is not None:
            out.write(json.dumps(resp) + "\n")
            out.flush()
