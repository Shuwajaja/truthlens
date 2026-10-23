"""One persistent privileged audit queue; subprocess failures never become findings."""

from __future__ import annotations

import fcntl
import os
import selectors
import signal
import subprocess
import time
from pathlib import Path

from truthlens.audit import _json, exit_code, serialize_report
from truthlens.pipeline import KEY_FILE, check_snapshot
from truthlens.registry import MAX_AUDIT_REPORT, Registry, RegistryError, deny, trusted

AUDIT_EXECUTABLE = Path("/opt/truthlens/venv/bin/truthlens")
TIMEOUT = 300
MAX_REPORT = MAX_AUDIT_REPORT


class JobError(RuntimeError):
    pass


def _execute(argv: list[str]) -> tuple[int, dict]:
    trusted(AUDIT_EXECUTABLE)
    process = subprocess.Popen(
        argv,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
        cwd="/",
        env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8", "HOME": "/nonexistent"},
    )
    result = bytearray()
    deadline = time.monotonic() + TIMEOUT
    try:
        with selectors.DefaultSelector() as selector:
            selector.register(process.stdout, selectors.EVENT_READ)
            while selector.get_map():
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise JobError()
                for item, _ in selector.select(min(remaining, 1)):
                    chunk = os.read(item.fd, 65536)
                    if not chunk:
                        selector.unregister(item.fileobj)
                    else:
                        result.extend(chunk)
                        if len(result) > MAX_REPORT:
                            raise JobError()
            code = process.wait(timeout=max(0.001, deadline - time.monotonic()))
        report = _json(bytes(result))
        if code not in (0, 1, 2) or not isinstance(report, dict) or exit_code(report) != code:
            raise JobError()
        return code, report
    except (OSError, ValueError, KeyError, subprocess.TimeoutExpired) as error:
        raise JobError() from error
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGKILL)
        process.wait()
        if process.stdout:
            process.stdout.close()


JOB_EVENTS = {"queued", "running", "completed", "failed", "interrupted"}


def _job_states(rows: list[dict]) -> dict[str, tuple[str, dict]]:
    states = {}
    for row in rows:
        job = row["data"]
        if row["event"] in JOB_EVENTS and job.get("audit_id"):
            previous = states.get(job["audit_id"], (None, {}))[1]
            states[job["audit_id"]] = (row["event"], {**previous, **job})
    return states


def drain(store: Registry) -> None:
    fd = os.open(store.root / "worker.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return  # another worker is authoritative
        trusted(store.root / "worker.lock", private=True)
        from truthlens.pipeline import recover_captures

        recover_captures(store)
        rows = store.records()
        for event, job in _job_states(rows).values():
            if event in ("running", "interrupted"):
                if event == "running":
                    store.append("interrupted", job)
                attempt = job.get("attempt", 0)
                if type(attempt) is int and 0 <= attempt < 1:
                    store.append("queued", {**job, "attempt": attempt + 1})
        # Only missing jobs require admission. Never rehash queued or terminal runs.
        known_runs = {r["data"].get("run_id") for r in rows if r["event"] in JOB_EVENTS}
        dispatches, captures = {}, {}
        for row in rows:
            if row["event"] == "dispatch":
                dispatches.setdefault(row["data"]["dispatch_id"], row["data"])
            elif row["event"] == "captured":
                captures.setdefault(row["data"]["run_id"], row["data"])
        for run_id, capture in captures.items():
            if run_id in known_runs:
                continue
            dispatch = dispatches.get(capture["dispatch_id"])
            if dispatch:
                try:
                    store.queue(run_id, dispatch["initiator_uid"])
                except (RegistryError, OSError, ValueError):
                    pass  # remains pending; never fabricate a completed audit
        for event, job in _job_states(store.records()).values():
            if event != "queued":
                continue
            store.append("running", job)
            try:
                dispatch = dispatches[captures[job["run_id"]]["dispatch_id"]]
                registration = store.run(job["run_id"], dispatch["initiator_uid"])
                expected = check_snapshot(store, registration)
                snapshot = store.root / "snapshots" / registration["dispatch_id"]
                argv = [
                    str(AUDIT_EXECUTABLE),
                    "audit",
                    str(snapshot),
                    "--json",
                    "--hmac-key-file",
                    str(KEY_FILE),
                    "--expect-last-hash",
                    registration["ledger_last_hash"],
                ]
                _, report = _execute(argv)
                report = _json(serialize_report(report).encode())
                if serialize_report(report) != serialize_report(expected):
                    raise JobError()
                check_snapshot(store, registration)  # stable after the child finished
                reference = store.save_report(job["audit_id"], report)
                store.append("completed", {**job, **reference})
            except (JobError, RegistryError, OSError, ValueError, KeyError):
                store.append("failed", {**job, "reason": "audit unavailable"})
    finally:
        os.close(fd)


def status(
    store: Registry, run_id: str, uid: int, session_id: str | None = None, *, audit_id: str | None = None
) -> dict:
    registration = store.run(run_id, uid, session_id)
    rows = store.records()
    related = [r for r in rows if r["data"].get("run_id") == run_id]
    jobs = [
        r
        for r in related
        if r["event"] in JOB_EVENTS and (audit_id is None or r["data"].get("audit_id") == audit_id)
    ]
    latest = jobs[-1] if jobs else None
    event = latest["event"] if latest else "pending"
    report = None
    if latest and event == "completed":
        if "report_path" in latest["data"]:
            report = store.read_report(latest["data"]["audit_id"], latest["data"])
        else:
            report = latest["data"].get("report")  # old append-only journals remain readable
        if report is None:
            deny()
    if report is not None and not isinstance(report, dict):
        deny()
    return {
        "run_id": run_id,
        "audit_id": latest["data"].get("audit_id") if latest else None,
        "state": "failed" if event == "interrupted" else event,
        "reason": "interrupted" if event == "interrupted" else None,
        "conclusion": report["conclusion"] if report else None,
        "authentication": report["authentication"] if report else "not_checkable",
        "integrity": report["integrity"] if report else "not_checkable",
        "verified": bool(
            report and report["authentication"] == "supported" and report["integrity"] == "hmac"
        ),
        "initiator_uid": registration["initiator_uid"],
        "on_behalf_of": registration["on_behalf_of"],
        "last_activity": related[-1]["time"] if related else None,
        "connection": "not connected",
        "gateway_identity": "not configured",
        "claim_checks": [c for c in report["checks"] if c["rule_id"] in ("TL-AUD-004", "TL-AUD-005")]
        if report
        else [],
        "limitations": report["limitations"]
        if report
        else ["Final audit pending. Integrity is not approval."],
    }
