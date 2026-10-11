"""truthlens CLI: init / verify / repair (Event Schema v1, D9, D15)."""

from __future__ import annotations

import argparse
import getpass
import os
import sys

from truthlens.ids import new_id
from truthlens.ledger import Ledger, LedgerError, repair, verify


def _key(env: str | None) -> bytes | None:
    if not env:
        return None
    val = os.environ.get(env)
    if not val:
        print(f"error: env var {env} is empty or unset", file=sys.stderr)
        raise SystemExit(2)
    return val.encode()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="truthlens")
    sub = ap.add_subparsers(dest="cmd", required=True)
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
    a = ap.parse_args(argv)

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


if __name__ == "__main__":
    sys.exit(main())
