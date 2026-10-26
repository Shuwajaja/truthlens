"""Projection rebuild failures must release resources and preserve the old view."""

import json
import sqlite3
from contextlib import closing

import pytest

from truthlens import projection
from truthlens.ledger import Ledger, verify


@pytest.mark.parametrize("existing", [False, True], ids=["first-build", "replacement"])
def test_sqlite_failure_closes_connection_and_allows_retry(tmp_path, monkeypatch, existing):
    ledger = Ledger(tmp_path / "ledger.jsonl")
    ledger.append("run_projection", {"kind": "wrapper", "id": "test"}, "x", {"text": "small"})
    dest = tmp_path / "projection.sqlite"
    if existing:
        projection.build(ledger.read(), dest)
    previous = dest.read_bytes() if existing else None

    ledger.append("run_projection", {"kind": "wrapper", "id": "test"}, "x", {"text": "x" * 8192})
    assert verify(ledger.path).ok
    events = ledger.read()
    connect = sqlite3.connect
    connections = []

    def limited_connect(*args, **kwargs):
        connection = connect(*args, **kwargs)
        # Use a real SQLite failure with otherwise valid, verified events.
        connection.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 4096)
        connections.append(connection)
        return connection

    with monkeypatch.context() as patch:
        patch.setattr(projection.sqlite3, "connect", limited_connect)
        with pytest.raises(sqlite3.DataError, match="too big"):
            projection.build(events, dest)

    try:
        assert len(connections) == 1
        assert not list(tmp_path.glob("*.sqlite.tmp*"))
        assert (dest.read_bytes() if dest.exists() else None) == previous
        with pytest.raises(sqlite3.ProgrammingError, match="closed"):
            connections[0].execute("SELECT 1")

        assert projection.build(events, dest) == dest
        with closing(connect(dest)) as connection:
            rows = connection.execute("SELECT seq, payload FROM events ORDER BY seq").fetchall()
        assert [seq for seq, _ in rows] == [1, 2]
        assert json.loads(rows[1][1]) == {"text": "x" * 8192}
    finally:
        # Keep the red test from leaking its deliberately retained connection.
        for connection in connections:
            connection.close()
