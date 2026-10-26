"""Rebuildable SQLite projection of one verified run (read model for UI/MCP).

The ledger is the source of truth; the projection is derived and rebuilt atomically
(temp file + fsync + os.replace), so a reader never sees a half-written database.
"""

from __future__ import annotations

import json
import os
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

from truthlens.manifest import acceptance, claims

SCHEMA = """
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE events(seq INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL, ts TEXT NOT NULL, type TEXT NOT NULL,
                    actor_kind TEXT NOT NULL, actor_id TEXT NOT NULL, payload TEXT NOT NULL, hash TEXT NOT NULL);
CREATE TABLE criteria(criterion_id TEXT PRIMARY KEY, text TEXT NOT NULL, status TEXT NOT NULL, evidence TEXT NOT NULL);
CREATE TABLE claims(claim_id TEXT PRIMARY KEY, text TEXT NOT NULL, criterion_ids TEXT NOT NULL, finding TEXT NOT NULL);
CREATE TABLE artifacts(artifact_id TEXT PRIMARY KEY, path TEXT NOT NULL, sha256 TEXT NOT NULL);
"""


def build(events: list[dict], dest: str | os.PathLike) -> Path:
    """Write a fresh projection for already-verified events and atomically replace `dest`."""
    dest = Path(dest)
    fd, tmp = tempfile.mkstemp(dir=dest.parent, suffix=".sqlite.tmp")
    os.close(fd)
    try:
        # SQLite's transaction context does not close the connection on exit.
        with closing(sqlite3.connect(tmp)) as con, con:
            con.executescript(SCHEMA)
            con.executemany("INSERT INTO meta VALUES (?,?)", [
                ("run_id", events[0]["run_id"] if events else ""),
                ("last_hash", events[-1]["hash"] if events else ""),
                ("event_count", str(len(events)))])
            con.executemany("INSERT INTO events VALUES (?,?,?,?,?,?,?,?)", [
                (e["seq"], e["id"], e["ts"], e["type"], e["actor"]["kind"], e["actor"]["id"],
                 json.dumps(e["payload"], sort_keys=True), e["hash"]) for e in events])
            con.executemany("INSERT INTO criteria VALUES (?,?,?,?)", [
                (a["criterion_id"], a["text"], a["status"], json.dumps(a["evidence"])) for a in acceptance(events)])
            con.executemany("INSERT INTO claims VALUES (?,?,?,?)", [
                (c["claim_id"], c["text"], json.dumps(c["criterion_ids"]), c["finding"]) for c in claims(events)])
            con.executemany("INSERT INTO artifacts VALUES (?,?,?)", [
                (e["payload"]["artifact_id"], e["payload"]["path"], e["payload"]["sha256"])
                for e in events if e["type"] == "artifact.recorded"])
        with open(tmp, "rb+") as fh:
            os.fsync(fh.fileno())
        os.replace(tmp, dest)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    return dest
