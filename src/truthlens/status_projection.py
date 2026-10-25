"""Single status projection for human CLI/viewer/widget and a future broker.

This projects an already-produced audit, never verifies signatures or grants
approval. Callers must supply trusted reports and their independently selected
run/head when reading published snapshots. No input string is returned.
"""

from __future__ import annotations

import re
from typing import Literal, TypedDict


class StatusResult(TypedDict):
    status: Literal["passed", "failed", "not_checkable"]
    reason_code: str


def _unknown(reason: str) -> StatusResult:
    return {"status": "not_checkable", "reason_code": reason}


def project_status(
    report: object,
    *,
    run_id: str | None = None,
    ledger_last_hash: str | None = None,
    state: str = "completed",
    available: bool = True,
) -> StatusResult:
    """Return only a closed status and fixed reason code, without report data."""
    if not available:
        return _unknown("source_unavailable")
    if state != "completed":
        return _unknown(
            "running"
            if state in ("queued", "running")
            else "interrupted"
            if state == "interrupted"
            else "error"
        )
    if report is None:
        return _unknown("source_unavailable")
    if (
        not isinstance(report, dict)
        or type(report.get("audit_version")) is not int
        or report["audit_version"] != 1
    ):
        return _unknown("invalid_report")
    if (run_id is not None and report.get("run_id") != run_id) or (
        ledger_last_hash is not None and report.get("ledger_last_hash") != ledger_last_hash
    ):
        return _unknown("identity_mismatch")
    checks = report.get("checks")
    outcomes = {"supported", "contradictory", "not_checkable", "not_applicable"}
    if not isinstance(checks, list) or not checks or len(checks) > 10000:
        return _unknown("invalid_report")
    for check in checks:
        if (
            not isinstance(check, dict)
            or not isinstance(check.get("rule_id"), str)
            or re.fullmatch(r"TL-AUD-0(?:0[1-9]|1[0-2])", check["rule_id"]) is None
            or type(check.get("required")) is not bool
            or not isinstance(check.get("outcome"), str)
            or check["outcome"] not in outcomes
            or any(
                not isinstance(check.get(key), (list, tuple))
                or any(not isinstance(value, str) for value in check[key])
                for key in ("event_ids", "criterion_ids")
            )
        ):
            return _unknown("invalid_report")
    # Preserve every contradictory check, including repeated or optional rules.
    if any(check["outcome"] == "contradictory" for check in checks):
        return {"status": "failed", "reason_code": "checks_failed"}
    if (
        report.get("conclusion") != "supported_within_scope"
        or any(check["required"] and check["outcome"] != "supported" for check in checks)
        or not {"TL-AUD-001", "TL-AUD-002", "TL-AUD-003", "TL-AUD-004"}.issubset(
            {check["rule_id"] for check in checks if check["required"] and check["outcome"] == "supported"}
        )
    ):
        return _unknown("incomplete_checks")
    if report.get("authentication") != "supported" or report.get("integrity") != "hmac":
        return _unknown("authentication_unchecked")
    if (
        not isinstance(report.get("run_id"), str)
        or not report["run_id"]
        or not isinstance(report.get("ledger_last_hash"), str)
        or re.fullmatch(r"[0-9a-f]{64}", report["ledger_last_hash"]) is None
    ):
        return _unknown("invalid_report")
    criteria = report.get("criteria")
    if not isinstance(criteria, list) or not criteria:
        return _unknown("incomplete_checks")
    event_ids = {eid for check in checks for eid in check["event_ids"]}
    criterion_ids = set()
    for criterion in criteria:
        if (
            not isinstance(criterion, dict)
            or not isinstance(criterion.get("criterion_id"), str)
            or criterion["criterion_id"] in criterion_ids
            or not isinstance(criterion.get("evidence"), list)
            or any(not isinstance(eid, str) or eid not in event_ids for eid in criterion["evidence"])
        ):
            return _unknown("incomplete_checks")
        criterion_ids.add(criterion["criterion_id"])
    if any(cid not in criterion_ids for check in checks for cid in check["criterion_ids"]):
        return _unknown("incomplete_checks")
    return {"status": "passed", "reason_code": "checks_passed"}
