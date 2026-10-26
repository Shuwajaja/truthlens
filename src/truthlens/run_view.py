"""Human run-view projection. Not a ledger, manifest, audit or broker status.

Counts are derived from claim verdicts. A self-declared confirmation is not
evidence. ``integrity=failed`` and inconsistent counts are rejected before a
view can be aggregated. D34 broker status is never computed here.
"""

from __future__ import annotations

import re
from datetime import datetime

from truthlens.manifest import acceptance

SCHEMA = "run-view-v1"
EXECUTIONS = {"queued", "running", "completed", "failed", "cancelled", "interrupted"}
AUDITS = {"pending", "running", "complete", "unavailable"}
INTEGRITIES = {"hash-only", "hmac", "failed", "unknown"}
VERDICTS = {"confirmed", "refuted", "unclear"}
SOURCE_KINDS = {"witnessed_test", "file_diff", "command", "git", "imported", "none"}
_BENCHMARK = re.compile(
    r"benchmark|performance|leistung|%\s*(?:schneller|verbessert)|verbessert", re.IGNORECASE
)


class RunViewRejected(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _stamp(value: str | None) -> str | None:
    if not isinstance(value, str) or not value.endswith("Z"):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.utcoffset() is None or parsed.utcoffset().total_seconds() != 0:
        return None
    millis = parsed.microsecond // 1000
    return parsed.strftime("%Y-%m-%dT%H:%M:%S.") + f"{millis:03d}Z"


def _duration(start: str | None, end: str | None) -> int | None:
    if start is None or end is None:
        return None
    a = datetime.fromisoformat(start)
    b = datetime.fromisoformat(end)
    return max(0, int((b - a).total_seconds() * 1000))


def _counts(claims: list[dict]) -> dict[str, int]:
    counts = {"confirmed": 0, "refuted": 0, "unclear": 0}
    for claim in claims:
        counts[claim["verdict"]] += 1
    return counts


def review_summary(claims: list[dict], execution: str, audit_state: str, integrity: str) -> str:
    """One refuted claim wins. Otherwise anything incomplete or unproven stays unclear."""
    if integrity == "failed":
        raise RunViewRejected("DAMAGED", "Nachweis beschädigt oder inkonsistent")
    if execution not in EXECUTIONS or audit_state not in AUDITS or integrity not in INTEGRITIES:
        raise RunViewRejected("SCHEMA", "Nachweis beschädigt oder inkonsistent")
    if any(claim["verdict"] == "refuted" for claim in claims):
        return "refuted"
    incomplete = execution != "completed" or audit_state != "complete"
    if (
        integrity == "unknown"
        or incomplete
        or not claims
        or any(claim["verdict"] != "confirmed" for claim in claims)
    ):
        return "unclear"
    return "confirmed"


def _latest_decision(events: list[dict]) -> dict[str, tuple[str, dict]]:
    found: dict[str, tuple[str, dict]] = {}
    for event in events:
        if event.get("actor", {}).get("kind") not in {"wrapper", "system"}:
            continue
        payload = event.get("payload") or {}
        decision = None
        if event.get("type") == "test.reported":
            failed, passed = payload.get("failed"), payload.get("passed")
            if type(failed) is int and failed > 0:
                decision = "fail"
            elif type(failed) is int and failed == 0 and type(passed) is int and passed > 0:
                decision = "pass"
        elif event.get("type") == "evidence.attached" and payload.get("result") in {"pass", "fail"}:
            decision = payload["result"]
        if decision is None:
            continue
        for criterion_id in payload.get("criterion_ids") or []:
            found[criterion_id] = (decision, event)
    return found


def _source_kind(event: dict | None, imported: bool) -> str:
    if imported:
        return "imported"
    if event is None:
        return "none"
    if event.get("type") == "test.reported":
        return "witnessed_test"
    payload = event.get("payload") or {}
    kind = str(payload.get("kind") or "")
    refers = str(payload.get("refers_to") or "")
    blob = f"{kind} {refers}".lower()
    if "diff" in blob:
        return "file_diff"
    if "git" in blob:
        return "git"
    if "command" in blob:
        return "command"
    return "none"


def _benchmark_witnessed(events: list[dict], criterion_ids: list[str]) -> bool:
    for event in events:
        if event.get("type") != "test.reported" or event.get("actor", {}).get("kind") not in {
            "wrapper",
            "system",
        }:
            continue
        payload = event.get("payload") or {}
        if not any(item in criterion_ids for item in (payload.get("criterion_ids") or [])):
            continue
        suite = str(payload.get("suite") or "")
        if _BENCHMARK.search(suite):
            return True
    return False


def project_claims(events: list[dict], *, imported: bool = False) -> list[dict]:
    status = {item["criterion_id"]: item["status"] for item in acceptance(events)}
    decisions = _latest_decision(events)
    claims = []
    for event in events:
        if event.get("type") != "agent.claim":
            continue
        payload = event.get("payload") or {}
        text = payload.get("text")
        if not isinstance(text, str) or not text.strip():
            raise RunViewRejected("SCHEMA", "Nachweis beschädigt oder inkonsistent")
        criterion_ids = [item for item in (payload.get("criterion_ids") or []) if isinstance(item, str)]
        linked = [decisions[item] for item in criterion_ids if item in decisions]
        failing = next((item for item in linked if item[0] == "fail"), None)
        benchmark = _BENCHMARK.search(text) is not None
        if failing is not None:
            verdict, witness, reason = "refuted", failing[1], "witnessed_fail"
        elif (
            payload.get("kind") == "completion"
            and criterion_ids
            and all(status.get(item) == "met" for item in criterion_ids)
            and not imported
            and not (benchmark and not _benchmark_witnessed(events, criterion_ids))
        ):
            verdict, witness, reason = "confirmed", linked[-1][1] if linked else None, "witnessed_pass"
        else:
            verdict = "unclear"
            witness = linked[-1][1] if linked else None
            if benchmark and not _benchmark_witnessed(events, criterion_ids):
                reason = "benchmark_missing"
            elif not criterion_ids:
                reason = "no_criteria"
            else:
                reason = "unwitnessed"
        claim_id = payload.get("claim_id") if isinstance(payload.get("claim_id"), str) else event.get("id")
        if not isinstance(claim_id, str) or not claim_id:
            raise RunViewRejected("SCHEMA", "Nachweis beschädigt oder inkonsistent")
        refs = [item["id"] for item in (witness and [witness] or []) if isinstance(item.get("id"), str)]
        claims.append(
            {
                "id": claim_id,
                "text": text,
                "verdict": verdict,
                "evidence_refs": refs,
                "source_kind": _source_kind(witness, imported),
                "scope": ",".join(criterion_ids) if criterion_ids else "claim",
                "reason_code": reason,
            }
        )
    return claims


def project_timeline(events: list[dict], *, imported: bool = False) -> list[dict]:
    rows = []
    for event in events:
        kind = event.get("type")
        payload = event.get("payload") or {}
        stamp = _stamp(event.get("ts"))
        if (
            kind
            not in {
                "run.started",
                "run.finished",
                "test.reported",
                "agent.claim",
                "evidence.attached",
                "artifact.recorded",
            }
            or stamp is None
            or not isinstance(event.get("id"), str)
        ):
            continue
        actor = event.get("actor", {}).get("kind")
        observation = (
            "imported"
            if imported or payload.get("origin") == "imported"
            else ("agent_reported" if actor == "agent" or kind == "agent.claim" else "captured")
        )
        if kind == "run.started":
            title, detail = "Aufgabe gestartet", str(payload.get("command") or payload.get("agent") or "")
        elif kind == "run.finished":
            title, detail = "Aufnahme geschlossen", f"exit {payload.get('exit_code')}"
        elif kind == "test.reported":
            title = "Befehl ausgeführt"
            detail = f"{payload.get('suite', '')} · {payload.get('passed', 0)} passed, {payload.get('failed', 0)} failed"
        elif kind == "agent.claim":
            title, detail = "Agentenbericht", str(payload.get("text") or "")
        elif kind == "artifact.recorded":
            title, detail = "Datei erfasst", str(payload.get("path") or "")
        elif payload.get("kind") == "file_read":
            title, detail = "Dateien gelesen", str(payload.get("path") or "")
        else:
            title, detail = "Beleg erfasst", str(payload.get("refers_to") or payload.get("kind") or "")
        rows.append(
            {
                "id": event["id"],
                "timestamp": stamp,
                "kind": kind,
                "title": title,
                "detail": detail,
                "observation": observation,
            }
        )
    return rows


def _execution(events: list[dict], override: str | None) -> str:
    if override == "interrupted":
        return "interrupted"
    if override in {"queued", "running", "cancelled"} and not any(
        event.get("type") == "run.finished" for event in events
    ):
        return override
    finished = next((event for event in reversed(events) if event.get("type") == "run.finished"), None)
    if finished is None:
        return override if override in EXECUTIONS else "running"
    payload = finished.get("payload") or {}
    status = payload.get("status")
    if status in {"cancelled", "interrupted", "failed"}:
        return status
    code = payload.get("exit_code")
    if type(code) is int and code != 0:
        return "failed"
    return "completed"


def project_run(
    events: list[dict],
    *,
    project_id: str,
    audit_state: str,
    integrity: str,
    task: str | None = None,
    agent_id: str | None = None,
    execution_override: str | None = None,
    audit_revision: str | None = None,
    imported: bool = False,
) -> dict:
    if integrity == "failed":
        raise RunViewRejected("DAMAGED", "Nachweis beschädigt oder inkonsistent")
    if not events or events[0].get("type") != "run.started":
        raise RunViewRejected("SCHEMA", "Nachweis beschädigt oder inkonsistent")
    started = events[0]
    run_id = started.get("run_id")
    if not isinstance(run_id, str) or not run_id or not project_id:
        raise RunViewRejected("SCHEMA", "Nachweis beschädigt oder inkonsistent")
    start_payload = started.get("payload") or {}
    finished = next((event for event in reversed(events) if event.get("type") == "run.finished"), None)
    started_at = _stamp(started.get("ts"))
    finished_at = _stamp(finished.get("ts")) if finished else None
    recorded_task = task or start_payload.get("command") or start_payload.get("agent") or run_id
    if not isinstance(recorded_task, str) or not recorded_task.strip():
        raise RunViewRejected("SCHEMA", "Nachweis beschädigt oder inkonsistent")
    claims = project_claims(events, imported=imported)
    execution = _execution(events, execution_override)
    view = {
        "schema_version": SCHEMA,
        "run_id": run_id,
        "project_id": project_id,
        "task": recorded_task,
        "execution": execution,
        "audit_state": audit_state,
        "integrity": integrity,
        "review_summary": review_summary(claims, execution, audit_state, integrity),
        "claims": claims,
        "timeline": project_timeline(events, imported=imported),
        "counts": _counts(claims),
        "agent_id": agent_id
        if isinstance(agent_id, str) and agent_id
        else (
            start_payload.get("agent")
            if isinstance(start_payload.get("agent"), str) and start_payload.get("agent")
            else None
        ),
        "started_at": started_at,
        "finished_at": finished_at,
        "duration_ms": _duration(started_at, finished_at),
        "git_commit": start_payload.get("ref")
        if isinstance(start_payload.get("ref"), str) and start_payload.get("ref")
        else None,
        "audit_revision": audit_revision,
    }
    return assert_consistent(view)


def assert_consistent(view: dict) -> dict:
    if not isinstance(view, dict) or view.get("schema_version") != SCHEMA:
        raise RunViewRejected("SCHEMA", "Nachweis beschädigt oder inkonsistent")
    if view.get("integrity") == "failed":
        raise RunViewRejected("DAMAGED", "Nachweis beschädigt oder inkonsistent")
    claims = view.get("claims")
    if not isinstance(claims, list) or any(not isinstance(item, dict) for item in claims):
        raise RunViewRejected("SCHEMA", "Nachweis beschädigt oder inkonsistent")
    if any(
        item.get("verdict") not in VERDICTS or item.get("source_kind") not in SOURCE_KINDS for item in claims
    ):
        raise RunViewRejected("SCHEMA", "Nachweis beschädigt oder inkonsistent")
    expected = _counts(claims)
    if view.get("counts") != expected:
        raise RunViewRejected("COUNT_MISMATCH", "Nachweis beschädigt oder inkonsistent")
    summary = review_summary(claims, view.get("execution"), view.get("audit_state"), view.get("integrity"))
    if view.get("review_summary") != summary:
        raise RunViewRejected("SUMMARY_MISMATCH", "Nachweis beschädigt oder inkonsistent")
    return view


def load_declared_view(
    view: dict, events: list[dict] | None = None, *, project_id: str, imported: bool = False
) -> dict:
    """Reject a rosier declaration before it can enter a catalog or UI aggregate."""
    if not isinstance(view, dict):
        raise RunViewRejected("SCHEMA", "Nachweis beschädigt oder inkonsistent")
    if events is None:
        if view.get("review_summary") == "confirmed" or any(
            isinstance(item, dict) and item.get("verdict") == "confirmed" for item in view.get("claims") or []
        ):
            raise RunViewRejected("UNWITNESSED_CONFIRMATION", "Bestätigung ohne prüfbaren Beleg abgelehnt")
        if imported:
            view = dict(view)
            view["audit_state"] = "unavailable"
            view["audit_revision"] = None
            view["task"] = "imported"
            view["review_summary"] = review_summary(
                view.get("claims") or [], view.get("execution"), "unavailable", view.get("integrity")
            )
        return assert_consistent(view)
    started = events[0].get("payload") if events and isinstance(events[0], dict) else None
    recorded_task = started.get("command") if isinstance(started, dict) else None
    recomputed = project_run(
        events,
        project_id=project_id,
        audit_state="unavailable"
        if imported
        else (view.get("audit_state") if view.get("audit_state") in AUDITS else "unavailable"),
        integrity="hash-only"
        if view.get("integrity") == "hmac"
        else (view.get("integrity") if view.get("integrity") in {"hash-only", "unknown"} else "unknown"),
        task=recorded_task if imported else (view.get("task") if isinstance(view.get("task"), str) else None),
        agent_id=view.get("agent_id") if isinstance(view.get("agent_id"), str) else None,
        audit_revision=None
        if imported
        else (view.get("audit_revision") if isinstance(view.get("audit_revision"), str) else None),
        imported=imported,
    )
    declared = {
        (item.get("id"), item.get("verdict")) for item in view.get("claims") or [] if isinstance(item, dict)
    }
    actual = {(item["id"], item["verdict"]) for item in recomputed["claims"]}
    if declared and declared != actual:
        raise RunViewRejected("TAMPERED", "Nachweis beschädigt oder inkonsistent")
    if view.get("integrity") == "hmac":
        recomputed["integrity"] = "hash-only"
        recomputed["review_summary"] = review_summary(
            recomputed["claims"], recomputed["execution"], recomputed["audit_state"], "hash-only"
        )
    return recomputed
