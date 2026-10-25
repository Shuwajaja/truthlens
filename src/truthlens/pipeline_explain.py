"""Root-only, read-only preflight. No broker/wire/adapter imports this module.

Only fixed stage codes leave this command. Existing policy functions remain
unchanged; no diagnostic state, exception detail or logging enters normal requests.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from truthlens import pipeline, pipeline_jobs, profile_check, registry


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
        args = parser.parse_args(argv)
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
