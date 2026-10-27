"""Read-only local catalog MCP over stdio (JSON-RPC 2.0, newline-delimited).

``truthlens mcp`` with ``TRUTHLENS_ROOT`` set, and without ``--root``, exposes
``list_runs``, ``get_run``, ``verify_run`` and ``doctor``. The server does not
open a network connection and does not write. ``TRUE`` / ``bestätigt`` and
``FALSE`` / ``widerlegt`` are returned only when integrity is ``hmac``.
Otherwise the verdict is ``UNKNOWN`` / ``unklar``, or ``not_checkable`` when
the run cannot be checked.

This is not the D34 status adapter. Legacy ``truthlens mcp --root`` stays in
``mcp.py`` with ``list_runs``, ``run_report`` and ``run_events``.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from truthlens.display_labels import criterion_label
from truthlens.mcp import PROTOCOL, Server

NOTE = "Integrity is not approval."
_DE = {
    "TRUE": "bestätigt",
    "FALSE": "widerlegt",
    "UNKNOWN": "unklar",
    "not_checkable": "not_checkable",
}
TOOLS = [
    {
        "name": "list_runs",
        "description": "List run directories under TRUTHLENS_ROOT. Names only; no verdicts.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_run",
        "description": (
            "Claims, verdicts and evidence for one local run. "
            "TRUE/bestätigt and FALSE/widerlegt require HMAC integrity. "
            "Otherwise UNKNOWN/unklar, or not_checkable when the run cannot be checked. "
            "Integrity is not approval."
        ),
        "inputSchema": {"type": "object", "properties": {"run": {"type": "string"}}, "required": ["run"]},
    },
    {
        "name": "verify_run",
        "description": (
            "Local check of a run directory or ledger file inside TRUTHLENS_ROOT. "
            "No network. Does not report a claim as TRUE or FALSE."
        ),
        "inputSchema": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
    },
    {
        "name": "doctor",
        "description": (
            "Local catalog checks. Network and writes stay disabled. "
            "Isolation stays unverified. This is not a D34 status."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
]


def _pair(word: str) -> dict[str, str]:
    return {"verdict": word, "label_de": _DE[word]}


class CatalogServer:
    def __init__(self, root: str, hmac_key: bytes | None = None):
        self._legacy = Server(root, hmac_key)
        self.root = self._legacy.root
        self.key = hmac_key

    def _confine(self, raw: object) -> Path:
        if not isinstance(raw, str) or not raw or raw.startswith(("/", "\\")) or "\\" in raw:
            raise ValueError("path outside root")
        path = Path(raw)
        if path.is_absolute() or ".." in path.parts:
            raise ValueError("path outside root")
        target = (self.root / path).resolve()
        if target != self.root and self.root not in target.parents:
            raise ValueError("path outside root")
        return target

    def _words(self, integrity: object, verified: object) -> dict[str, str]:
        if integrity == "hmac" and verified is True:
            return {}
        if integrity == "failed":
            return _pair("not_checkable")
        return _pair("UNKNOWN")

    def _check(self, doc: dict) -> dict:
        integrity = doc.get("integrity")
        if integrity not in {"hmac", "hash-only", "failed", "unknown"}:
            integrity = "unknown"
        verified = doc.get("verified") is True and integrity == "hmac"
        out: dict = {"verified": verified, "integrity": integrity, "note": NOTE}
        if isinstance(doc.get("reason"), str):
            out["reason"] = doc["reason"]
        out.update(self._words(integrity, verified))
        if integrity == "hmac" and verified:
            out["authenticated"] = True
        elif integrity == "failed" and isinstance(doc.get("errors"), list):
            out["errors"] = doc["errors"]
        else:
            out["authenticated"] = False
        return out

    def _run_doc(self, raw: str) -> dict:
        target = self._confine(raw)
        if (target / "manifest.json").is_symlink() or (target / "ledger.jsonl").is_symlink():
            raise ValueError("path outside root")
        return self._legacy._doc(raw)

    def list_runs(self) -> dict:
        if not self.root.is_dir():
            raise ValueError("root_unreadable")
        found: list[str] = []
        for dirpath, dirnames, filenames in os.walk(self.root, followlinks=False):
            current = Path(dirpath)
            dirnames[:] = [name for name in dirnames if not (current / name).is_symlink()]
            if "manifest.json" not in filenames or (current / "manifest.json").is_symlink():
                continue
            rel = current.relative_to(self.root).as_posix()
            found.append("." if rel == "." else rel)
        return {"runs": sorted(found)}

    def get_run(self, raw: object) -> dict:
        if not isinstance(raw, str):
            raise TypeError("not a run dir")
        doc = self._run_doc(raw)
        base = self._check(doc)
        if base["integrity"] == "failed" or base["integrity"] == "unknown":
            return base
        authenticated = base.get("authenticated") is True
        criteria_in = doc.get("criteria") if isinstance(doc.get("criteria"), list) else []
        claims_in = doc.get("claims") if isinstance(doc.get("claims"), list) else []
        criteria: list[dict] = []
        by_id: dict[str, dict] = {}
        evidence: list[dict] = []
        seen: set[tuple] = set()
        for item in criteria_in:
            if not isinstance(item, dict):
                continue
            word = "UNKNOWN" if not authenticated else criterion_label(item.get("status"), authenticated=True)
            row = {
                "criterion_id": item.get("criterion_id"),
                "status": item.get("status"),
                "evidence": [ref for ref in item.get("evidence") or [] if isinstance(ref, str)],
                **_pair(word),
            }
            criteria.append(row)
            if isinstance(row["criterion_id"], str):
                by_id[row["criterion_id"]] = row
            for ref in row["evidence"]:
                key = ("witness", ref)
                if key not in seen:
                    seen.add(key)
                    evidence.append({"kind": "witness", "id": ref})
        claims: list[dict] = []
        for item in claims_in:
            if not isinstance(item, dict):
                continue
            ids = [ref for ref in item.get("criterion_ids") or [] if isinstance(ref, str)]
            claims.append({
                "claim_id": item.get("claim_id"),
                "text": item.get("text", ""),
                "criterion_ids": ids,
                "finding": item.get("finding"),
                **_pair(self._claim_word(item, ids, by_id, authenticated)),
            })
        for art in doc.get("artifacts") or []:
            if not isinstance(art, dict) or not isinstance(art.get("sha256"), str):
                continue
            ref = {"kind": "artifact", "sha256": art["sha256"]}
            if isinstance(art.get("path"), str):
                ref["path"] = art["path"]
            key = ("artifact", ref.get("path"), ref["sha256"])
            if key not in seen:
                seen.add(key)
                evidence.append(ref)
        words = [row["verdict"] for row in criteria] + [row["verdict"] for row in claims]
        if any(word == "FALSE" for word in words):
            summary = "FALSE"
        elif words and all(word == "TRUE" for word in words):
            summary = "TRUE"
        else:
            summary = "UNKNOWN"
        run = doc.get("run") if isinstance(doc.get("run"), dict) else {}
        return {
            **base,
            **_pair(summary),
            "run": {"run_id": run.get("run_id")},
            "claims": claims,
            "criteria": criteria,
            "evidence": evidence,
        }

    def _claim_word(self, claim: dict, ids: list[str], by_id: dict[str, dict], authenticated: bool) -> str:
        if not authenticated:
            return "UNKNOWN"
        statuses = [by_id.get(cid, {}).get("status") for cid in ids]
        if any(status == "unmet" for status in statuses):
            return "FALSE"
        if claim.get("finding") == "supported" and ids and all(status == "met" for status in statuses):
            return "TRUE"
        return "UNKNOWN"

    def verify_run(self, raw: object) -> dict:
        if not isinstance(raw, str):
            raise TypeError("not a run or ledger")
        target = self._confine(raw)
        if target.is_dir():
            return self._check(self._run_doc(raw))
        if target.is_file() and target.name == "ledger.jsonl" and (target.parent / "manifest.json").is_file():
            if (target.parent / "manifest.json").is_symlink() or target.is_symlink():
                raise ValueError("path outside root")
            rel = target.parent.relative_to(self.root).as_posix()
            return self._check(self._run_doc("." if rel == "." else rel))
        if target.is_file():
            from truthlens.keys import ManagedKey, verification_key
            from truthlens.ledger import Ledger, verify

            key, reason = self.key, None
            if isinstance(key, ManagedKey):
                preliminary = verify(target)
                if preliminary.ok:
                    key, reason = verification_key(key, Ledger(target).read())
            result = verify(target, key)
            if not result.ok:
                return self._check({
                    "verified": False,
                    "integrity": "failed",
                    "errors": [f"line {n}: {message}" for n, message in result.errors],
                })
            verified = key is not None
            return self._check({"verified": verified, "integrity": "hmac" if verified else "hash-only",
                                **({"reason": reason} if reason else {})})
        raise ValueError("not a run or ledger")

    def doctor(self) -> dict:
        return {
            "root_configured": True,
            "root_readable": self.root.is_dir(),
            "network": "disabled",
            "writes": "disabled",
            "isolation": "unverified",
            "hmac_key": "present" if self.key is not None else "absent",
            "note": "Integrity is not approval. Isolation is unverified. This catalog is not a D34 status.",
        }

    def call(self, name: str, args: dict) -> dict:
        if name == "list_runs":
            return self.list_runs()
        if name == "get_run":
            return self.get_run(args.get("run"))
        if name == "verify_run":
            return self.verify_run(args.get("path"))
        if name == "doctor":
            return self.doctor()
        raise ValueError("unknown tool")

    def handle(self, msg: object) -> dict | None:
        if not isinstance(msg, dict):
            return {"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "Invalid Request"}}
        mid, method = msg.get("id"), msg.get("method")
        if mid is None:
            return None
        try:
            if method == "initialize":
                res = {
                    "protocolVersion": PROTOCOL,
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "truthlens", "version": "0.1"},
                }
            elif method == "tools/list":
                res = {"tools": TOOLS}
            elif method == "tools/call":
                params = msg.get("params") or {}
                arguments = params.get("arguments") or {}
                if not isinstance(arguments, dict):
                    arguments = {}
                try:
                    out = self.call(str(params.get("name", "")), arguments)
                    res = {"content": [{"type": "text", "text": json.dumps(out)}], "isError": False}
                except (ValueError, OSError, TypeError):
                    res = {"content": [{"type": "text", "text": "unreadable"}], "isError": True}
            elif method == "ping":
                res = {}
            else:
                return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": "method not found"}}
        except Exception:  # noqa: BLE001 -- fixed message, never reflect a path or key
            return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32603, "message": "internal error"}}
        return {"jsonrpc": "2.0", "id": mid, "result": res}


def serve(root: str, hmac_key: bytes | None = None, inp=sys.stdin, out=sys.stdout) -> None:
    srv = CatalogServer(root, hmac_key)
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
