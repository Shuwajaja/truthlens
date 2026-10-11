"""Append-only, hash-chained event ledger (Event Schema v1, FROZEN).

Ported from ai-agent-workspace @ ec0868c:core/ledger.py (fail-closed load, single writer,
fsync per append, request_id idempotency) and WERKCommander @ 8103ceb:src/werkcommander/events.py
(sha256 chain + optional HMAC). Changed: envelope per docs/spec/event-schema-v1.md, seq-based chain,
fcntl lock file <ledger>.lock (D10), redaction before hashing (D5), payload cap (D18),
run.finished anchor (D15), approval consumption check (D16).
"""

from __future__ import annotations

import fcntl
import hashlib
import hmac as _hmac
import json
import os
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from truthlens.canonical import CanonicalError, canonical_bytes
from truthlens.ids import new_id
from truthlens.redaction import redact

SCHEMA_VERSION = 1
GENESIS = "0" * 64
MAX_PAYLOAD = 64 * 1024
ACTOR_KINDS = {"agent", "human", "system", "wrapper"}
REQUIRED = {"schema_version", "id", "seq", "ts", "run_id", "actor", "type", "payload", "prev_hash", "hash"}
OPTIONAL = {"hmac", "hmac_key_id", "request_id"}


class LedgerError(RuntimeError):
    """Append refused or ledger invalid (fail-closed)."""


@dataclass
class VerifyResult:
    ok: bool
    errors: list[tuple[int, str]] = field(default_factory=list)
    last_hash: str = GENESIS
    anchored: bool = False
    events: int = 0
    torn_tail_only: bool = False


def _now() -> str:
    t = datetime.now(UTC)
    return t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{t.microsecond // 1000:03d}Z"


def _body_bytes(event: dict) -> bytes:
    return canonical_bytes({k: v for k, v in event.items() if k not in ("hash", "hmac")})


def _hmac_hex(key: bytes, data: bytes) -> str:
    return _hmac.new(key, data, hashlib.sha256).hexdigest()


def _no_float(_s: str) -> Any:
    raise CanonicalError("float value")


def verify(path: str | os.PathLike, hmac_key: bytes | None = None) -> VerifyResult:
    """Verify a ledger file. Fail-closed: every problem is reported with its 1-based line number."""
    try:
        data = Path(path).read_bytes()
    except FileNotFoundError:
        return VerifyResult(ok=False, errors=[(0, "ledger file not found")])
    return verify_bytes(data, hmac_key)


def verify_bytes(data: bytes, hmac_key: bytes | None = None) -> VerifyResult:
    res = VerifyResult(ok=True)
    lines = data.split(b"\n")
    tail = lines.pop()  # b"" if file ends with newline
    prev, run_id, seq = GENESIS, None, 0
    granted: dict[str, dict] = {}
    consumed: set[str] = set()
    last_type = None
    req_ids: set[str] = set()
    crit_ids: dict[str, str] = {}
    finished = False

    def err(n: int, msg: str) -> None:
        res.errors.append((n, msg))

    for n, raw in enumerate(lines, 1):
        try:
            ev = json.loads(raw.decode("utf-8"), parse_float=_no_float, parse_constant=_no_float)
            if not isinstance(ev, dict):
                raise ValueError("not an object")  # noqa: TRY004
        except (ValueError, CanonicalError, UnicodeDecodeError) as e:
            err(n, f"unparseable line ({type(e).__name__})")
            continue
        missing, unknown = REQUIRED - ev.keys(), ev.keys() - REQUIRED - OPTIONAL
        if missing:
            err(n, f"missing envelope field(s): {sorted(missing)}")
            continue
        if unknown:
            err(n, f"unknown envelope field(s): {sorted(unknown)}")
        if ev["schema_version"] != SCHEMA_VERSION:
            err(n, "unsupported schema_version")
        seq += 1
        if ev["seq"] != seq:
            err(n, f"seq gap: expected {seq}, got {ev['seq']}")
            seq = ev["seq"] if isinstance(ev["seq"], int) else seq
        run_id = run_id or ev["run_id"]
        if ev["run_id"] != run_id:
            err(n, "run_id differs from first event")
        if not isinstance(ev["actor"], dict) or ev["actor"].get("kind") not in ACTOR_KINDS:
            err(n, "invalid actor")
        if not isinstance(ev["payload"], dict):
            err(n, "payload is not an object")
            continue
        if ev["prev_hash"] != prev:
            err(n, "prev_hash mismatch")
        try:
            body = _body_bytes(ev)
            if len(canonical_bytes(ev["payload"])) > MAX_PAYLOAD:
                err(n, "payload > 64 KiB")
        except CanonicalError as e:
            err(n, f"not canonical: {e}")
            continue
        if hashlib.sha256(body).hexdigest() != ev["hash"]:
            err(n, "hash mismatch")
        if "hmac" in ev and "hmac_key_id" not in ev:
            err(n, "hmac without hmac_key_id")
        if hmac_key is not None:
            if "hmac" not in ev:
                err(n, "hmac missing (key given)")
            elif not _hmac.compare_digest(_hmac_hex(hmac_key, body), str(ev["hmac"])):
                err(n, "hmac mismatch")
        t, p, kind = ev["type"], ev["payload"], ev["actor"].get("kind") if isinstance(ev["actor"], dict) else None
        if t in ("approval.granted", "criteria.confirmed") and kind != "human":
            err(n, f"{t} requires actor.kind=human")
        if t == "approval.granted":
            granted[ev["id"]] = p
        _check_semantics(t, p, kind, req_ids, crit_ids, lambda m, n=n: err(n, m))
        if finished and t != "ledger.repaired":
            err(n, "event after run.finished (D28)")
        finished = finished or t == "run.finished"
        if t == "action.executed" and p.get("approval_event_id") is not None:
            aid = p["approval_event_id"]
            if aid not in granted or granted[aid].get("action_hash") != p.get("action_hash"):
                err(n, "action.executed without matching approval.granted")
            elif aid in consumed:
                err(n, "approval already consumed")
            consumed.add(aid)
        if t == "run.finished" and p.get("last_hash") != prev:
            err(n, "run.finished.last_hash mismatch")
        prev, last_type = ev["hash"], t
        res.events += 1
    if tail:
        err(len(lines) + 1, "torn tail (partial last line)")
    res.last_hash = prev
    res.ok = not res.errors
    res.anchored = res.ok and last_type == "run.finished"
    res.torn_tail_only = bool(res.errors) and all(m.startswith("torn tail") for _, m in res.errors)
    return res


WITNESSED = {"test.reported", "evidence.attached"}


def _check_semantics(t: str, p: dict, kind: str | None, req_ids: set, crit_ids: dict, err) -> None:
    """D23–D25: criterion authorship, unique ids, resolvable references, text binding, witness actors."""
    if t == "requirement.recorded":
        rid = p.get("requirement_id")
        if rid in req_ids:
            err("duplicate requirement_id (D24)")
        req_ids.add(rid)
    if t == "criterion.recorded":
        cid = p.get("criterion_id")
        if cid in crit_ids:
            err("duplicate criterion_id (D24)")
        if p.get("requirement_id") is not None and p["requirement_id"] not in req_ids:
            err("unknown requirement_id (D24)")
        if p.get("source") == "user" and kind != "human":
            err("criterion source=user requires actor.kind=human (D23)")
        if p.get("source") == "derived" and not p.get("derived_by"):
            err("derived criterion without derived_by")
        crit_ids[cid] = p.get("text_sha256")
        return
    if t == "criteria.confirmed":
        for c in p.get("criteria", []) if isinstance(p.get("criteria"), list) else []:
            if not isinstance(c, dict) or c.get("criterion_id") not in crit_ids:
                err("criteria.confirmed references unknown criterion (D24)")
            elif c.get("text_sha256") != crit_ids[c["criterion_id"]]:
                err("criteria.confirmed text_sha256 mismatch (D24)")
    refs = p.get("criterion_ids")
    if isinstance(refs, list) and any(r not in crit_ids for r in refs):
        err("criterion_ids reference unknown criterion (D24)")
    decisive = t == "test.reported" or (t in WITNESSED and p.get("result") in ("pass", "fail"))
    if decisive and kind not in ("wrapper", "system"):
        err(f"{t} must be witnessed by wrapper|system (D25)")


class Ledger:
    """Single-writer ledger. Every append verifies the file, then writes + fsyncs one line under an exclusive lock."""

    def __init__(self, path: str | os.PathLike, hmac_key: bytes | None = None, hmac_key_id: str | None = None):
        if (hmac_key is None) != (hmac_key_id is None):
            raise LedgerError("hmac_key and hmac_key_id must be given together (D14)")
        self.path = Path(path)
        self.hmac_key, self.hmac_key_id = hmac_key, hmac_key_id

    def _lock(self):
        fh = open(f"{self.path}.lock", "a")  # noqa: SIM115 (held until append finishes)
        fcntl.flock(fh.fileno(), fcntl.LOCK_EX)
        return fh

    def read(self) -> list[dict]:
        if not self.path.exists():
            return []
        return [json.loads(x) for x in self.path.read_bytes().split(b"\n") if x.strip()]

    def append(self, run_id: str, actor: dict, type: str, payload: dict, request_id: str | None = None) -> dict:
        if not isinstance(payload, dict):
            raise LedgerError("payload must be an object")
        if not isinstance(actor, dict) or actor.get("kind") not in ACTOR_KINDS or not actor.get("id"):
            raise LedgerError("actor must be {kind, id}")
        clean = redact(payload)
        try:
            pbytes = canonical_bytes(clean)
        except CanonicalError as e:
            raise LedgerError(f"payload not canonical: {e}") from e
        if len(pbytes) > MAX_PAYLOAD:
            raise LedgerError("payload > 64 KiB (D18)")
        lock = self._lock()
        try:
            if self.path.exists() and self.path.stat().st_size:
                vr = verify(self.path, self.hmac_key)
                if not vr.ok:
                    raise LedgerError(f"ledger invalid, append refused: line {vr.errors[0][0]}: {vr.errors[0][1]}")
                events = self.read()
            else:
                vr, events = VerifyResult(ok=True), []
            if events and events[0]["run_id"] != run_id:
                raise LedgerError("one ledger per run (D1): run_id mismatch")
            if request_id is not None:
                for ev in events:
                    if ev.get("request_id") == request_id:
                        if ev["type"] == type and canonical_bytes(ev["payload"]) == pbytes:
                            return ev
                        raise LedgerError("request_id reused with different payload (D3)")
            ev = {
                "schema_version": SCHEMA_VERSION, "id": new_id("evt"), "seq": len(events) + 1, "ts": _now(),
                "run_id": run_id, "actor": actor, "type": type, "payload": clean, "prev_hash": vr.last_hash,
            }
            if request_id is not None:
                ev["request_id"] = request_id
            if self.hmac_key is not None:
                ev["hmac_key_id"] = self.hmac_key_id
            body = _body_bytes(ev)
            ev["hash"] = hashlib.sha256(body).hexdigest()
            if self.hmac_key is not None:
                ev["hmac"] = _hmac_hex(self.hmac_key, body)
            line = canonical_bytes(ev) + b"\n"
            existing = self.path.read_bytes() if self.path.exists() else b""
            check = verify_bytes(existing + line, self.hmac_key)
            if not check.ok:
                raise LedgerError(f"event violates ledger rules: {check.errors[-1][1]}")
            with open(self.path, "ab") as fh:
                fh.write(line)
                fh.flush()
                os.fsync(fh.fileno())
            return ev
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
            lock.close()


def repair(path: str | os.PathLike, actor: dict) -> dict:
    """D9: manual repair. Truncate a torn tail only, then append ledger.repaired. Raises if other errors exist."""
    p = Path(path)
    vr = verify(p)
    if vr.ok:
        raise LedgerError("nothing to repair")
    if not vr.torn_tail_only:
        raise LedgerError("refusing repair: errors other than torn tail")
    data = p.read_bytes()
    keep = data.rfind(b"\n") + 1
    removed = data[keep:]
    with open(p, "r+b") as fh:
        fh.truncate(keep)
        fh.flush()
        os.fsync(fh.fileno())
    events = Ledger(p).read()
    return Ledger(p).append(events[-1]["run_id"], actor, "ledger.repaired", {
        "removed_bytes": len(removed), "removed_sha256": hashlib.sha256(removed).hexdigest(),
        "last_valid_seq": events[-1]["seq"],
    })
