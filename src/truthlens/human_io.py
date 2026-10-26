"""Stdout/stderr helpers for the human workspace commands.

JSON mode writes exactly one object to stdout. Progress and human text stay
on stderr. Nothing here is an agent-status or legacy MCP response.
"""

from __future__ import annotations

import json
import os
import sys
from typing import TextIO


def json_enabled(argv: list[str]) -> bool:
    return "--json" in argv


def color_enabled(argv: list[str], stream: TextIO | None = None) -> bool:
    if "--no-color" in argv or os.environ.get("NO_COLOR"):
        return False
    target = stream or sys.stdout
    return bool(getattr(target, "isatty", lambda: False)())


def quiet_enabled(argv: list[str]) -> bool:
    return "--quiet" in argv


def reference_enabled() -> bool:
    """Workspace and runs commands stay off unless explicitly enabled.

    The default is ``0`` when ``TRUTHLENS_REFERENCE`` is unset. Only the exact
    value ``1`` turns them on. Every other value, including an empty string,
    leaves them off and the command exits 2. Ledgers are not deleted.
    """
    return os.environ.get("TRUTHLENS_REFERENCE", "0") == "1"


def paint(text: str, code: str, enabled: bool) -> str:
    return f"\033[{code}m{text}\033[0m" if enabled else text


def emit_json(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")


def error_payload(code: str, message: str) -> dict:
    return {"schema_version": 1, "error": {"code": code, "message": message}}


def fail(code: str, message: str, *, as_json: bool, status: int) -> int:
    if as_json:
        emit_json(error_payload(code, message))
    else:
        sys.stderr.write(message + "\n")
    return status
