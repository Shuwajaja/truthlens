"""Root-only, read-only inspection. No broker/wire/adapter imports this module.

Preflight emits fixed stage codes; pending emits a bounded operator projection.
No diagnostic state, exception detail or logging enters normal requests.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

from truthlens import pipeline, pipeline_jobs, profile_check, registry

MAX_PENDING = 100
MAX_PENDING_BYTES = 32768
MAX_AGE_SECONDS = 2147483647


def _pending(rows: list[dict]) -> str:
    """Project uncaptured dispatches only; never read run/evidence/key files."""
    captured = set()
    for row in rows:
        if row["event"] == "captured":
            dispatch_id = row["data"].get("dispatch_id")
            if not isinstance(dispatch_id, str) or not registry.ID.fullmatch(dispatch_id):
                registry.deny()
            captured.add(dispatch_id)
    now = datetime.now(UTC)
    seen, pending, truncated = set(), [], False
    for row in rows:
        if row["event"] != "dispatch":
            continue
        data = row["data"]
        dispatch_id, profile = data.get("dispatch_id"), data.get("profile")
        if not isinstance(dispatch_id, str) or not registry.ID.fullmatch(dispatch_id):
            registry.deny()
        if dispatch_id in captured:
            continue
        if not isinstance(profile, str) or not registry.ID.fullmatch(profile):
            registry.deny()
        stamp = row.get("time")
        if not isinstance(stamp, str) or len(stamp) > 32:
            registry.deny()
        recorded = datetime.fromisoformat(stamp)
        if recorded.tzinfo is None:
            registry.deny()
        age = min(MAX_AGE_SECONDS, max(0, int((now - recorded).total_seconds())))
        if dispatch_id in seen:
            continue
        seen.add(dispatch_id)
        if len(pending) == MAX_PENDING:
            truncated = True
            continue
        pending.append(
            {
                "dispatch_id": dispatch_id,
                "profile": profile,
                "age_seconds": age,
                "state": "awaiting_capture",
                "retry": "each_worker_round",
            }
        )
    output = json.dumps({"pending": pending, "truncated": truncated}, separators=(",", ":"))
    if len(output.encode()) + 1 > MAX_PENDING_BYTES:
        registry.deny()
    return output


def main(argv: list[str]) -> int:
    """Diagnose the first failed check, without dispatch, audit, repair or approval."""
    reason = "ROOT_REQUIRED"
    try:
        registry.require_root()  # Both real and effective UID, before parsing or any input read.
        reason = "ARGUMENTS_INVALID"

        class Parser(argparse.ArgumentParser):
            def error(self, message: str) -> None:
                raise ValueError("invalid diagnosis arguments")

        parser = Parser(prog="truthlens pipeline explain", add_help=False, allow_abbrev=False)
        sub = parser.add_subparsers(dest="operation", required=True, parser_class=Parser)
        run = sub.add_parser("run", add_help=False, allow_abbrev=False)
        run.add_argument("--profile", required=True)
        status = sub.add_parser("status", add_help=False, allow_abbrev=False)
        status.add_argument("run_id")
        status.add_argument("--uid", type=int)
        sub.add_parser("pending", add_help=False, allow_abbrev=False)
        args = parser.parse_args(argv)
        if args.operation == "pending":
            reason = "REGISTRY_UNAVAILABLE"
            # records() uses O_RDONLY, creates no files and validates the full journal.
            output = _pending(registry.Registry().records())
            print(output)
            return 0
        reason = "CALLER_IDENTITY_UNAVAILABLE"
        uid = args.uid if args.operation == "status" and args.uid is not None else registry.caller_uid()
        if args.operation == "run":
            reason = "INSTALLATION_UNTRUSTED"
            pipeline.trusted(Path(pipeline.__file__))
            reason = "PROFILE_UNTRUSTED"
            profile, _ = pipeline.load_profile(args.profile)
            reason = "DELEGATION_DENIED"
            pipeline.delegation(profile, uid)
            reason = "COMMAND_UNTRUSTED"
            pipeline.agent_argv(profile.get("command"))
            pipeline.trusted(Path(profile["command"][0]))
            reason = "AGENT_ACCOUNT_UNSAFE"
            gid = pipeline.agent_account()
            reason = "TESTS_INVALID"
            pipeline.profile_tests(profile)
            reason = "REPO_UNTRUSTED"
            repo = Path(profile["repo"])
            pipeline.check_repo(repo, gid)
            reason = "REPO_HEAD_MISSING"
            if not profile_check._has_head(str(repo)):
                raise ValueError("missing HEAD")
        reason = "REGISTRY_UNAVAILABLE"
        store = registry.Registry()
        # Read/validate the journal without creating it or any locks/files.
        store.records()
        if args.operation == "run":
            reason = "KEY_UNREADABLE"
            pipeline.trusted(pipeline.KEY_FILE, private=True)
            pipeline.read_audit_key(pipeline.KEY_FILE, store.root)
        else:
            reason = "RUN_ACCESS_DENIED"
            store.run(args.run_id, uid)
            reason = "STATUS_UNAVAILABLE"
            pipeline_jobs.status(store, args.run_id, uid)
    except Exception:  # noqa: BLE001 -- operator output must never reflect exceptions or input
        print(reason, file=sys.stderr)
        return 2
    print("PREFLIGHT_OK", file=sys.stderr)
    return 0
