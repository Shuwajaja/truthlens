"""Protected server pipeline journal. No registration endpoint or worker authority."""

from __future__ import annotations

import fcntl
import hashlib
import os
import re
import stat
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

from truthlens.audit import _json, serialize_report
from truthlens.audit_inputs import AuditInputError, SafeRunReader
from truthlens.canonical import canonical_bytes

STATE_ROOT = Path("/var/lib/truthlens")
MAX_JOURNAL = 32 * 1024 * 1024
MAX_AUDIT_REPORT = 8 * 1024 * 1024
ID = re.compile(r"[A-Za-z0-9_-]{1,80}\Z")
EVENTS = {"dispatch", "captured", "queued", "running", "completed", "failed", "interrupted"}


class RegistryError(RuntimeError):
    """Fixed public error: never reflect paths, keys or subprocess output."""


def deny() -> None:
    raise RegistryError("Pipeline unavailable or access denied.")


def require_root() -> None:
    if os.getuid() != 0 or os.geteuid() != 0:
        deny()


def trusted(path: Path, *, directory: bool = False, private: bool = False) -> None:
    """Require a root-owned, non-writable ancestry without symlinks."""
    path = Path(path)
    if not path.is_absolute() or ".." in path.parts:
        deny()
    for current in reversed((path, *path.parents)):
        info = current.lstat()
        if info.st_uid != 0 or info.st_mode & 0o022 or stat.S_ISLNK(info.st_mode):
            deny()
    info = path.lstat()
    if directory != stat.S_ISDIR(info.st_mode):
        deny()
    if not directory and (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1):
        deny()
    if private and info.st_mode & 0o077:
        deny()


def kernel_login_uid() -> int:
    with open("/proc/self/loginuid", encoding="ascii") as stream:
        value = stream.read(32).strip()
    if not value.isdecimal():
        deny()
    return int(value)


def caller_uid() -> int:
    require_root()
    uid = kernel_login_uid()
    sudo_uid = os.environ.get("SUDO_UID")
    if sudo_uid is not None and (not sudo_uid.isdecimal() or int(sudo_uid) != uid):
        deny()
    if 0 <= uid < 4294967295:
        return uid
    # systemd attribution is the service itself, never a guessed human initiator.
    if sudo_uid is None and os.getppid() == 1:
        return 0
    deny()
    return -1


def stamp() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


class Registry:
    def __init__(self, root: Path = STATE_ROOT):
        require_root()
        self.root = Path(root)
        trusted(self.root, directory=True, private=True)

    @contextmanager
    def locked(self, *, create: bool = True):
        require_root()
        trusted(self.root, directory=True, private=True)
        path = self.root / "registry.jsonl"
        try:
            fd = os.open(
                path,
                (os.O_RDWR | os.O_CREAT if create else os.O_RDONLY) | os.O_NOFOLLOW | os.O_CLOEXEC,
                0o600,
            )
        except FileNotFoundError:
            if create:
                raise
            yield -1, []
            return
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
            trusted(path, private=True)
            if os.fstat(fd).st_size > MAX_JOURNAL:
                deny()
            chunks = bytearray()
            while len(chunks) <= MAX_JOURNAL:
                chunk = os.read(fd, min(1048576, MAX_JOURNAL + 1 - len(chunks)))
                if not chunk:
                    break
                chunks.extend(chunk)
            raw = bytes(chunks)
            if len(raw) != os.fstat(fd).st_size:
                deny()
            if len(raw) > MAX_JOURNAL or (raw and not raw.endswith(b"\n")):
                deny()
            rows, previous = [], "0" * 64
            for line in raw.splitlines():
                row = _json(line)
                if not isinstance(row, dict) or row.get("seq") != len(rows) + 1:
                    deny()
                digest = row.get("hash")
                body = {k: v for k, v in row.items() if k != "hash"}
                if (
                    row.get("previous") != previous
                    or row.get("event") not in EVENTS
                    or not isinstance(row.get("data"), dict)
                    or hashlib.sha256(canonical_bytes(body)).hexdigest() != digest
                    or canonical_bytes(row) != line
                ):
                    deny()
                rows.append(row)
                previous = digest
            yield fd, rows
        except (OSError, ValueError, TypeError, KeyError) as error:
            raise RegistryError("Pipeline unavailable or access denied.") from error
        finally:
            os.close(fd)

    def records(self) -> list[dict]:
        with self.locked(create=False) as (_, rows):
            return rows

    def append(self, event: str, data: dict) -> None:
        if event not in EVENTS:
            deny()
        with self.locked() as (fd, rows):
            self._write(fd, rows, event, data)

    def _write(self, fd: int, rows: list[dict], event: str, data: dict) -> None:
        row = {
            "seq": len(rows) + 1,
            "previous": rows[-1]["hash"] if rows else "0" * 64,
            "time": stamp(),
            "event": event,
            "data": data,
        }
        row["hash"] = hashlib.sha256(canonical_bytes(row)).hexdigest()
        encoded = canonical_bytes(row) + b"\n"
        if os.fstat(fd).st_size + len(encoded) > MAX_JOURNAL:
            deny()
        os.lseek(fd, 0, os.SEEK_END)
        view = memoryview(encoded)
        while view:
            written = os.write(fd, view)
            if written <= 0:
                deny()
            view = view[written:]
        os.fsync(fd)
        parent = os.open(self.root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(parent)
        finally:
            os.close(parent)

    def save_report(self, audit_id: str, report: dict) -> dict:
        require_root()
        if not isinstance(audit_id, str) or not re.fullmatch(r"[a-f0-9]{32}", audit_id):
            deny()
        raw = serialize_report(report).encode()
        if len(raw) > MAX_AUDIT_REPORT:
            deny()
        digest = hashlib.sha256(raw).hexdigest()
        reference = {"report_path": f"audits/{audit_id}-{digest}.json", "report_sha256": digest}
        directory = self.root / "audits"
        directory.mkdir(mode=0o700, exist_ok=True)
        trusted(directory, directory=True, private=True)
        path = self.root / reference["report_path"]
        if path.exists():
            self.read_report(audit_id, reference)  # reuse a completed pre-crash write only after checking it
            return reference
        temporary = directory / ("." + uuid.uuid4().hex + ".pending")
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)
        try:
            view = memoryview(raw)
            while view:
                count = os.write(fd, view)
                if count <= 0:
                    deny()
                view = view[count:]
            os.fchmod(fd, 0o400)
            os.fsync(fd)
        finally:
            os.close(fd)
        os.replace(temporary, path)
        for parent in (directory, self.root):
            parent_fd = os.open(parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            try:
                os.fsync(parent_fd)
            finally:
                os.close(parent_fd)
        return reference

    def read_report(self, audit_id: str, reference: dict) -> dict:
        require_root()
        path, digest = reference.get("report_path"), reference.get("report_sha256")
        if (
            not isinstance(audit_id, str)
            or not re.fullmatch(r"[a-f0-9]{32}", audit_id)
            or not isinstance(digest, str)
            or not re.fullmatch(r"[a-f0-9]{64}", digest)
            or path != f"audits/{audit_id}-{digest}.json"
        ):
            deny()
        try:
            trusted(self.root / "audits", directory=True, private=True)
            trusted(self.root / path, private=True)
            with SafeRunReader(self.root) as reader:
                raw = reader.read(path, limit=MAX_AUDIT_REPORT)
                reader.finish()
            if hashlib.sha256(raw).hexdigest() != digest:
                deny()
            report = _json(raw)
            if not isinstance(report, dict):
                deny()
            return report
        except (AuditInputError, OSError, ValueError, TypeError):
            deny()
        return {}  # deny() always raises

    def dispatch(
        self,
        profile: str,
        uid: int,
        on_behalf_of: str,
        authorized_uids: list[int],
        profile_digest: str,
        initiator_name: str | None = None,
    ) -> dict:
        if (
            not ID.fullmatch(profile)
            or type(uid) is not int
            or uid not in authorized_uids
            or on_behalf_of != "Shu"
        ):
            deny()
        data = {
            "dispatch_id": uuid.uuid4().hex,
            "session_id": uuid.uuid4().hex,
            "origin": "server_pipeline",
            "pipeline_id": "truthlens-server-v1",
            "profile": profile,
            "profile_digest": profile_digest,
            "initiator_name": initiator_name,
            "delegation": "protected_profile",
            "launcher_pid": os.getpid(),
            "initiator_uid": uid,
            "on_behalf_of": on_behalf_of,
            "authorized_uids": authorized_uids,
        }
        self.append("dispatch", data)
        return data

    def run(self, run_id: str, uid: int, session_id: str | None = None) -> dict:
        if type(uid) is not int or uid < 0 or not isinstance(run_id, str) or not ID.fullmatch(run_id):
            deny()
        rows = self.records()
        capture = next(
            (r["data"] for r in rows if r["event"] == "captured" and r["data"].get("run_id") == run_id), None
        )
        if capture is None:
            deny()
        dispatch = next(
            (
                r["data"]
                for r in rows
                if r["event"] == "dispatch" and r["data"].get("dispatch_id") == capture.get("dispatch_id")
            ),
            None,
        )
        if (
            dispatch is None
            or dispatch.get("origin") != "server_pipeline"
            or uid not in dispatch.get("authorized_uids", [])
            or (session_id is not None and session_id != dispatch["session_id"])
        ):
            deny()
        return {**dispatch, **capture}

    def queue(self, run_id: str, uid: int, session_id: str | None = None) -> dict:
        registration = self.run(run_id, uid, session_id)
        # Real admission is required before this method; only the privileged
        # pipeline/jobs module calls it. No HTTP/chat registration API exists.
        from truthlens.pipeline import check_snapshot

        report = check_snapshot(self, registration)
        if report["authentication"] != "supported":
            deny()
        identity = hashlib.sha256(
            canonical_bytes(
                {
                    "run_id": run_id,
                    "anchor": registration["ledger_last_hash"],
                    "ruleset": report["ruleset_version"],
                    "verifier": report["input_digests"]["verifier"],
                }
            )
        ).hexdigest()
        with self.locked() as (fd, rows):
            existing = next(
                (r["data"] for r in rows if r["event"] == "queued" and r["data"].get("identity") == identity),
                None,
            )
            if existing:
                return existing
            data = {"audit_id": uuid.uuid4().hex, "run_id": run_id, "identity": identity}
            self._write(fd, rows, "queued", data)
            return data
