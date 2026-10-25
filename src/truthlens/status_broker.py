"""Trusted Linux status-only broker. This module never starts on import.

The existing root-only registry requires a privileged read context. Queries use
stored reports and captured digests, never keys, audit/admission or the human
reader. Operating-system isolation must be established separately by the owner.
"""

from __future__ import annotations

import os
import re
import socket
import socketserver
import stat
import threading
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from truthlens import pipeline_jobs, status_projection
from truthlens import status_wire as wire
from truthlens.audit_inputs import SafeRunReader
from truthlens.registry import Registry, require_root, trusted

HEX32 = re.compile(r"[0-9a-f]{32}\Z")
HEX64 = re.compile(r"[0-9a-f]{64}\Z")
JOB_EVENTS = frozenset({"queued", "running", "completed", "failed", "interrupted"})


def registered_status(store: Registry, run_id: str, uid: int) -> dict[str, str]:
    """Authorize before lookup; narrow trusted stored evidence to Phase F status.

    Native audits have no `verified` field. It is established by the protected
    existing pipeline_jobs.status() explicit boolean for the stored completed
    receipt and HMAC/authentication fields. An explicit inconsistent flag is never accepted.
    """
    try:
        if not wire.valid_run_id(run_id) or type(uid) is not int or uid <= 0:
            return wire.unknown()
        registration = store.status_registration(run_id, uid)
        # Registry selects the server dispatch, never caller-supplied session/UID.
        if (
            registration.get("origin") != "server_pipeline"
            or registration.get("pipeline_id") != "truthlens-server-v1"
            or not registration.get("capture_closed_at")
            or not HEX32.fullmatch(registration.get("dispatch_id", ""))
            or registration.get("snapshot_id") != registration["dispatch_id"]
            or not HEX32.fullmatch(registration.get("registration_id", ""))
            or not HEX64.fullmatch(registration.get("ledger_last_hash", ""))
        ):
            return wire.unknown()
        rows = store.records()
        # Status authorization above is distinct from caller authority. Inspect
        # the worker's stored context as the bound original initiator internally;
        # never grant readers access to pipeline_jobs.status's detailed result.
        context = pipeline_jobs.status(store, run_id, registration["initiator_uid"])
        if context.get("verified") is not True or context.get("state") != "completed":
            return wire.unknown()
        jobs = [r for r in rows if r["event"] in JOB_EVENTS and r["data"].get("run_id") == run_id]
        if not jobs or jobs[-1]["event"] != "completed":
            return wire.unknown()
        latest = jobs[-1]["data"]
        # Do not promote legacy inline reports into this stricter agent boundary.
        if "report_path" not in latest:
            return wire.unknown()
        report = store.read_report(latest["audit_id"], latest)
        digests = registration["input_digests"]
        provenance = report.get("input_digests")
        if (
            report.get("authentication") != "supported"
            or report.get("integrity") != "hmac"
            or ("verified" in report and report["verified"] is not True)
            or report.get("state", "completed") != "completed"
            or report.get("run_id") != run_id
            or report.get("ledger_last_hash") != registration["ledger_last_hash"]
            or report.get("conclusion") not in ("supported_within_scope", "contradictory")
            or not isinstance(provenance, dict)
            or provenance.get("run") != digests
            or provenance.get("verifier") != registration["verifier_digests"]
            or report.get("ruleset_version") != registration["ruleset_version"]
            or not isinstance(digests, dict)
            or not {"ledger.jsonl", "manifest.json"}.issubset(digests)
        ):
            return wire.unknown()
        root = store.root / "snapshots" / registration["dispatch_id"]
        trusted(root, directory=True, private=True)
        if root.lstat().st_mode & 0o222:
            return wire.unknown()
        # Reuse the bounded no-follow input reader for freshness, not a second
        # verifier. HMAC was checked by the trusted worker at stored completion.
        with SafeRunReader(root) as reader:
            for name, digest in digests.items():
                if not isinstance(digest, str) or not HEX64.fullmatch(digest):
                    return wire.unknown()
                path = root / name
                trusted(path, private=True)
                if path.lstat().st_mode & 0o222:
                    return wire.unknown()
                reader.read(name, limit=reader.limits.total_bytes)
            if reader.finish() != digests:
                return wire.unknown()
        # Serialize the final registry observation with writers. Do not call
        # status()/run()/records() inside this region: they acquire their own lock.
        with store.locked(create=False) as (_, current):
            if current != rows:
                return wire.unknown()
            projected = status_projection.project_status(
                report,
                run_id=run_id,
                ledger_last_hash=registration["ledger_last_hash"],
                input_digests=digests,
                state="completed",
            )
            return wire.status_only({"status": projected["status"]})

    except Exception:  # noqa: BLE001 -- D34: no reflected errors or diagnostics
        return wire.unknown()


@dataclass(frozen=True)
class BrokerConfig:
    socket_path: Path
    allowed_uids: frozenset[int]
    socket_gid: int

    def validate(self) -> None:
        require_root()
        if (
            not hasattr(socket, "SO_PEERCRED")
            or type(self.socket_gid) is not int
            or not 0 < self.socket_gid < 2**31
            or not isinstance(self.allowed_uids, frozenset)
            or not self.allowed_uids
            or len(self.allowed_uids) > 64
            or any(type(uid) is not int or not 0 < uid < 2**31 for uid in self.allowed_uids)
        ):
            raise ValueError("Invalid status broker configuration")
        wire.trusted_parent(self.socket_path)


class _Handler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        deadline = time.monotonic() + wire.TIMEOUT
        result = wire.unknown()
        try:
            uid = wire.peer_uid(self.request)
            if uid is not None and uid in self.server.config.allowed_uids and self.server.admit_query(uid):
                request = wire.receive(self.request, wire.MAX_REQUEST, deadline=deadline)
                if (
                    type(request) is dict
                    and set(request) == {"version", "run_id"}
                    and type(request["version"]) is int
                    and request["version"] == 1
                    and wire.valid_run_id(request["run_id"])
                ):
                    result = wire.status_only(self.server.source(request["run_id"], uid))
        except Exception:  # noqa: BLE001, S110 -- D34: no reflected errors or diagnostic logging
            pass
        try:
            wire.send(self.request, result, deadline=deadline)
        except Exception:  # noqa: BLE001, S110 -- D34: no reflected errors or diagnostic logging
            pass


class StatusBroker(socketserver.UnixStreamServer):
    """Two fixed workers, no waiting executor submissions; one request/connection.

    0660 root-owned socket uses an explicitly selected existing agent group.
    No groups or accounts are created. SO_PEERCRED plus registry rights is
    mandatory before reading any source; socket mode is not authorization.
    """

    request_queue_size = 8
    allow_reuse_address = False

    def __init__(self, config: BrokerConfig, source: Callable[[str, int], dict[str, str]]):
        config.validate()
        self.config, self.source = config, source
        self._identity = None
        self._rate_lock = threading.Lock()
        self._buckets: dict[int, tuple[float, float]] = {}
        self._slots = threading.BoundedSemaphore(2)
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="truthlens-status")
        try:
            super().__init__(str(config.socket_path), _Handler, bind_and_activate=False)
            # Never unlink/reuse an existing path, including a stale socket.
            previous = os.umask(0o177)
            try:
                self.server_bind()
                info = config.socket_path.lstat()
                self._identity = (info.st_dev, info.st_ino)
                os.chown(config.socket_path, -1, config.socket_gid, follow_symlinks=False)
                os.chmod(config.socket_path, 0o660, follow_symlinks=False)
                self.server_activate()
            finally:
                os.umask(previous)
        except BaseException:
            self.server_close()
            raise

    def admit_query(self, uid: int) -> bool:
        # State is bounded by the configured allowlist (max 64). No input IDs
        # or denied principals are cached. Four requests/s, burst eight per UID.
        with self._rate_lock:
            now = time.monotonic()
            tokens, previous = self._buckets.get(uid, (8.0, now))
            tokens = min(8.0, tokens + (now - previous) * 4.0)
            allowed = tokens >= 1.0
            self._buckets[uid] = (tokens - 1.0 if allowed else tokens, now)
            return allowed

    def process_request(self, request, client_address) -> None:
        if not self._slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            self._executor.submit(self._process, request, client_address)
        except BaseException:
            self._slots.release()
            self.shutdown_request(request)
            raise

    def _process(self, request, client_address) -> None:
        try:
            self.finish_request(request, client_address)
        except Exception:  # noqa: BLE001, S110 -- D34: no reflected errors or diagnostic logging
            pass
        finally:
            self.shutdown_request(request)
            self._slots.release()

    def handle_error(self, request, client_address) -> None:
        pass

    def server_close(self) -> None:
        if hasattr(self, "socket"):
            super().server_close()
        self._executor.shutdown(wait=True)
        if self._identity is not None:
            try:
                info = self.config.socket_path.lstat()
                if (info.st_dev, info.st_ino) == self._identity and stat.S_ISSOCK(info.st_mode):
                    self.config.socket_path.unlink()
            except FileNotFoundError:
                pass
            self._identity = None


def main(argv: list[str] | None = None) -> int:
    """Explicit operator process entrypoint; never installs or configures a host."""
    import argparse

    class Parser(argparse.ArgumentParser):
        def error(self, message):
            raise ValueError("Invalid status broker configuration")

    parser = Parser(
        description="Protected status broker; separate host authorization required", allow_abbrev=False
    )
    parser.add_argument("--socket", required=True, type=Path)
    parser.add_argument("--allow-uid", required=True, action="append", type=int)
    parser.add_argument("--socket-gid", required=True, type=int)
    try:
        args = parser.parse_args(argv)
        config = BrokerConfig(args.socket, frozenset(args.allow_uid), args.socket_gid)
        config.validate()
        store = Registry()
        with StatusBroker(config, lambda run_id, uid: registered_status(store, run_id, uid)) as server:
            server.serve_forever()
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception:  # noqa: BLE001 -- D34: no reflected errors or diagnostic logging
        return 2  # fixed exit only; no private path, input or traceback


if __name__ == "__main__":
    raise SystemExit(main())
