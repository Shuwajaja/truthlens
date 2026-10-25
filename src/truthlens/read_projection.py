"""Key-free reads of registered snapshots, with no admission or job APIs.

The legacy projection uses the private registry; the D34 published projection
reads only a separately protected publication for one configured Shu view.
Registry permissions and frozen ledger/manifest contracts remain unchanged.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

from truthlens import registry
from truthlens.audit_inputs import AuditInputError, SafeRunReader
from truthlens.canonical import canonical_bytes
from truthlens.export import _summary, build
from truthlens.ledger import verify_bytes

MAX_REGISTRY_BYTES = 4 * 1024 * 1024
MAX_REGISTRY_ROWS = 10000
MAX_REGISTRY_ROW_BYTES = 2 * 1024 * 1024
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
MAX_DOCUMENT_LEDGER_BYTES = 2 * 1024 * 1024
MAX_EVENT_BYTES = 128 * 1024
HEX = re.compile(r"[a-f0-9]{64}\Z")
TOKEN = re.compile(r"[a-f0-9]{32}\Z")
MAX_BLOB_BYTES = 256 * 1024
MAX_AUDIT_BYTES = 2 * 1024 * 1024


def _json(raw: bytes) -> object:
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("duplicate key")
            result[key] = value
        return result

    def invalid(value):
        raise ValueError("non-integer number")

    return json.loads(raw, object_pairs_hook=pairs, parse_float=invalid, parse_constant=invalid)


def _digest(value: object) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def _page(value: int, maximum: int, *, minimum: int = 0) -> None:
    if type(value) is not int or not minimum <= value <= maximum:
        registry.deny()


def _event(event: dict) -> dict:
    return {
        **{key: event[key] for key in ("seq", "id", "ts", "type", "actor", "hash", "payload")},
        "summary": _summary(event),
    }


class ReadProjection:
    """Only read methods; identities and original sessions cannot come from requests."""

    def __init__(self, store: registry.Registry | _PublishedStore, *, uid: int, view_id: str):
        if type(uid) is not int or not 0 <= uid < 4294967295:
            registry.deny()
        if not isinstance(view_id, str) or not registry.ID.fullmatch(view_id):
            registry.deny()
        self.store = store
        self.uid = uid
        self.view_id = view_id
        self.source_id = _digest({"kind": "private-registered-view", "view_id": view_id, "uid": uid})

    def _registrations(self) -> list[dict]:
        """Read a tighter bounded journal without creating files or taking writer locks."""
        try:
            registry.require_root()
            registry.trusted(self.store.root, directory=True, private=True)
            try:
                registry.trusted(self.store.root / "registry.jsonl", private=True)
            except FileNotFoundError:
                return []
            with SafeRunReader(self.store.root) as reader:
                raw = reader.read("registry.jsonl", limit=MAX_REGISTRY_BYTES)
                reader.finish()
            if raw and not raw.endswith(b"\n"):
                registry.deny()
            dispatches, captures = {}, []
            previous = "0" * 64
            for seq, line in enumerate(io.BytesIO(raw), 1):
                line = line.removesuffix(b"\n")
                if seq > MAX_REGISTRY_ROWS or len(line) > MAX_REGISTRY_ROW_BYTES:
                    registry.deny()
                row = _json(line)
                if (
                    not isinstance(row, dict)
                    or type(row.get("seq")) is not int
                    or row["seq"] != seq
                    or row.get("previous") != previous
                    or row.get("event") not in registry.EVENTS
                    or not isinstance(row.get("data"), dict)
                    or canonical_bytes(row) != line
                    or _digest({k: v for k, v in row.items() if k != "hash"}) != row.get("hash")
                ):
                    registry.deny()
                previous = row["hash"]
                data = row["data"]
                if row["event"] == "dispatch":
                    dispatch_id = data.get("dispatch_id")
                    if not isinstance(dispatch_id, str) or not TOKEN.fullmatch(dispatch_id):
                        registry.deny()
                    if dispatch_id in dispatches:
                        registry.deny()
                    dispatches[dispatch_id] = data
                elif row["event"] == "captured":
                    captures.append(data)
            registrations, run_ids = [], set()
            for capture in captures:
                dispatch_id = capture.get("dispatch_id")
                if not isinstance(dispatch_id, str) or not TOKEN.fullmatch(dispatch_id):
                    registry.deny()
                dispatch = dispatches.get(dispatch_id)
                if dispatch is None:
                    registry.deny()
                uids = dispatch.get("authorized_uids")
                if (
                    dispatch.get("origin") != "server_pipeline"
                    or dispatch.get("on_behalf_of") != "Shu"
                    or not isinstance(dispatch.get("session_id"), str)
                    or not TOKEN.fullmatch(dispatch["session_id"])
                    or not isinstance(uids, list)
                    or any(type(uid) is not int or uid < 0 for uid in uids)
                ):
                    registry.deny()
                if self.uid not in uids:
                    continue
                run_id = capture.get("run_id")
                if (
                    not isinstance(run_id, str)
                    or not registry.ID.fullmatch(run_id)
                    or run_id in run_ids
                    or not isinstance(capture.get("registration_id"), str)
                    or not TOKEN.fullmatch(capture["registration_id"])
                    or capture.get("snapshot_id") != dispatch_id
                    or not isinstance(capture.get("ledger_last_hash"), str)
                    or not HEX.fullmatch(capture["ledger_last_hash"])
                    or not isinstance(capture.get("capture_closed_at"), str)
                    or not isinstance(capture.get("input_digests"), dict)
                ):
                    registry.deny()
                run_ids.add(run_id)
                # Take session exclusively from its dispatch, never from capture/request.
                registrations.append({**capture, "session_id": dispatch["session_id"]})
            return registrations
        except (AuditInputError, OSError, ValueError, TypeError, KeyError, RecursionError):
            registry.deny()
        return []

    def _source(self, registration: dict) -> str:
        return _digest(
            {
                "view": self.source_id,
                **{
                    key: registration[key]
                    for key in ("dispatch_id", "session_id", "registration_id", "ledger_last_hash")
                },
            }
        )

    def catalog(self, *, offset: int = 0, limit: int = 50) -> dict:
        _page(offset, MAX_REGISTRY_ROWS)
        _page(limit, 50, minimum=1)
        registrations = self._registrations()
        if offset > len(registrations):
            registry.deny()
        runs = [
            {
                **{
                    key: row[key]
                    for key in ("run_id", "registration_id", "ledger_last_hash", "capture_closed_at")
                },
                "source_id": self._source(row),
            }
            for row in registrations[offset : offset + limit]
        ]
        end = offset + len(runs)
        return {
            "source_id": self.source_id,
            "runs": runs,
            "next_offset": end if end < len(registrations) else None,
        }

    def _snapshot(self, run_id: str, *, document: bool = False) -> tuple[dict, bytes, dict, int]:
        if not isinstance(run_id, str) or not registry.ID.fullmatch(run_id):
            registry.deny()
        matches = [row for row in self._registrations() if row["run_id"] == run_id]
        if len(matches) != 1:
            registry.deny()
        registration = matches[0]
        root = self.store.root / "snapshots" / registration["dispatch_id"]
        try:
            self._trust_snapshot(root)
            with SafeRunReader(root) as reader:
                # Reuse the anchored, no-follow reader; links cannot serve other
                # registered files under an alternate snapshot name.
                for name in ("ledger.jsonl", "manifest.json"):
                    fd = reader._open(name)
                    try:
                        if os.fstat(fd).st_nlink != 1:
                            registry.deny()
                    finally:
                        os.close(fd)
                ledger_limit = MAX_DOCUMENT_LEDGER_BYTES if document else reader.limits.ledger_bytes
                raw = reader.read("ledger.jsonl", limit=ledger_limit)
                manifest_raw = reader.read("manifest.json", limit=reader.limits.manifest_bytes)
                digests = reader.finish()
                if any(registration["input_digests"].get(name) != sha for name, sha in digests.items()):
                    registry.deny()
                count = 0
                for line in io.BytesIO(raw):
                    count += 1
                    if count > reader.limits.event_count or len(line) > MAX_EVENT_BYTES:
                        registry.deny()
            result = verify_bytes(raw)  # no HMAC key: never an authentication claim
            manifest = _json(manifest_raw)
            if (
                not result.ok
                or not result.anchored
                or result.last_hash != registration["ledger_last_hash"]
                or not isinstance(manifest, dict)
                or manifest.get("run_id") != run_id
                or manifest.get("ledger_last_hash") != result.last_hash
                or _json(next(iter(io.BytesIO(raw))))["run_id"] != run_id
            ):
                registry.deny()
            return registration, raw, manifest, count
        except (
            AuditInputError,
            OSError,
            ValueError,
            TypeError,
            KeyError,
            IndexError,
            AttributeError,
            RecursionError,
            StopIteration,
        ):
            registry.deny()
        raise AssertionError("unreachable")

    def _trust_snapshot(self, root: Path) -> None:
        registry.trusted(root, directory=True, private=True)

    def document(self, run_id: str) -> dict:
        registration, raw, manifest, _ = self._snapshot(run_id, document=True)
        try:
            document = build([_json(line) for line in io.BytesIO(raw)], manifest)
            if document.get("integrity") != "hash-only" or document.get("verified") is not False:
                registry.deny()
            response = {"source_id": self._source(registration), "document": document}
            if len(canonical_bytes(response)) > MAX_DOCUMENT_BYTES:
                registry.deny()
            return response
        except (ValueError, TypeError, KeyError, IndexError, AttributeError, RecursionError):
            registry.deny()
        raise AssertionError("unreachable")

    def events(self, run_id: str, *, after_seq: int = 0, limit: int = 100) -> dict:
        _page(after_seq, 100000)
        _page(limit, 100, minimum=1)
        registration, raw, _, count = self._snapshot(run_id)
        if after_seq > count:
            registry.deny()
        selected = []
        try:
            for seq, line in enumerate(io.BytesIO(raw), 1):
                if after_seq < seq <= after_seq + limit:
                    selected.append(_event(_json(line)))
                if seq >= after_seq + limit:
                    break
            end = after_seq + len(selected)
            return {
                "source_id": self._source(registration),
                "events": selected,
                "total": count,
                "next_seq": end,
                "has_more": end < count,
            }
        except (ValueError, TypeError, KeyError, IndexError, AttributeError, RecursionError):
            registry.deny()
        raise AssertionError("unreachable")


def published_trusted(path: Path, *, directory: bool = False) -> None:
    """Root-owned publication may be group-readable, never group-writable.

    This does not weaken private Registry permissions. The publisher and all
    ancestors must remain outside the unprivileged reader's write authority.
    """
    registry.trusted(path, directory=directory)


@dataclass(frozen=True)
class _PublishedStore:
    root: Path


class PublishedReadProjection(ReadProjection):
    """Read a separately published allowlist, without opening the private journal.

    read-index.json is trusted server configuration, not an admission API. Only
    a future privileged publisher/operator may create it from admitted captures.
    No publisher or live setup is provided by this module.
    """

    def __init__(self, root: Path, *, view_id: str):
        # Deliberately do not instantiate Registry: its root-only guard remains.
        super().__init__(_PublishedStore(Path(root)), uid=0, view_id=view_id)

    def _read_published(self, root: Path, name: str, *, limit: int, digest: str | None = None) -> bytes:
        try:
            published_trusted(root, directory=True)
            published_trusted(root / name)
            with SafeRunReader(root) as reader:
                fd = reader._open(name)
                try:
                    if os.fstat(fd).st_nlink != 1:
                        registry.deny()
                finally:
                    os.close(fd)
                raw = reader.read(name, limit=limit)
                reader.finish()
            if digest is not None and hashlib.sha256(raw).hexdigest() != digest:
                registry.deny()
            return raw
        except (AuditInputError, OSError, ValueError, TypeError):
            registry.deny()
        raise AssertionError("unreachable")

    def _registrations(self) -> list[dict]:
        try:
            index = _json(self._read_published(self.store.root, "read-index.json", limit=MAX_REGISTRY_BYTES))
            if (
                not isinstance(index, dict)
                or set(index) != {"version", "runs"}
                or type(index["version"]) is not int
                or index["version"] != 1
                or not isinstance(index["runs"], list)
                or len(index["runs"]) > MAX_REGISTRY_ROWS
            ):
                registry.deny()
            selected, seen = [], set()
            for row in index["runs"]:
                if not isinstance(row, dict) or not isinstance(row.get("view_id"), str):
                    registry.deny()
                if row["view_id"] != self.view_id:
                    continue
                if (
                    not isinstance(row.get("run_id"), str)
                    or not registry.ID.fullmatch(row["run_id"])
                    or row["run_id"] in seen
                    or any(
                        not isinstance(row.get(k), str) or not TOKEN.fullmatch(row[k])
                        for k in ("dispatch_id", "session_id", "registration_id")
                    )
                    or row.get("snapshot_id") != row["dispatch_id"]
                    or not isinstance(row.get("ledger_last_hash"), str)
                    or not HEX.fullmatch(row["ledger_last_hash"])
                    or not isinstance(row.get("capture_closed_at"), str)
                    or len(row["capture_closed_at"]) > 128
                    or not isinstance(row.get("input_digests"), dict)
                ):
                    registry.deny()
                for name, digest in row["input_digests"].items():
                    if (
                        not isinstance(name, str)
                        or name.startswith("/")
                        or any(p in ("", ".", "..") for p in name.split("/"))
                        or not isinstance(digest, str)
                        or not HEX.fullmatch(digest)
                    ):
                        registry.deny()
                if not {"ledger.jsonl", "manifest.json"} <= row["input_digests"].keys():
                    registry.deny()
                audit = row.get("audit")
                if audit is not None and (
                    not isinstance(audit, dict)
                    or set(audit) != {"sha256"}
                    or not isinstance(audit["sha256"], str)
                    or not HEX.fullmatch(audit["sha256"])
                ):
                    registry.deny()
                seen.add(row["run_id"])
                selected.append(row)
            return selected
        except (ValueError, TypeError, KeyError, RecursionError):
            registry.deny()
        raise AssertionError("unreachable")

    def _trust_snapshot(self, root: Path) -> None:
        published_trusted(root, directory=True)
        for name in ("ledger.jsonl", "manifest.json"):
            published_trusted(root / name)

    def artifacts(self, run_id: str) -> dict:
        response = self.document(run_id)
        return {"source_id": response["source_id"], "artifacts": response["document"]["artifacts"]}

    def _blob_references(self, run_id: str) -> tuple[dict, set[str]]:
        registration, raw, _, _ = self._snapshot(run_id, document=True)
        references = set()
        for line in io.BytesIO(raw):
            event = _json(line)
            for key in ("sha256", "report_artifact_id"):
                value = event["payload"].get(key)
                if isinstance(value, str) and HEX.fullmatch(value):
                    references.add(value)
        return registration, references

    def _blob(self, registration: dict, sha: str) -> bytes:
        name = f"blobs/sha256/{sha[:2]}/{sha}"
        if registration["input_digests"].get(name) != sha:
            registry.deny()
        root = self.store.root / "snapshots" / registration["dispatch_id"]
        return self._read_published(root, name, limit=MAX_BLOB_BYTES, digest=sha)

    def blob(self, run_id: str, sha: str) -> bytes:
        if not isinstance(sha, str) or not HEX.fullmatch(sha):
            registry.deny()
        registration, references = self._blob_references(run_id)
        if sha not in references:
            registry.deny()
        return self._blob(registration, sha)

    def blobs(self, run_id: str) -> dict:
        registration, references = self._blob_references(run_id)
        blobs = {}
        if len(references) > 100:
            registry.deny()
        for sha in sorted(references):
            name = f"blobs/sha256/{sha[:2]}/{sha}"
            if name not in registration["input_digests"]:
                registry.deny()
            # Metadata only. Bodies are fetched individually under byte limits.
            blobs[sha] = {"sha256": sha}
        return {"source_id": self._source(registration), "blobs": blobs}

    def audits(self, run_id: str) -> dict:
        from truthlens.status_projection import project_status

        registration, _, _, _ = self._snapshot(run_id, document=True)
        reference = registration.get("audit")
        if reference is None:
            return {"source_id": self._source(registration), "audit": None, "status": project_status(None)}
        sha = reference["sha256"]
        try:
            audit = _json(
                self._read_published(self.store.root, f"audits/{sha}.json", limit=MAX_AUDIT_BYTES, digest=sha)
            )
            if (
                not isinstance(audit, dict)
                or audit.get("run_id") != run_id
                or audit.get("ledger_last_hash") != registration["ledger_last_hash"]
            ):
                registry.deny()
            return {
                "source_id": self._source(registration), "audit": audit,
                "status": project_status(
                    audit, run_id=run_id, ledger_last_hash=registration["ledger_last_hash"],
                    input_digests=registration["input_digests"],
                ),
            }
        except (ValueError, TypeError, RecursionError):
            registry.deny()
        raise AssertionError("unreachable")
