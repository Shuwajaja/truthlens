"""Key-free private reads of registered snapshots, with no admission or job APIs.

The privileged caller supplies a fixed UID and view from protected configuration.
Registry permissions remain unchanged. Bounds are projection limits, not changes
to the frozen ledger/manifest contracts. Blob bodies and audit reports are absent.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import re

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

    def __init__(self, store: registry.Registry, *, uid: int, view_id: str):
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
            registry.trusted(root, directory=True, private=True)
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
