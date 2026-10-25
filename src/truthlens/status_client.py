"""Unprivileged, status-only Unix client. Never reads private TruthLens sources."""

from __future__ import annotations

import socket
import stat
import time
from pathlib import Path

from truthlens import status_wire as wire


def check_status(socket_path: Path | str, run_id: str) -> dict[str, str]:
    try:
        if not wire.valid_run_id(run_id):
            return wire.unknown()
        path = Path(socket_path)
        wire.trusted_parent(path)
        info = path.lstat()
        if not stat.S_ISSOCK(info.st_mode) or info.st_uid != wire.BROKER_UID:
            return wire.unknown()
        deadline = time.monotonic() + wire.TIMEOUT
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
            sock.settimeout(wire.TIMEOUT)
            sock.connect(str(path))
            if wire.peer_uid(sock) != wire.BROKER_UID:
                return wire.unknown()
            wire.send(sock, {"version": 1, "run_id": run_id}, deadline=deadline)
            return wire.status_only(wire.receive(sock, wire.MAX_RESPONSE, deadline=deadline))
    except Exception:  # noqa: BLE001 -- D34: no reflected errors or diagnostic logging  # fail closed; never reflect a transport/parser/path error
        return wire.unknown()
