"""Bounded POSIX snapshot reads; never follows links, repairs or writes inputs."""

from __future__ import annotations

import hashlib
import os
import stat
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Self


@dataclass(frozen=True)
class AuditLimits:
    ledger_bytes: int = 67108864
    manifest_bytes: int = 8388608
    event_count: int = 100000
    blob_count: int = 20000
    total_bytes: int = 536870912

    def __post_init__(self) -> None:
        if any(type(v) is not int or v < 0 for v in vars(self).values()):
            raise ValueError("invalid audit limits")


class AuditInputError(RuntimeError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _stamp(value: os.stat_result) -> tuple[int, ...]:
    return (value.st_dev, value.st_ino, value.st_mode, value.st_size, value.st_mtime_ns, value.st_ctime_ns)


DEFAULT_LIMITS = AuditLimits()


class SafeRunReader:
    def __init__(self, root: Path, limits: AuditLimits = DEFAULT_LIMITS):
        self.root = Path(root)
        self.limits = limits
        self._fd: int | None = None
        self._cache: dict[str, tuple[bytes, tuple[int, ...]]] = {}
        self._digests: dict[str, str] = {}
        self._used = 0

    @property
    def digests(self) -> Mapping[str, str]:
        return MappingProxyType(self._digests)

    def _open_root(self) -> int:
        if os.name != "posix" or not hasattr(os, "O_NOFOLLOW"):
            raise AuditInputError("unsupported_platform")
        flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
        fd = os.open("/" if self.root.is_absolute() else ".", flags)
        try:
            for part in self.root.parts:
                if part in ("/", "."):
                    continue
                if part == "..":
                    raise AuditInputError("unsafe_path")
                nxt = os.open(part, flags, dir_fd=fd)
                os.close(fd)
                fd = nxt
            return fd
        except BaseException:
            os.close(fd)
            raise

    def __enter__(self) -> Self:
        try:
            self._fd = self._open_root()
        except OSError:
            raise AuditInputError("input_unreadable") from None
        return self

    def __exit__(self, *args: object) -> None:
        if self._fd is not None:
            os.close(self._fd)
            self._fd = None

    def _open(self, relative_path: str) -> int:
        if (
            not isinstance(relative_path, str)
            or relative_path.startswith("/")
            or "\x00" in relative_path
            or any(p in ("", ".", "..") for p in relative_path.split("/"))
        ):
            raise AuditInputError("unsafe_path")
        if self._fd is None:
            raise AuditInputError("reader_closed")
        parent = os.dup(self._fd)
        try:
            parts = relative_path.split("/")
            for part in parts[:-1]:
                nxt = os.open(
                    part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=parent
                )
                os.close(parent)
                parent = nxt
            fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC, dir_fd=parent)
            if not stat.S_ISREG(os.fstat(fd).st_mode):
                os.close(fd)
                raise AuditInputError("unsafe_file_type")
            return fd
        except FileNotFoundError:
            raise AuditInputError("input_missing") from None
        except OSError:
            raise AuditInputError("input_unreadable") from None
        finally:
            os.close(parent)

    def _capture(self, name: str, maximum: int) -> tuple[bytes, tuple[int, ...]]:
        fd = self._open(name)
        try:
            before = _stamp(os.fstat(fd))
            if before[3] > maximum:
                raise AuditInputError("resource_limit")
            chunks = []
            size = 0
            while True:
                chunk = os.read(fd, min(65536, maximum - size + 1))
                if not chunk:
                    break
                size += len(chunk)
                if size > maximum:
                    raise AuditInputError("resource_limit")
                chunks.append(chunk)
            if _stamp(os.fstat(fd)) != before or size != before[3]:
                raise AuditInputError("input_changed")
            return b"".join(chunks), before
        except OSError:
            raise AuditInputError("input_unreadable") from None
        finally:
            os.close(fd)

    def read(self, relative_path: str, *, limit: int) -> bytes:
        if type(limit) is not int or limit < 0:
            raise AuditInputError("resource_limit")
        if relative_path in self._cache:
            data = self._cache[relative_path][0]
            if len(data) > limit:
                raise AuditInputError("resource_limit")
            return data
        data, stamp = self._capture(relative_path, min(limit, self.limits.total_bytes - self._used))
        self._cache[relative_path] = (data, stamp)
        self._used += len(data)
        self._digests[relative_path] = hashlib.sha256(data).hexdigest()
        return data

    def finish(self) -> dict[str, str]:
        if self._fd is None:
            raise AuditInputError("reader_closed")
        other = None
        try:
            other = self._open_root()
            a, b = os.fstat(self._fd), os.fstat(other)
            if (a.st_dev, a.st_ino) != (b.st_dev, b.st_ino):
                raise AuditInputError("input_changed")
            for name, (original, stamp) in sorted(self._cache.items()):
                current, current_stamp = self._capture(name, len(original))
                if (
                    current_stamp != stamp
                    or hashlib.sha256(current).digest() != hashlib.sha256(original).digest()
                ):
                    raise AuditInputError("input_changed")
        except (OSError, AuditInputError):
            raise AuditInputError("input_changed") from None
        finally:
            if other is not None:
                os.close(other)
        return dict(sorted(self._digests.items()))


def read_audit_key(path: Path, run_root: Path) -> bytes:
    """Read an external owner-only key; never include its contents in diagnostics."""
    try:
        key_path = Path(os.path.abspath(path))
        root_path = Path(os.path.abspath(run_root))
        if key_path.is_relative_to(root_path):
            raise AuditInputError("unsafe_key")
        with SafeRunReader(root_path):
            pass
        with SafeRunReader(key_path.parent) as reader:
            fd = reader._open(key_path.name)
            try:
                metadata = os.fstat(fd)
                if metadata.st_uid != os.getuid() or metadata.st_mode & 0o077 or metadata.st_nlink != 1:
                    raise AuditInputError("unsafe_key")
                if not 1 <= metadata.st_size <= 4096:
                    raise AuditInputError("unsafe_key")
                value = os.read(fd, 4097)
                if _stamp(metadata) != _stamp(os.fstat(fd)) or len(value) != metadata.st_size:
                    raise AuditInputError("unsafe_key")
                value = value.strip()
                if not value:
                    raise AuditInputError("unsafe_key")
                return value
            finally:
                os.close(fd)
    except (OSError, ValueError):
        raise AuditInputError("unsafe_key") from None
