"""Private status wire v1. No registry, verifier, key or human-reader dependencies."""

from __future__ import annotations

import json
import os
import re
import socket
import stat
import struct
import time
from pathlib import Path

BROKER_UID = 0
TIMEOUT = 2.0
MAX_REQUEST = 2048
MAX_RESPONSE = 256
RUN_ID = re.compile(r"[A-Za-z0-9_-]{1,80}\Z")
STATUSES = ("passed", "failed", "not_checkable")


def unknown() -> dict[str, str]:
    return {"status": "not_checkable"}


def valid_run_id(value: object) -> bool:
    return isinstance(value, str) and RUN_ID.fullmatch(value) is not None


def status_only(value: object) -> dict[str, str]:
    if (
        type(value) is dict
        and set(value) == {"status"}
        and type(value["status"]) is str
        and value["status"] in STATUSES
    ):
        return {"status": value["status"]}
    return unknown()


def encode(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def decode(raw: bytes) -> object:
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("Invalid status message")
            result[key] = value
        return result

    def invalid(value):
        raise ValueError("Invalid status message")

    return json.loads(
        raw.decode("utf-8", errors="strict"),
        object_pairs_hook=pairs,
        parse_float=invalid,
        parse_constant=invalid,
    )


def peer_uid(sock: socket.socket) -> int | None:
    try:
        pid, uid, _ = struct.unpack("3i", sock.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
        return uid if pid > 0 and uid >= 0 else None
    except (OSError, AttributeError, struct.error):
        return None


def trusted_parent(path: Path) -> None:
    """Root-owned, non-symlink, non-writable ancestry; no path canonicalization."""
    path = Path(path)
    if not path.is_absolute() or ".." in path.parts or len(os.fsencode(path)) > 100:
        raise ValueError("Invalid status socket")
    for parent in (path.parent, *path.parent.parents):
        info = parent.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != BROKER_UID or info.st_mode & 0o022:
            raise ValueError("Invalid status socket")


def receive(sock: socket.socket, limit: int, *, deadline: float | None = None) -> object:
    deadline = time.monotonic() + TIMEOUT if deadline is None else deadline

    def exact(size):
        result = bytearray()
        while len(result) < size:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError()
            sock.settimeout(remaining)
            chunk = sock.recv(size - len(result))
            if not chunk:
                raise ValueError("Incomplete status frame")
            result.extend(chunk)
        return bytes(result)

    length = struct.unpack("!I", exact(4))[0]
    if not 0 < length <= limit:
        raise ValueError("Invalid status frame")
    return decode(exact(length))


def send(sock: socket.socket, value: dict, *, deadline: float | None = None) -> None:
    raw = encode(value)
    remaining = TIMEOUT if deadline is None else deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError()
    sock.settimeout(remaining)
    sock.sendall(struct.pack("!I", len(raw)) + raw)
