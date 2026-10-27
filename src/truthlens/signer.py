"""Host-owned signing service. Submissions are attributed reports, never witnesses.

Linux AF_UNIX only; one bounded request/response per connection. No child processes.
"""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import hmac
import json
import os
import re
import secrets
import socket
import stat
import struct
import sys
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

from truthlens.audit_inputs import SafeRunReader
from truthlens.canonical import canonical_bytes
from truthlens.ids import new_id
from truthlens.keys import read_key_file
from truthlens.ledger import Ledger
from truthlens.manifest import build_manifest

MAX_MESSAGE = 65536
NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,63}\Z")
OPS = {"start_signed_run", "append_event", "finish_signed_run", "status"}
SYSTEM = {"kind": "system", "id": "truthlens-signer"}


class SignerError(ValueError):
    """Fixed diagnostics only. Never include request or exception contents."""


def _pairs(items: list) -> dict:
    result = {}
    for key, value in items:
        if key in result:
            raise SignerError("invalid_request")
        result[key] = value
    return result


def decode(raw: bytes) -> dict:
    value = json.loads(raw, object_pairs_hook=_pairs)
    if not isinstance(value, dict):
        raise SignerError("invalid_request")
    canonical_bytes(value)  # no floats, constants or normalization collisions
    return value


def _name(value: object) -> str:
    if not isinstance(value, str) or not NAME.fullmatch(value):
        raise SignerError("invalid_config")
    return value


def _integer(value: object, minimum: int, maximum: int) -> int:
    if type(value) is not int or not minimum <= value <= maximum:
        raise SignerError("invalid_config")
    return value


def _path(value: object) -> Path:
    if not isinstance(value, str) or not Path(value).is_absolute() or ".." in Path(value).parts:
        raise SignerError("invalid_config")
    return Path(value)


def private_file(path: Path, limit: int) -> bytes:
    """Owner-only regular file, bounded and no symlinks (including ancestry)."""
    path = Path(os.path.abspath(path))
    _check_ancestry(path)
    with SafeRunReader(path.parent) as reader:
        fd = reader._open(path.name)
        try:
            info = os.fstat(fd)
            if info.st_uid != os.geteuid() or info.st_mode & 0o077 or info.st_nlink != 1:
                raise SignerError("unsafe_file")
            if not 1 <= info.st_size <= limit:
                raise SignerError("unsafe_file")
            raw = os.read(fd, limit + 1)
            after = os.fstat(fd)
            if len(raw) != info.st_size or (info.st_size, info.st_mtime_ns, info.st_ctime_ns) != (
                after.st_size,
                after.st_mtime_ns,
                after.st_ctime_ns,
            ):
                raise SignerError("unsafe_file")
            return raw
        finally:
            os.close(fd)


def token_digest(path: Path) -> bytes:
    raw = private_file(path, 4096).strip()
    if not 32 <= len(raw) <= 4096 or any(c < 33 or c > 126 for c in raw):
        raise SignerError("unsafe_token")
    return hashlib.sha256(raw).digest()


def directory(path: Path, mode: int, gid: int | None = None) -> None:
    # Validate before mkdir so unsafe/symlink ancestors cause no write through them.
    _check_ancestry(path)
    with SafeRunReader(path.parent):
        pass
    # Provision existing ancestors separately; never chmod/chown an existing directory.
    try:
        path.mkdir(mode=mode)
    except FileExistsError:
        pass
    with SafeRunReader(path) as reader:
        info = os.fstat(reader._fd)
        if info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != mode:
            raise SignerError("unsafe_directory")
        if gid is not None and info.st_gid != gid:
            raise SignerError("unsafe_directory")
    _check_ancestry(path)


def _check_ancestry(path: Path) -> None:
    # Writable ancestry would let another account replace service-owned files.
    for parent in path.parents:
        info = parent.stat()
        if info.st_uid not in {0, os.geteuid()} or (
            info.st_mode & 0o022 and not (info.st_uid == 0 and info.st_mode & stat.S_ISVTX)
        ):
            raise SignerError("unsafe_directory")


@dataclass(repr=False)
class Caller:
    name: str
    harnesses: list[str]
    uid: int | None
    gid: int | None
    digest: bytes | None
    runs_per_hour: int
    events_per_run: int
    bytes_per_run: int
    bytes_per_hour: int
    starts: deque = field(default_factory=deque)
    traffic: deque = field(default_factory=deque)


@dataclass(repr=False)
class Config:
    socket: Path
    socket_gid: int
    run_root: Path
    key_file: Path
    callers: list[Caller]

    @classmethod
    def load(cls, path: Path) -> Config:
        doc = decode(private_file(path, MAX_MESSAGE))
        if set(doc) != {"version", "socket", "socket_gid", "run_root", "key_file", "callers"}:
            raise SignerError("invalid_config")
        if type(doc["version"]) is not int or doc["version"] != 1:
            raise SignerError("invalid_config")
        if not isinstance(doc["callers"], dict) or not 1 <= len(doc["callers"]) <= 64:
            raise SignerError("invalid_config")
        callers = []
        digests = set()
        for name, item in doc["callers"].items():
            _name(name)
            required = {"harnesses", "runs_per_hour", "events_per_run", "bytes_per_run", "bytes_per_hour"}
            if (
                not isinstance(item, dict)
                or not required <= item.keys()
                or item.keys() - required - {"uid", "gid", "token_file"}
            ):
                raise SignerError("invalid_config")
            harnesses = item["harnesses"]
            if not isinstance(harnesses, list) or not 1 <= len(harnesses) <= 32:
                raise SignerError("invalid_config")
            harnesses = [_name(v) for v in harnesses]
            uid = _integer(item["uid"], 0, 2**31 - 1) if "uid" in item else None
            gid = _integer(item["gid"], 0, 2**31 - 1) if "gid" in item else None
            digest = token_digest(_path(item["token_file"])) if "token_file" in item else None
            if uid is None and gid is None and digest is None:
                raise SignerError("invalid_config")
            if digest is not None:
                if digest in digests:
                    raise SignerError("invalid_config")
                digests.add(digest)
            callers.append(
                Caller(
                    name,
                    harnesses,
                    uid,
                    gid,
                    digest,
                    _integer(item["runs_per_hour"], 1, 10000),
                    _integer(item["events_per_run"], 1, 10000),
                    _integer(item["bytes_per_run"], 1024, 16 * 1024 * 1024),
                    _integer(item["bytes_per_hour"], 1024, 1024 * 1024 * 1024),
                )
            )
        return cls(
            _path(doc["socket"]),
            _integer(doc["socket_gid"], 0, 2**31 - 1),
            _path(doc["run_root"]),
            _path(doc["key_file"]),
            callers,
        )


@dataclass(repr=False)
class Run:
    caller: str
    harness: str
    digest: bytes
    ledger: Ledger
    count: int = 0
    size: int = 0
    finished: bool = False
    failed: bool = False


class Signer:
    def __init__(self, config: Config):
        self.config = config
        directory(config.run_root, 0o700)
        directory(config.socket.parent, 0o750, config.socket_gid)
        _check_ancestry(config.key_file)
        self.key = read_key_file(config.key_file, config.run_root)
        self.key_id = getattr(self.key, "key_id", "signer-v1")
        # Lock directory itself for the daemon lifetime, avoiding a replaceable lock inode.
        with SafeRunReader(config.run_root) as reader:
            self.root_fd = os.dup(reader._fd)
        try:
            fcntl.flock(self.root_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BaseException:
            os.close(self.root_fd)
            raise
        self.runs: dict[str, Run] = {}

    def close(self) -> None:
        os.close(self.root_fd)

    def authenticate(self, req: dict, peer: tuple[int, int]) -> Caller:
        token = req.get("caller_token", "")
        if not isinstance(token, str):
            raise SignerError("unauthorized")
        digest = hashlib.sha256(token.encode()).digest()
        matches = []
        for caller in self.config.callers:
            token_ok = hmac.compare_digest(digest, caller.digest) if caller.digest is not None else not token
            if (
                token_ok
                and (caller.uid is None or peer[0] == caller.uid)
                and (caller.gid is None or peer[1] == caller.gid)
            ):
                matches.append(caller)
        if len(matches) != 1:
            raise SignerError("unauthorized")
        return matches[0]

    def dispatch(self, req: dict, peer: tuple[int, int], size: int) -> dict:
        caller = self.authenticate(req, peer)
        now = time.monotonic()
        for queue in (caller.starts, caller.traffic):
            while queue and queue[0][0] <= now - 3600:
                queue.popleft()
        # Count every authenticated request, including failed operations and status.
        if len(caller.traffic) >= 20000 or sum(n for _, n in caller.traffic) + size > caller.bytes_per_hour:
            raise SignerError("rate_limited")
        caller.traffic.append((now, size))
        op = req.get("op")
        if not isinstance(op, str) or op not in OPS:
            raise SignerError("invalid_request")
        common = {"op", "caller_token"}
        allowed = {
            "start_signed_run": {"harness", "task", "criteria"},
            "append_event": {"run_id", "token", "event"},
            "finish_signed_run": {"run_id", "token", "summary"},
            "status": {"run_id", "token"},
        }
        if req.keys() - common - allowed[op]:
            raise SignerError("invalid_request")
        if op == "start_signed_run":
            if req.get("harness") not in caller.harnesses or not isinstance(req.get("task"), str):
                raise SignerError("invalid_request")
            if "criteria" in req and not isinstance(req["criteria"], list):
                raise SignerError("invalid_request")
            if (
                len(caller.starts) >= caller.runs_per_hour
                or sum(not r.finished for r in self.runs.values()) >= 32
            ):
                raise SignerError("rate_limited")
            if size > caller.bytes_per_run:
                raise SignerError("rate_limited")
            # Bound memory, preserving all open runs; old completed status is ephemeral.
            if len(self.runs) >= 1024:
                oldest = next(k for k, r in self.runs.items() if r.finished)
                del self.runs[oldest]
            run_id, token = new_id("run"), secrets.token_urlsafe(32)
            path = self.config.run_root / run_id
            path.mkdir(mode=0o700)
            os.fsync(self.root_fd)
            led = Ledger(path / "ledger.jsonl", self.key, self.key_id)
            run = Run(caller.name, req["harness"], hashlib.sha256(token.encode()).digest(), led, size=size)
            self.runs[run_id] = run
            caller.starts.append((now, 1))
            self._write(
                run,
                run_id,
                SYSTEM,
                "run.started",
                {
                    "agent": run.harness,
                    "caller": caller.name,
                    "harness": run.harness,
                    "provenance": "agent-reported",
                    "task": req["task"],
                    "criteria": req.get("criteria", []),
                },
            )
            directory_fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
            return {"run_id": run_id, "token": token}
        run_id, token = req.get("run_id"), req.get("token")
        if not isinstance(run_id, str) or not isinstance(token, str):
            raise SignerError("unauthorized")
        run = self.runs.get(run_id)
        if (
            run is None
            or run.caller != caller.name
            or not hmac.compare_digest(run.digest, hashlib.sha256(token.encode()).digest())
        ):
            raise SignerError("unauthorized")
        if op == "status":
            return {
                "run_id": run_id,
                "state": "failed" if run.failed else "finished" if run.finished else "open",
                "reported_events": run.count,
            }
        if run.finished or run.failed:
            raise SignerError("run_closed")
        if run.size + size > caller.bytes_per_run:
            raise SignerError("rate_limited")
        if op == "append_event":
            if not isinstance(req.get("event"), dict):
                raise SignerError("invalid_request")
            if run.count >= caller.events_per_run:
                raise SignerError("rate_limited")
            event = self._write(
                run,
                run_id,
                {"kind": "agent", "id": caller.name},
                "agent.note",
                {
                    "provenance": "agent-reported",
                    "caller": caller.name,
                    "harness": run.harness,
                    "reported_event": req["event"],
                },
            )
            run.count += 1
            run.size += size
            return {"run_id": run_id, "seq": event["seq"]}
        if not isinstance(req.get("summary"), str):
            raise SignerError("invalid_request")
        last = run.ledger.read()[-1]["hash"]
        self._write(
            run,
            run_id,
            SYSTEM,
            "run.finished",
            {
                "last_hash": last,
                "status": "reported",
                "provenance": "agent-reported",
                "caller": caller.name,
                "harness": run.harness,
                "summary": req["summary"],
            },
        )
        run.finished = True
        run.size += size
        try:
            manifest = build_manifest(run.ledger.read(), {"name": run.harness})
            raw = canonical_bytes(manifest) + b"\n"
            _publish(run.ledger.path.parent, "manifest.json", raw)
            _publish(
                run.ledger.path.parent, "manifest.sha256", hashlib.sha256(raw).hexdigest().encode() + b"\n"
            )
        except Exception:
            run.failed = True
            raise
        return {"run_id": run_id, "state": "finished"}

    def _write(self, run: Run, run_id: str, actor: dict, kind: str, payload: dict) -> dict:
        try:
            return run.ledger.append(run_id, actor, kind, payload)
        except Exception:
            run.failed = True
            raise

    def respond(self, raw: bytes, peer: tuple[int, int], audit) -> bytes:
        caller, op = "unknown", "invalid"
        try:
            if len(raw) > MAX_MESSAGE or not raw.endswith(b"\n"):
                raise SignerError("message_too_large")
            req = decode(raw)
            authenticated = self.authenticate(req, peer)
            caller = authenticated.name
            op = req.get("op") if isinstance(req.get("op"), str) and req["op"] in OPS else "invalid"
            result = {"ok": True, "result": self.dispatch(req, peer, len(raw))}
        except SignerError as exc:
            result = {"ok": False, "error": str(exc)}
        except Exception:  # noqa: BLE001 -- fixed public response, no secret-bearing exceptions
            result = {"ok": False, "error": "request_failed"}
        # Fixed vocabulary plus config-validated identity only. Never bodies or credentials.
        audit.write(
            json.dumps({"caller": caller, "op": op, "outcome": "ok" if result["ok"] else result["error"]})
            + "\n"
        )
        audit.flush()  # If audit output fails, no success response is sent.
        return canonical_bytes(result) + b"\n"


def _publish(root: Path, name: str, raw: bytes) -> None:
    temporary = root / ("." + name + ".tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, root / name)
    fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def serve(signer: Signer, *, stop=None, ready=None, audit=None) -> None:
    audit = sys.stdout if audit is None else audit
    path = signer.config.socket
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as listener:
        listener.bind(str(path))  # Refuse existing paths, including stale sockets.
        identity = path.stat()
        try:
            os.chown(path, -1, signer.config.socket_gid)
            os.chmod(path, 0o660)
            listener.listen(16)
            listener.settimeout(0.2)
            if ready is not None:
                ready.set()
            while stop is None or not stop.is_set():
                try:
                    conn, _ = listener.accept()
                except TimeoutError:
                    continue
                with conn:
                    conn.settimeout(2)
                    try:
                        _, uid, gid = struct.unpack(
                            "3i", conn.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12)
                        )
                        with conn.makefile("rb") as stream:
                            raw = stream.readline(MAX_MESSAGE + 1)
                        conn.sendall(signer.respond(raw, (uid, gid), audit))
                    except (OSError, ValueError):
                        audit.write('{"caller":"unknown","op":"invalid","outcome":"transport_failed"}\n')
                        audit.flush()
        finally:
            current = path.lstat()
            if (identity.st_dev, identity.st_ino) == (current.st_dev, current.st_ino):
                path.unlink()


def main(argv: list[str]) -> int:
    class Parser(argparse.ArgumentParser):
        def error(self, message: str) -> None:
            self.exit(2, "error: invalid signer arguments\n")

    parser = Parser(prog="truthlens signer", allow_abbrev=False)
    sub = parser.add_subparsers(dest="command", required=True, parser_class=Parser)
    command = sub.add_parser("serve", allow_abbrev=False)
    command.add_argument("--config", type=Path, required=True)
    args = parser.parse_args(argv)
    signer = None
    try:
        if not hasattr(socket, "SO_PEERCRED"):
            raise SignerError("unsupported_platform")
        signer = Signer(Config.load(args.config))
        serve(signer)
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception:  # noqa: BLE001 -- fixed stderr, including configuration failures
        print("error: signer unavailable", file=sys.stderr)
        return 2
    finally:
        if signer is not None:
            signer.close()
