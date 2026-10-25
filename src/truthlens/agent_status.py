"""Unprivileged CLI: the existing G1 broker client is the only status source."""

from __future__ import annotations

import argparse

from truthlens import status_client
from truthlens import status_wire as wire

DEFAULT_SOCKET = "/run/truthlens/status.sock"


class SafeParser(argparse.ArgumentParser):
    """Do not let argparse reflect attacker-controlled arguments on stderr."""

    def error(self, message: str) -> None:
        raise ValueError("Invalid configuration")


def main(argv: list[str]) -> int:
    parser = SafeParser(prog="truthlens agent-status", allow_abbrev=False, add_help=False)
    parser.add_argument("run_id")
    parser.add_argument("--socket", default=DEFAULT_SOCKET)
    parser.add_argument("--json", action="store_true")
    result = wire.unknown()
    as_json = "--json" in argv
    try:
        args = parser.parse_args(argv)
        as_json = args.json
        if wire.valid_run_id(args.run_id):
            result = wire.status_only(status_client.check_status(args.socket, args.run_id))
    except (Exception, KeyboardInterrupt):  # noqa: BLE001 -- D34: no reflected errors
        result = wire.unknown()
    print(wire.encode(result).decode() if as_json else result["status"])
    return {"passed": 0, "failed": 1, "not_checkable": 2}[result["status"]]
