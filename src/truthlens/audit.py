"""Read-only audit; SPECC v1.2 contract with plan v1.2 implementation interfaces."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

from truthlens import __version__
from truthlens.audit_inputs import DEFAULT_LIMITS, AuditInputError, AuditLimits, SafeRunReader
from truthlens.ledger import verify_bytes
from truthlens.manifest import acceptance, check_manifest
from truthlens.manifest import claims as projected_claims

Outcome = Literal["supported", "contradictory", "not_checkable", "not_applicable"]
HEX = re.compile(r"[0-9a-f]{64}\Z")
SAFE_ID = re.compile(r"(?:(?:run|evt|clm|art|evd)_[0-9A-HJKMNP-TV-Z]{26}|[a-z][0-9]{1,8})\Z")


@dataclass(frozen=True)
class Check:
    rule_id: str
    outcome: Outcome
    required: bool
    message: str
    event_ids: tuple[str, ...] = ()
    criterion_ids: tuple[str, ...] = ()
    expected: int | str | None = None
    actual: int | str | None = None


def _ids(values: object) -> tuple[str, ...]:
    if not isinstance(values, (list, tuple)):
        return ()
    return tuple(sorted({v for v in values if isinstance(v, str) and SAFE_ID.fullmatch(v)}))


def _safe_id(value: object) -> str | None:
    return value if isinstance(value, str) and SAFE_ID.fullmatch(value) else None


def _pairs(pairs: list) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result


def _invalid_number(value: str) -> None:
    raise ValueError("non-integer JSON number")


def _json(data: bytes) -> object:
    return json.loads(
        data, object_pairs_hook=_pairs, parse_float=_invalid_number, parse_constant=_invalid_number
    )


def _references(events: list[dict]) -> set[str]:
    refs = set()
    for event in events:
        p = event["payload"]
        for field in ("sha256", "report_artifact_id"):
            if field in p:
                value = p[field]
                if not isinstance(value, str) or not HEX.fullmatch(value):
                    raise ValueError("invalid content reference")
                refs.add(value)
    return refs


def _blob_path(sha: str) -> str:
    return f"blobs/sha256/{sha[:2]}/{sha}"


def _verified_events(
    reader: SafeRunReader, hmac_key: bytes | None, expected_last_hash: str | None
) -> tuple[list[dict], dict, list[Check]]:
    checks = []
    try:
        raw = reader.read("ledger.jsonl", limit=reader.limits.ledger_bytes)
        if raw.count(b"\n") > reader.limits.event_count:
            raise AuditInputError("resource_limit")
        events = [_json(line) for line in raw.splitlines()]
        if not events or any(
            not isinstance(e, dict) or not isinstance(e.get("payload"), dict) or type(e.get("seq")) is not int
            for e in events
        ):
            raise ValueError("invalid ledger shape")
        for event in events:
            payload = event["payload"]
            if "criterion_ids" in payload and (
                not isinstance(payload["criterion_ids"], list)
                or any(not isinstance(cid, str) for cid in payload["criterion_ids"])
            ):
                raise ValueError("invalid criterion references")
            if event.get("type") == "criteria.confirmed" and (
                not isinstance(payload.get("criteria", []), list)
                or any(not isinstance(c, dict) for c in payload.get("criteria", []))
            ):
                raise ValueError("invalid confirmation shape")
        signed = any("hmac" in e for e in events)
        from truthlens.keys import verification_key

        hmac_key, unavailable = verification_key(hmac_key, events)
        verified = verify_bytes(raw, hmac_key if signed else None)
        if not verified.ok:
            checks.append(Check("TL-AUD-001", "contradictory", True, "Ledger verification failed."))
            if any("approval" in message or "action_hash" in message for _, message in verified.errors):
                checks.append(
                    Check(
                        "TL-AUD-012",
                        "contradictory",
                        True,
                        "Recorded action violates existing approval rules.",
                    )
                )
            auth: Outcome = (
                "contradictory"
                if hmac_key is not None and any("hmac" in message for _, message in verified.errors)
                else "not_checkable"
            )
            checks.append(Check("TL-AUD-003", auth, True, "Authentication could not be established."))
            return [], {}, checks
        checks.append(Check("TL-AUD-001", "supported", True, "Ledger structure and chain checked."))
        has_actions = any(e["type"] == "action.executed" for e in events)
        checks.append(
            Check(
                "TL-AUD-012",
                "supported" if has_actions else "not_applicable",
                has_actions,
                "Existing ledger approval checks applied."
                if has_actions
                else "No recorded action execution requires approval checks.",
            )
        )
        auth = "supported" if signed and hmac_key is not None else "not_checkable"
        checks.append(
            Check(
                "TL-AUD-003", auth, True,
                "HMAC checked." if auth == "supported" else unavailable or "Signature not checked."
            )
        )
        if not verified.anchored:
            checks.append(Check("TL-AUD-001", "not_checkable", True, "Run is not completely closed."))
            return [], {}, checks
        if expected_last_hash is not None and verified.last_hash != expected_last_hash:
            checks.append(Check("TL-AUD-001", "contradictory", True, "External anchor mismatch."))
            return [], {}, checks
        manifest = _json(reader.read("manifest.json", limit=reader.limits.manifest_bytes))
        if (
            not isinstance(manifest, dict)
            or type(manifest.get("manifest_version")) is not int
            or manifest["manifest_version"] != 1
        ):
            raise ValueError("invalid manifest shape")
        bad_counts = [c for c in _counter_checks(events) if c.outcome != "supported"]
        if bad_counts:
            return [], {}, checks + bad_counts
        if check_manifest(manifest, events):
            checks.append(Check("TL-AUD-001", "contradictory", True, "Manifest differs from ledger."))
            return [], {}, checks
        checks.append(Check("TL-AUD-001", "supported", True, "Manifest recomputed from ledger."))
        refs = _references(events)
        if len(refs) > reader.limits.blob_count:
            raise AuditInputError("resource_limit")
        missing = False
        for sha in sorted(refs):
            try:
                data = reader.read(_blob_path(sha), limit=reader.limits.total_bytes)
            except AuditInputError as error:
                if error.code != "input_missing":
                    raise
                missing = True
                checks.append(
                    Check("TL-AUD-002", "contradictory", True, "Referenced content is missing.", expected=sha)
                )
                continue
            if hashlib.sha256(data).hexdigest() != sha:
                missing = True
                checks.append(
                    Check(
                        "TL-AUD-002",
                        "contradictory",
                        True,
                        "Referenced content digest mismatch.",
                        expected=sha,
                    )
                )
        if missing:
            return [], {}, checks
        checks.append(
            Check(
                "TL-AUD-002", "supported", True, "Every referenced content object checked.", actual=len(refs)
            )
        )
        return events, manifest, checks
    except AuditInputError:
        checks.append(
            Check(
                "TL-AUD-001",
                "not_checkable",
                True,
                "Input unavailable, unsafe, unstable or over resource limit.",
            )
        )
    except (ValueError, TypeError, KeyError, AttributeError, RecursionError, OverflowError):
        checks.append(Check("TL-AUD-001", "contradictory", True, "Invalid recorded input."))
    return [], {}, checks


def _counter_checks(events: list[dict]) -> list[Check]:
    checks = []
    for event in events:
        if event["type"] != "test.reported":
            continue
        p = event["payload"]
        missing = any(key not in p for key in ("passed", "failed", "exit_code"))
        invalid = any(
            key in p and (type(p[key]) is not int or (key != "exit_code" and p[key] < 0))
            for key in ("passed", "failed", "skipped", "exit_code")
        )
        outcome: Outcome = "contradictory" if invalid else "not_checkable" if missing else "supported"
        checks.append(
            Check(
                "TL-AUD-009" if missing and not invalid else "TL-AUD-007",
                outcome,
                True,
                "Recorded counter and exit types checked.",
                _ids([event["id"]]),
                _ids(p.get("criterion_ids", [])),
            )
        )
    return checks


def check_test_evidence(events: list[dict], blobs: dict[str, bytes]) -> list[Check]:
    checks = _counter_checks(events)
    for event in events:
        p = event["payload"]
        ids, criteria = _ids([event["id"]]), _ids(p.get("criterion_ids", []))
        changed = p.get("changed")
        if (
            event["type"] == "evidence.attached"
            and p.get("kind") == "test_files_changed"
            and isinstance(changed, list)
            and bool(changed)
        ):
            checks.append(
                Check(
                    "TL-AUD-011",
                    "supported",
                    False,
                    "Protected test-input changes recorded; this alone proves neither forgery nor which test version ran.",
                    ids,
                )
            )
        if event["type"] != "test.reported":
            continue
        checks.append(
            Check(
                "TL-AUD-009",
                "not_checkable",
                False,
                "Raw XML recount is not bound by the export contract.",
                ids,
                criteria,
            )
        )
        if any(
            c.rule_id in ("TL-AUD-007", "TL-AUD-009")
            and c.required
            and c.event_ids == ids
            and c.outcome != "supported"
            for c in checks
        ):
            continue
        passed, failed, code = p["passed"], p["failed"], p["exit_code"]
        conflict = (passed > 0 and failed == 0 and code != 0) or (failed > 0 and code == 0)
        checks.append(
            Check(
                "TL-AUD-006",
                "contradictory" if conflict else "supported",
                True,
                "Recorded counts and exit consistency checked.",
                ids,
                criteria,
            )
        )
        checks.append(
            Check(
                "TL-AUD-010",
                "not_checkable" if passed == failed == 0 else "supported",
                True,
                "Zero-pass or skipped-only output is not a passing check.",
                ids,
                criteria,
            )
        )
        report = blobs.get(p.get("report_artifact_id"))
        suite = p.get("suite")
        outcome: Outcome = "not_checkable"
        header_exit = None
        if isinstance(suite, str) and isinstance(report, bytes):
            prefix = ("$ " + suite + "\nexit ").encode()
            if report.startswith(prefix):
                header = re.match(rb"([+-]?[0-9]{1,12})\r?\n", report[len(prefix) : len(prefix) + 20])
                if header:
                    header_exit = int(header[1])
                    outcome = "supported" if header_exit == code else "contradictory"
        checks.append(
            Check(
                "TL-AUD-009" if outcome == "not_checkable" else "TL-AUD-008",
                outcome,
                True,
                "Original command report header checked; later stdout is inert.",
                ids,
                criteria,
                expected=code,
                actual=header_exit,
            )
        )
    return checks


def _claim_analysis(
    events: list[dict], blocked: dict[str, Outcome]
) -> tuple[list[Check], list[dict], list[dict]]:
    ordered = sorted(events, key=lambda event: event["seq"])
    criteria = acceptance(ordered)
    projections = projected_claims(ordered)
    by_criterion = {c["criterion_id"]: c for c in criteria}
    checks = []
    rows = []
    claim_events = [e for e in ordered if e["type"] == "agent.claim"]
    for event, projection in zip(claim_events, projections, strict=True):
        p = event["payload"]
        refs = p.get("criterion_ids") or []
        failures = [
            by_criterion[c] for c in refs if c in by_criterion and by_criterion[c]["status"] == "unmet"
        ]
        sources = [event["id"]] + [c["evidence"][-1] for c in failures if c["evidence"]]
        if p.get("kind") != "completion":
            outcome: Outcome = "not_checkable"
            message = "Non-completion claim is not semantically verified."
        elif failures:
            outcome, message = "contradictory", "Completion claim contradicts the latest recorded failure."
        elif any(c in blocked for c in refs):
            outcome, message = (
                "not_checkable",
                "Claim cannot be supported by inconsistent or uncheckable test evidence.",
            )
        elif projection["finding"] == "supported":
            outcome, message = "supported", "Completion claim supported within recorded scope."
        else:
            outcome, message = "not_checkable", "Completion claim lacks confirmed passing coverage."
        checks.append(
            Check(
                "TL-AUD-005" if outcome == "contradictory" else "TL-AUD-004",
                outcome,
                True,
                message,
                _ids(sources),
                _ids(refs),
            )
        )
        rows.append(
            {
                "claim_id": _safe_id(p.get("claim_id")),
                "criterion_ids": list(_ids(refs)),
                "projection_finding": projection["finding"],
                "audit_finding": outcome,
            }
        )
    if not claim_events:
        covered = any(c["status"] == "met" and c["criterion_id"] not in blocked for c in criteria)
        checks.append(
            Check(
                "TL-AUD-004",
                "supported" if covered else "not_checkable",
                True,
                "Passing criterion coverage checked; no completion claim exported."
                if covered
                else "No supported completion or passing criterion coverage.",
            )
        )
    public_criteria = [
        {
            "criterion_id": _safe_id(c["criterion_id"]),
            "status": c["status"],
            "evidence": list(_ids(c["evidence"])),
        }
        for c in criteria
    ]
    return checks, sorted(public_criteria, key=serialize_report), sorted(rows, key=serialize_report)


def check_claims(events: list[dict]) -> list[Check]:
    return _claim_analysis(events, {})[0]


def _verifier_digests() -> dict[str, str]:
    names = (
        "__init__.py",
        "cli.py",
        "audit.py",
        "audit_inputs.py",
        "keys.py",
        "canonical.py",
        "ledger.py",
        "manifest.py",
        "redaction.py",
    )
    return {name: hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest() for name in names}


def exit_code(report: dict) -> int:
    return {"supported_within_scope": 0, "contradictory": 1, "not_checkable": 2}[report["conclusion"]]


def serialize_report(report: dict) -> str:
    return json.dumps(report, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)


def audit_run(
    root: Path,
    *,
    hmac_key: bytes | None = None,
    expected_last_hash: str | None = None,
    limits: AuditLimits = DEFAULT_LIMITS,
) -> dict:
    checks: list[Check] = []
    events: list[dict] = []
    digests = {}
    criteria, claims = [], []
    if expected_last_hash is not None and (
        not isinstance(expected_last_hash, str) or not HEX.fullmatch(expected_last_hash)
    ):
        checks.append(Check("TL-AUD-001", "not_checkable", True, "Invalid external anchor configuration."))
    elif hmac_key is not None and (not isinstance(hmac_key, bytes) or not hmac_key):
        checks.append(Check("TL-AUD-003", "not_checkable", True, "Invalid authentication configuration."))
    else:
        try:
            with SafeRunReader(root, limits) as reader:
                events, _, checks = _verified_events(reader, hmac_key, expected_last_hash)
                if events:
                    blobs = {
                        sha: reader.read(_blob_path(sha), limit=limits.total_bytes)
                        for sha in _references(events)
                    }
                    checks.extend(check_test_evidence(events, blobs))
                    blocked = {}
                    for event in events:
                        bad = [
                            c
                            for c in check_test_evidence([event], blobs)
                            if c.required and c.outcome != "supported"
                        ]
                        if bad:
                            for cid in event["payload"].get("criterion_ids", []):
                                blocked[cid] = (
                                    "contradictory"
                                    if any(c.outcome == "contradictory" for c in bad)
                                    else "not_checkable"
                                )
                    claim_checks, criteria, claims = _claim_analysis(events, blocked)
                    checks.extend(claim_checks)
                digests = reader.finish()
        except (AuditInputError, OSError, ValueError):
            checks.append(
                Check(
                    "TL-AUD-001",
                    "not_checkable",
                    True,
                    "Input unavailable, unsafe, unstable or over resource limit.",
                )
            )
            events = []
            criteria, claims = [], []
            checks = [
                Check("TL-AUD-003", "not_checkable", True, "Authentication is not bound to a stable input.")
                if c.rule_id == "TL-AUD-003" and c.outcome == "supported"
                else c
                for c in checks
            ]
    try:
        verifier_digests = _verifier_digests()
    except OSError:
        verifier_digests = {}
        checks.append(Check("TL-AUD-001", "not_checkable", True, "Verifier code provenance unavailable."))
    auth = next((c.outcome for c in checks if c.rule_id == "TL-AUD-003"), "not_checkable")
    contradictory = any(c.outcome == "contradictory" for c in checks)
    gap = any(c.required and c.outcome == "not_checkable" for c in checks)
    conclusion = "contradictory" if contradictory else "not_checkable" if gap else "supported_within_scope"
    integrity = (
        ("hmac" if auth == "supported" else "hash-only")
        if events
        else ("failed" if contradictory else "not_checkable")
    )
    return {
        "audit_version": 1,
        "ruleset_version": "1.0.0",
        "verifier_version": __version__,
        "conclusion": conclusion,
        "integrity": integrity,
        "authentication": auth,
        "run_id": _safe_id(events[0]["run_id"]) if events else None,
        "ledger_last_hash": events[-1]["hash"] if events else None,
        "criteria": criteria,
        "claims": claims,
        "checks": sorted((asdict(c) for c in checks), key=lambda c: serialize_report(c)),
        "input_digests": {"run": digests, "verifier": verifier_digests},
        "limitations": [
            "Integrity is not approval.",
            "Original JUnit XML is not archived and bound; no independent XML recount is claimed.",
            "Semantic test suitability, uncaptured effects and completeness without an independent repository snapshot are not established.",
            "A coherent fabricated report cannot be detected by metadata alone.",
            "Protected installation and read-only snapshot outside worker rights are required.",
        ],
    }
