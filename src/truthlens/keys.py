"""Private local HMAC files and secret-free key retirement metadata (POSIX)."""

from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import stat
import sys
from pathlib import Path
from typing import Self

from truthlens.audit_inputs import AuditInputError, SafeRunReader, _read_key_bytes

_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,63}\Z")
_MAX_METADATA = 65536


class KeyError(ValueError):
    """Only fixed, non-secret diagnostics may be used here."""


class ManagedKey(bytes):
    """Existing byte-key APIs plus trusted local IDs; repr never reveals the key."""

    def __new__(cls, value: bytes, key_id: str, retired: tuple[str, ...]) -> Self:
        obj = super().__new__(cls, value)
        obj.key_id = key_id
        obj.retired = retired
        return obj

    def __repr__(self) -> str:
        return "<ManagedKey [REDACTED]>"

    __str__ = __repr__


def default_key_path() -> Path:
    base = os.environ.get("XDG_CONFIG_HOME")
    return (Path(base) if base else Path.home() / ".config") / "truthlens" / "hmac.key"


def _metadata_name(path: Path) -> str:
    return path.name + ".keyring.json"


def _lock(fd: int, *, exclusive: bool) -> None:
    try:
        import fcntl
    except ImportError:
        raise KeyError("error: private key files require POSIX file locking") from None
    fcntl.flock(fd, fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH)


def _metadata(reader: SafeRunReader, name: str) -> dict | None:
    try:
        fd = reader._open(name)
    except AuditInputError as exc:
        if exc.code == "input_missing":
            return None
        raise
    try:
        info = os.fstat(fd)
        if info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_nlink != 1:
            raise KeyError("error: unsafe key metadata")
        if not 1 <= info.st_size <= _MAX_METADATA:
            raise KeyError("error: invalid key metadata")
        raw = os.read(fd, _MAX_METADATA + 1)
        try:
            doc = json.loads(raw)
        except (ValueError, UnicodeError):
            raise KeyError("error: invalid key metadata") from None
        if (
            not isinstance(doc, dict)
            or doc.get("version") != 1
            or not isinstance(doc.get("key_id"), str)
            or not _ID.fullmatch(doc["key_id"])
            or not isinstance(doc.get("retired"), list)
            or any(not isinstance(v, str) or not _ID.fullmatch(v) for v in doc["retired"])
            or doc["key_id"] in doc["retired"]
            or type(doc.get("pending")) is not bool
        ):
            raise KeyError("error: invalid key metadata")
        return doc
    finally:
        os.close(fd)


def read_key_file(path: Path, run_root: Path | None = None) -> bytes:
    """Read a legacy or managed file with owner-only, no-link checks."""
    path = Path(os.path.abspath(path.expanduser()))
    try:
        _check_location(path)
        with SafeRunReader(path.parent) as reader:
            # Lock the directory, not a replaceable key/metadata inode.
            _lock(reader._fd, exclusive=False)
            value = _read_key_bytes(path, run_root)
            doc = _metadata(reader, _metadata_name(path))
            if doc is None:
                return value
            if doc["pending"]:
                raise KeyError("error: key update incomplete; use truthlens key init --force")
            return ManagedKey(value, doc["key_id"], tuple(doc["retired"]))
    except (OSError, ValueError, AuditInputError):
        raise AuditInputError("unsafe_key") from None


def verification_key(key: bytes | None, events: list[dict]) -> tuple[bytes | None, str | None]:
    """Unavailable IDs are gaps, while current-ID signature mismatches still fail."""
    if not isinstance(key, ManagedKey):
        return key, None
    values = [e.get("hmac_key_id") for e in events if "hmac" in e]
    if any(not isinstance(value, str) for value in values):
        return key, None
    ids = set(values)
    if ids == {key.key_id} or not ids:
        return key, None
    retired = sorted(v for v in ids if isinstance(v, str) and v in key.retired)
    if retired:
        return None, f"signed with retired key {retired[0]}; key no longer available"
    return None, "Signing key ID is unavailable; signature not checked."


def _check_location(path: Path) -> None:
    roots = [Path(__file__).resolve().parents[2]]
    if os.environ.get("TRUTHLENS_ROOT"):
        roots.append(Path(os.environ["TRUTHLENS_ROOT"]).resolve())
    if any(path.is_relative_to(root) for root in roots):
        raise KeyError("error: key must live outside repositories and run folders")
    for parent in path.parents:
        if (
            (parent / ".git").exists()
            or (parent / "ledger.jsonl").exists()
            or (parent / "manifest.json").exists()
            or parent.name in {".codex", ".claude", ".cursor", ".gemini", ".agent-zero", ".agents"}
        ):
            raise KeyError("error: key must live outside repositories, agent folders and run folders")


def _private_parent(path: Path) -> None:
    # Walk with no-follow descriptors; mkdir's mode applies to every new ancestor.
    fd = os.open("/", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        for part in path.parts[1:]:
            try:
                os.mkdir(part, 0o700, dir_fd=fd)
            except FileExistsError:
                pass
            nxt = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=fd)
            os.close(fd)
            fd = nxt
        info = os.fstat(fd)
        if info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise KeyError("error: key directory must be owned by this user and chmod 700")
    finally:
        os.close(fd)


def _write(fd: int, name: str, data: bytes, *, replace: bool) -> None:
    temporary = ".truthlens-key-" + secrets.token_hex(12) if replace else name
    handle = os.open(
        temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600, dir_fd=fd
    )
    try:
        with os.fdopen(handle, "wb") as stream:
            os.fchmod(stream.fileno(), 0o600)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        if replace:
            os.replace(temporary, name, src_dir_fd=fd, dst_dir_fd=fd)
        os.fsync(fd)
    finally:
        if replace:
            try:
                os.unlink(temporary, dir_fd=fd)
            except FileNotFoundError:
                pass


def create_key(path: Path, key_id: str | None, *, force: bool = False, rotate: bool = False) -> str:
    """Generate a new secret; retire only IDs, never retain old key bytes."""
    path = Path(os.path.abspath(path.expanduser()))
    _check_location(path)
    key_id = key_id or "key-" + secrets.token_hex(12)
    if not _ID.fullmatch(key_id):
        raise KeyError("error: key ID must be 1-64 ASCII letters, digits, dots, underscores or hyphens")
    _private_parent(path.parent)
    with SafeRunReader(path.parent) as reader:
        fd = reader._fd
        _lock(fd, exclusive=True)
        try:
            info = os.stat(path.name, dir_fd=fd, follow_symlinks=False)
        except FileNotFoundError:
            info = None
        if info and not force and not rotate:
            raise KeyError("error: key exists; use --force to replace it")
        if info and (not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid()):
            raise KeyError("error: refusing unsafe key file")
        doc = _metadata(reader, _metadata_name(path))
        if rotate and (info is None or doc is None or doc["pending"]):
            raise KeyError("error: rotation needs an initialized key; use truthlens key init --force")
        retired = set(doc["retired"]) if doc else set()
        if doc:
            retired.add(doc["key_id"])
        if key_id in retired:
            raise KeyError("error: replacement needs a new, never-used key ID")
        doc = {"version": 1, "key_id": key_id, "retired": sorted(retired), "pending": True}
        pending = json.dumps(doc).encode()
        if len(pending) > _MAX_METADATA:
            raise KeyError("error: key retirement metadata is full")
        # A crash between files leaves pending metadata: reads fail closed.
        _write(fd, _metadata_name(path), pending, replace=True)
        _write(fd, path.name, secrets.token_bytes(32).hex().encode() + b"\n", replace=info is not None)
        doc["pending"] = False
        _write(fd, _metadata_name(path), json.dumps(doc).encode(), replace=True)
    return key_id


def main(argv: list[str]) -> int:
    class Parser(argparse.ArgumentParser):
        def error(self, message: str) -> None:
            self.exit(2, "error: invalid key command arguments\n")

    parser = Parser(prog="truthlens key", allow_abbrev=False)
    sub = parser.add_subparsers(dest="command", required=True, parser_class=Parser)
    init = sub.add_parser("init", allow_abbrev=False)
    init.add_argument("--out", type=Path)
    init.add_argument("--key-id")
    init.add_argument("--force", action="store_true")
    rotate = sub.add_parser("rotate", allow_abbrev=False)
    rotate.add_argument("--key-file", type=Path)
    rotate.add_argument("--key-id")
    args = parser.parse_args(argv)
    path = (
        (args.out or default_key_path())
        if args.command == "init"
        else (args.key_file or Path(os.environ.get("TRUTHLENS_HMAC_KEY_FILE") or default_key_path()))
    )
    try:
        key_id = create_key(
            path, args.key_id, force=getattr(args, "force", False), rotate=args.command == "rotate"
        )
    except KeyError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except (OSError, AuditInputError, ValueError):
        print("error: cannot safely create or update key file", file=sys.stderr)
        return 2
    print(
        f"Path: {path.expanduser().absolute()}\nKey ID: {key_id}\nUse --hmac-key-file {path.expanduser().absolute()}"
    )
    return 0
