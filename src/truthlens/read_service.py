"""Bounded snapshot reader: verification and rendering consume the same bytes."""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
from pathlib import Path

from truthlens.export import build
from truthlens.ledger import verify_bytes
from truthlens.manifest import check_manifest

MAX_FILE = 16 * 1024 * 1024
MAX_TOTAL = 64 * 1024 * 1024


def read_bytes(path: Path, root: Path, limit: int = MAX_FILE) -> bytes:
    root = Path(os.path.abspath(root))
    path = Path(os.path.abspath(path))
    try:
        relative = path.relative_to(root)
    except ValueError:
        raise ValueError("path outside source root") from None
    # Walk each component using directory descriptors: no symlink ancestor or
    # rename can redirect a later open outside the registered source.
    directory = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
    try:
        for component in root.parts[1:] + relative.parts[:-1]:
            child = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=directory)
            os.close(directory)
            directory = child
        fd = os.open(relative.parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
        with os.fdopen(fd, "rb") as stream:
            if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                raise ValueError("source must be a regular file")
            data = stream.read(limit + 1)
        if len(data) > limit:
            raise ValueError("source exceeds size limit")
        return data
    finally:
        os.close(directory)


def read_native(path: str | Path, key: bytes | None = None) -> dict:
    root = Path(path).absolute()
    if root.is_symlink():
        return {"integrity": "failed", "errors": ["symlink native root rejected"]}
    try:
        manifest_bytes = read_bytes(root / "manifest.json", root)
        ledger_bytes = read_bytes(root / "ledger.jsonl", root)
        manifest = json.loads(manifest_bytes)
        result = verify_bytes(ledger_bytes, key)
        errors = [f"line {n}: {message}" for n, message in result.errors]
        if result.last_hash != manifest.get("ledger_last_hash"):
            errors.append("anchor mismatch")
        if errors:
            return {"integrity": "failed", "errors": errors}
        events = [json.loads(line) for line in ledger_bytes.splitlines()]
        blobs: dict[str, bytes] = {}
        total = 0
        for event in events:
            for field in ("sha256", "report_artifact_id"):
                sha = event.get("payload", {}).get(field)
                if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{64}", sha):
                    continue
                target = root / "blobs" / "sha256" / sha[:2] / sha
                if not target.exists():
                    continue
                data = read_bytes(target, root)
                total += len(data)
                if total > MAX_TOTAL:
                    raise ValueError("run blobs exceed total size limit")
                if hashlib.sha256(data).hexdigest() != sha:
                    errors.append("blob content mismatch")
                blobs[sha] = data
        errors.extend(check_manifest(manifest, events, lambda sha: sha in blobs))
        if errors:
            return {"integrity": "failed", "errors": errors}
        doc = build(events, manifest, blobs.get)
        doc.update(integrity="hmac" if key is not None else "hash-only", errors=[])
        return doc
    except (OSError, ValueError, TypeError, KeyError, AttributeError):
        return {"integrity": "failed", "errors": ["invalid or unavailable native snapshot"]}
