"""Content-addressed blob store (Artifact Manifest v1, D18): blobs are never inline in events.

Layout: <root>/sha256/<aa>/<full-hex>. Writes are atomic (temp + fsync + os.replace) and
idempotent; corrupt existing blobs are repaired through the same write path.
Reads re-hash and fail closed on mismatch.
"""

from __future__ import annotations

import hashlib
import os
import tempfile
from pathlib import Path


class StoreError(RuntimeError):
    pass


class BlobStore:
    def __init__(self, root: str | os.PathLike):
        self.root = Path(root)

    def path(self, sha256: str) -> Path:
        if len(sha256) != 64 or any(c not in "0123456789abcdef" for c in sha256):
            raise StoreError("invalid sha256")
        return self.root / "sha256" / sha256[:2] / sha256

    def put(self, data: bytes) -> str:
        digest = hashlib.sha256(data).hexdigest()
        dest = self.path(digest)
        if dest.exists() and hashlib.sha256(dest.read_bytes()).hexdigest() == digest:
            return digest
        dest.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=dest.parent)
        try:
            with os.fdopen(fd, "wb") as fh:
                fh.write(data)
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(tmp, dest)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)
        return digest

    def get(self, sha256: str) -> bytes:
        data = self.path(sha256).read_bytes()
        if hashlib.sha256(data).hexdigest() != sha256:
            raise StoreError(f"blob {sha256[:12]} corrupted")
        return data
