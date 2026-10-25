"""truthlens CLI: init / verify / repair / run / report / project / act / approve."""

from __future__ import annotations

import argparse
import getpass
import json
import os
import sys


def _key(env: str | None) -> bytes | None:
    if not env:
        return None
    val = os.environ.get(env)
    if not val:
        print(f"error: env var {env} is empty or unset", file=sys.stderr)
        raise SystemExit(2)
    return val.encode()


def _audit_anchor(value: str) -> str:
    import re

    if re.fullmatch(r"[0-9a-f]{64}", value) is None:
        raise argparse.ArgumentTypeError("expected a lowercase SHA-256 digest")
    return value


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ["mcp-status"]:
        from truthlens.mcp_status import main as status_main

        return status_main(argv[1:])
    if argv[:1] == ["agent-status"]:
        from truthlens.agent_status import main as agent_status_main

        return agent_status_main(argv[1:])
    if argv and argv[0] in {"doctor", "agent-config", "demo-status"}:
        from truthlens.agent_setup import main as setup_main

        return setup_main(argv[0], argv[1:])
    from truthlens.ids import new_id
    from truthlens.ledger import Ledger, LedgerError, repair, verify

    if argv[:2] == ["audit", "status"]:
        return _audit_status_command(argv[2:])
    ap = argparse.ArgumentParser(prog="truthlens")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("profile", help="read-only operator profile diagnostics (root only)")
    profile_sub = p.add_subparsers(dest="profile_cmd", required=True)
    profile_check = profile_sub.add_parser("check")
    profile_check.add_argument("name_or_path", metavar="NAME|PATH")
    p = sub.add_parser("pipeline", help="protected server pipeline (host setup required)")
    pipeline_sub = p.add_subparsers(dest="pipeline_cmd", required=True)
    run_parser = pipeline_sub.add_parser("run")
    run_parser.add_argument("--profile", required=True)
    pipeline_sub.add_parser("worker")
    private_agent = pipeline_sub.add_parser("_agent", help=argparse.SUPPRESS)
    private_agent.add_argument("--dispatch", required=True)
    for command in ("admit", "status"):
        p = sub.add_parser(command, help="protected server registry; no imports or registration")
        p.add_argument("run_id")
        p.add_argument("--session")
    p = sub.add_parser("audit", help="read-only audit of a completed run")
    p.add_argument("dir")
    p.add_argument("--json", action="store_true")
    p.add_argument("--hmac-key-file", metavar="PATH")
    p.add_argument("--expect-last-hash", metavar="HEX", type=_audit_anchor)
    p = sub.add_parser("init", help="create a ledger with run.started")
    p.add_argument("ledger")
    p.add_argument("--repo", default=os.getcwd())
    p.add_argument("--ref", default="")
    p.add_argument("--command", default="")
    p.add_argument("--agent", default="")
    p = sub.add_parser("verify", help="verify a ledger (fail-closed)")
    p.add_argument("ledger")
    p.add_argument("--hmac-key-env", metavar="VAR")
    p.add_argument("--expect-last-hash", metavar="HEX")
    p = sub.add_parser("repair", help="truncate a torn tail (manual, D9)")
    p.add_argument("ledger")
    p.add_argument("--hmac-key-env", metavar="VAR")
    p.add_argument("--hmac-key-id", metavar="ID")
    p = sub.add_parser("run", help="witness one agent run: truthlens run --out DIR [opts] -- <agent cmd>")
    p.add_argument("--out", required=True)
    p.add_argument("--repo", default=os.getcwd())
    p.add_argument("--criteria", help="JSON file {requirement:{id,text}, criteria:[{id,text,source}]}")
    p.add_argument("--confirm", default="", help="criterion ids the invoking human confirms (D22)")
    p.add_argument("--test", action="append", default=[], metavar="IDS=CMD")
    p.add_argument("--pass-env", action="append", default=[], metavar="VAR")
    p.add_argument("--agent", default="")
    p.add_argument("--timeout", type=int, default=1800)
    p.add_argument("--hmac-key-env", metavar="VAR")
    p.add_argument("--hmac-key-id", metavar="ID")
    p.add_argument("--test-user", help="run witnessed tests as this unix user via sudo -n -u (e.g. tl-agent)")
    p.add_argument("--test-path", help="PATH for witnessed tests (e.g. the test user's venv/bin)")
    p.add_argument("--gate-env", action="append", default=[], metavar="VAR",
                   help="capability only gated actions get (never the agent)")
    p.add_argument("--hmac-key-file", metavar="PATH", help="key file outside repo/out dir (preferred over env)")
    p.add_argument("agent_cmd", nargs=argparse.REMAINDER)
    p = sub.add_parser("mcp-status", help="status-only stdio MCP (protected broker required)")
    p.add_argument("--socket", required=True)
    for command, help_text in (
        ("agent-status", "broker-only status CLI; passed=0, failed=1, not_checkable=2"),
        ("doctor", "read-only human diagnostics; isolation remains unverified"),
        ("agent-config", "print a status-only client snippet, or create an explicit output file"),
        ("demo-status", "synthetic fake-broker demo; no real verification"),
    ):
        sub.add_parser(command, help=help_text)
    p = sub.add_parser("mcp", help="legacy evidence MCP; NOT D34 status-only")
    p.add_argument("--root", required=True)
    p.add_argument("--hmac-key-env", metavar="VAR")
    p = sub.add_parser("request", help="(agent side) ask the running wrapper to execute a gated action")
    p.add_argument("--timeout", type=float, default=30)
    p.add_argument("action", nargs=argparse.REMAINDER)
    p = sub.add_parser("report", help="verify a run dir and print criteria + claims vs witnessed")
    p.add_argument("dir")
    p.add_argument("--hmac-key-env", metavar="VAR")
    p.add_argument("--json", action="store_true")
    p = sub.add_parser("export", help="write viewer JSON with hash-only or HMAC-checked integrity")
    p.add_argument("dir")
    p.add_argument("--hmac-key-env", metavar="VAR")
    p.add_argument("-o", "--output", default="-")
    p = sub.add_parser("project", help="(re)build the SQLite projection of a verified run dir")
    p.add_argument("dir")
    p.add_argument("--hmac-key-env", metavar="VAR")
    p = sub.add_parser("act", help="run a controlled action through the approval gate")
    p.add_argument("ledger")
    p.add_argument("--hmac-key-env", metavar="VAR")
    p.add_argument("--hmac-key-id", metavar="ID")
    p.add_argument("action", nargs=argparse.REMAINDER)
    p = sub.add_parser("approve", help="human approval for one blocked action hash")
    p.add_argument("ledger")
    p.add_argument("action_hash")
    p.add_argument("--hmac-key-env", metavar="VAR")
    p.add_argument("--hmac-key-id", metavar="ID")
    a = ap.parse_args(argv)

    if a.cmd == "profile":
        from truthlens.profile_check import check

        return check(a.name_or_path)

    if a.cmd in ("pipeline", "admit", "status"):
        return _pipeline_command(a)

    if a.cmd == "audit":
        from pathlib import Path

        from truthlens.audit import audit_run, exit_code, serialize_report
        from truthlens.audit_inputs import AuditInputError, read_audit_key

        key = None
        if a.hmac_key_file is not None:
            try:
                key = read_audit_key(Path(a.hmac_key_file), Path(a.dir))
            except AuditInputError:
                # An invalid authentication configuration produces a fixed report,
                # without reading run data or reflecting key contents/paths.
                key = b""
        report = audit_run(Path(a.dir), hmac_key=key, expected_last_hash=a.expect_last_hash)
        print(serialize_report(report) if a.json else report["conclusion"])
        return exit_code(report)

    if a.cmd == "mcp":
        from truthlens.mcp import serve
        serve(a.root, _key(a.hmac_key_env))
        return 0
    if a.cmd == "request":
        from truthlens.gate import request
        box = os.environ.get("TRUTHLENS_GATE_DIR")
        if not box:
            print("error: TRUTHLENS_GATE_DIR not set (not inside truthlens run)", file=sys.stderr)
            return 2
        action = a.action[1:] if a.action[:1] == ["--"] else a.action
        rc, info = request(box, action, a.timeout)
        print(json.dumps(info))
        return rc
    if a.cmd in ("run", "report", "project", "export", "act", "approve"):
        return _w2(a)

    if a.cmd == "init":
        if os.path.exists(a.ledger) and os.path.getsize(a.ledger):
            print("error: ledger exists", file=sys.stderr)
            return 1
        run_id = new_id("run")
        Ledger(a.ledger).append(run_id, {"kind": "system", "id": "truthlens-cli"}, "run.started",
                                {"repo": a.repo, "ref": a.ref, "command": a.command, "agent": a.agent})
        print(run_id)
        return 0
    if a.cmd == "verify":
        r = verify(a.ledger, _key(a.hmac_key_env), a.expect_last_hash)
        if r.ok:
            print(f"OK {r.events} events, {'anchored' if r.anchored else 'unanchored'}")
            return 0
        for n, msg in r.errors:
            print(f"FAIL line {n}: {msg}")
        return 1
    try:
        ev = repair(a.ledger, {"kind": "human", "id": getpass.getuser()},
                    _key(a.hmac_key_env), a.hmac_key_id)
    except LedgerError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    print(f"repaired: removed {ev['payload']['removed_bytes']} bytes, last valid seq {ev['payload']['last_valid_seq']}")
    return 0


def _run_key(a) -> bytes | None:
    """HMAC key for a run. A key file must live outside the agent's repo and the run dir (D17)."""
    from pathlib import Path
    if not a.hmac_key_file:
        print("error: truthlens run requires --hmac-key-file (outside repo and run dir) and --hmac-key-id;"
              " an env var would be readable by the agent via /proc", file=sys.stderr)
        raise SystemExit(2)
    kf = Path(a.hmac_key_file).resolve()
    for d in (Path(a.repo).resolve(), Path(a.out).resolve()):
        if kf == d or d in kf.parents:
            print(f"error: hmac key file must be outside {d}", file=sys.stderr)
            raise SystemExit(2)
    if kf.stat().st_mode & 0o077:
        print("error: hmac key file must be chmod 600", file=sys.stderr)
        raise SystemExit(2)
    return kf.read_bytes().strip()


def _verified_dir(d: str, key: bytes | None):
    from pathlib import Path

    from truthlens.ledger import Ledger, verify
    from truthlens.manifest import check_manifest
    from truthlens.store import BlobStore

    root = Path(d)
    mf = json.loads((root / "manifest.json").read_text())
    r = verify(root / "ledger.jsonl", key, mf.get("ledger_last_hash"))
    if not r.ok:
        return None, [f"line {n}: {m}" for n, m in r.errors]
    events = Ledger(root / "ledger.jsonl").read()
    store = BlobStore(root / "blobs")
    def blob_ok(s: str) -> bool:  # re-hash: swapped artifact bytes must not verify
        import hashlib
        try:
            p = store.path(s)
            return p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest() == s
        except Exception:  # noqa: BLE001  invalid sha / path
            return False
    errs = check_manifest(mf, events, blob_ok)
    for ev in events:  # every stored blob a ledger event points to must match its hash (reports, diffs)
        for k in ("sha256", "report_artifact_id"):
            v = ev.get("payload", {}).get(k)
            if isinstance(v, str) and len(v) == 64:
                try:
                    present = store.path(v).exists()
                except Exception:  # noqa: BLE001
                    present = False
                if present and not blob_ok(v):
                    errs.append(f"blob content mismatch: {v[:12]}")
    return (None, errs) if errs else (events, [])


def _w2(a) -> int:
    from pathlib import Path

    from truthlens import gate, projection
    from truthlens.ledger import Ledger, LedgerError
    from truthlens.manifest import acceptance, claims
    from truthlens.wrapper import RunConfig, parse_test_spec, run

    if a.cmd == "run":
        cmd = a.agent_cmd[1:] if a.agent_cmd[:1] == ["--"] else a.agent_cmd
        if not cmd:
            print("error: missing agent command after --", file=sys.stderr)
            return 2
        cfg = RunConfig(out_dir=Path(a.out), repo=Path(a.repo).resolve(), command=cmd,
                        criteria=json.loads(Path(a.criteria).read_text()) if a.criteria else {},
                        confirm=[c for c in a.confirm.split(",") if c], tests=[parse_test_spec(t) for t in a.test],
                        pass_env=a.pass_env, hmac_key=_run_key(a), hmac_key_id=a.hmac_key_id,
                        gate_env=a.gate_env, test_user=a.test_user, test_path=a.test_path,
                        timeout=a.timeout, agent=a.agent, human=getpass.getuser())
        res = run(cfg)
        print(json.dumps(res))
        if res.get("capture_failed"):
            return 2
        for ev in Ledger(res["ledger"]).read():
            if ev["type"] == "test.reported" and ev.get("payload", {}).get("exit_code") == 125:
                return 125
        return 0
    key = _key(a.hmac_key_env)
    if a.cmd in ("report", "project", "export"):
        events, errs = _verified_dir(a.dir, key)
        if events is None:
            for e in errs:
                print(f"FAIL {e}")
            return 1
        if a.cmd == "export":
            from truthlens import export
            mf = json.loads((Path(a.dir) / "manifest.json").read_text())
            from truthlens.store import BlobStore
            store = BlobStore(Path(a.dir) / "blobs")

            def _rb(sha: str) -> bytes | None:
                try:
                    f = store.path(sha)
                except Exception:  # noqa: BLE001 - invalid sha in a payload -> no content
                    return None
                return f.read_bytes() if f.is_file() and not f.is_symlink() else None
            exported = export.build(events, mf, _rb, hmac_key=key)
            if exported["integrity"] == "failed":
                for error in exported["errors"]:
                    print(f"FAIL {error}")
                return 1
            doc = json.dumps(exported, indent=1)
            if a.output == "-":
                print(doc)
            else:
                Path(a.output).write_text(doc + "\n")
            return 0
        if a.cmd == "project":
            print(projection.build(events, Path(a.dir) / "projection.sqlite"))
            return 0
        acc, cl = acceptance(events), claims(events)
        if a.json:
            print(json.dumps({"criteria": acc, "claims": cl}, indent=2))
            return 0
        print(f"VERIFIED {len(events)} events, anchored, manifest consistent")
        for c in acc:
            print(f"  {c['criterion_id']:<6} {c['status']:<11} {c['text']}  (evidence: {len(c['evidence'])})")
        for c in cl:
            print(f"  claim  {c['finding']:<17} {c['text'][:100]!r} -> {c['criterion_ids']}")
        return 0
    led = Ledger(a.ledger, key, a.hmac_key_id if key else None)
    try:
        if a.cmd == "approve":
            ev = gate.approve(led, getpass.getuser(), a.action_hash)
            print(f"approved until {ev['payload']['expires_at']}")
            return 0
        action = a.action[1:] if a.action[:1] == ["--"] else a.action
        import os
        rc, info = gate.act(led, {"kind": "human", "id": getpass.getuser()}, action, os.getcwd())  # cwd bound
        print(json.dumps(info))
        return rc
    except LedgerError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1




def _audit_status_command(argv: list[str]) -> int:
    """Human-local read-only command; never connects to a service or broker."""
    from pathlib import Path

    from truthlens.audit import audit_run, serialize_report
    from truthlens.audit_inputs import AuditInputError, read_audit_key
    from truthlens.status_projection import project_status

    class StatusParser(argparse.ArgumentParser):
        def error(self, message: str) -> None:
            # argparse's default error reflects arbitrary argument text.
            raise ValueError("invalid status arguments")

    parser = StatusParser(prog="truthlens audit status", description="Local status only; integrity is not approval.")
    parser.add_argument("dir", nargs="?")
    parser.add_argument("--json", action="store_true")
    key_options = parser.add_mutually_exclusive_group()
    key_options.add_argument("--hmac-key-env", metavar="VAR")
    key_options.add_argument("--hmac-key-file", metavar="PATH")
    parser.add_argument("--expect-last-hash", metavar="HEX", type=_audit_anchor)
    try:
        args = parser.parse_args(argv)
    except ValueError:
        result = project_status(None, state="error")
        print(serialize_report(result) if "--json" in argv else "not_checkable · error")
        return 2
    try:
        key = None
        if args.hmac_key_env is not None:
            value = os.environ.get(args.hmac_key_env)
            key = value.encode() if value else b""
        if args.hmac_key_file is not None and args.dir is not None:
            try:
                key = read_audit_key(Path(args.hmac_key_file), Path(args.dir))
            except AuditInputError:
                key = b""
        report = audit_run(Path(args.dir), hmac_key=key, expected_last_hash=args.expect_last_hash) if args.dir else None
        result = project_status(report)
    except (KeyboardInterrupt, InterruptedError):
        result = project_status(None, state="interrupted")
    except (OSError, ValueError, TypeError, RuntimeError):
        result = project_status(None, state="error")
    print(serialize_report(result) if args.json else f"{result['status']} · {result['reason_code']}")
    return {"passed": 0, "failed": 1, "not_checkable": 2}[result["status"]]


def _pipeline_command(args: argparse.Namespace) -> int:
    import subprocess

    from truthlens import pipeline, pipeline_jobs, registry

    try:
        if args.cmd == "pipeline" and args.pipeline_cmd == "_agent":
            from truthlens.pipeline_agent import serve
            return serve(args.dispatch)
        if args.cmd == "pipeline" and args.pipeline_cmd == "run":
            result = pipeline.run_profile(args.profile)
        elif args.cmd == "pipeline":
            registry.require_root()
            pipeline_jobs.drain(registry.Registry())
            result = {"state": "idle", "connection": "not connected"}
        else:
            uid = registry.caller_uid()
            store = registry.Registry()
            if args.cmd == "admit":
                job = store.queue(args.run_id, uid, args.session)
                result = pipeline_jobs.status(store, args.run_id, uid, args.session, audit_id=job["audit_id"])
            else:
                result = pipeline_jobs.status(store, args.run_id, uid, args.session)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (OSError, ValueError, KeyError, TypeError, AttributeError, RuntimeError, subprocess.SubprocessError):
        print(json.dumps({"state": "unavailable", "connection": "not connected",
                          "message": "Pipeline unavailable or access denied."}, sort_keys=True))
        return 2


if __name__ == "__main__":
    sys.exit(main())
