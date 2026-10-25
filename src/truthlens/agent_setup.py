"""Human-only, read-only diagnostics and explicit client snippet generation.

No protected source imports, host setup, client-config discovery or auto-fix.
These fixed diagnostics are never an MCP tool result or an isolation certificate.
"""

from __future__ import annotations

import importlib
import importlib.util
import json
import os
import stat
import sys
import tomllib
from pathlib import Path

from truthlens import status_wire as wire
from truthlens.agent_status import DEFAULT_SOCKET, SafeParser

CLIENTS = ("claude-code", "codex", "cursor", "agent-zero")
MAX_CONFIG = 16384


def _socket_argument(value: str) -> str:
    path = Path(value)
    if (
        not path.is_absolute()
        or ".." in path.parts
        or len(os.fsencode(value)) > 100
        or any(ord(c) < 32 or ord(c) == 127 for c in value)
    ):
        raise ValueError("Invalid socket configuration")
    return value


def _config(client: str, socket_path: str) -> dict:
    if client not in CLIENTS:
        raise ValueError("Invalid client configuration")
    socket_path = _socket_argument(socket_path)
    return {
        "mcp_servers" if client == "codex" else "mcpServers": {
            "truthlens": {"command": "truthlens", "args": ["mcp-status", "--socket", socket_path]}
        }
    }


def render_config(client: str, socket_path: str) -> str:
    """Render data arguments, never shell text, URLs, env credentials or commands."""
    doc = _config(client, socket_path)
    if client == "codex":
        # JSON strings/arrays are also TOML strings/arrays for these control-free values.
        args = json.dumps(doc["mcp_servers"]["truthlens"]["args"], ensure_ascii=False)
        return '[mcp_servers.truthlens]\ncommand = "truthlens"\nargs = ' + args + "\n"
    return json.dumps(doc, indent=2, ensure_ascii=False) + "\n"


def valid_config(text: str, client: str, socket_path: str) -> bool:
    """Validate only an exact standalone snippet; no arbitrary existing config scan."""
    try:
        doc = tomllib.loads(text) if client == "codex" else wire.decode(text.encode("utf-8"))
        return doc == _config(client, socket_path)
    except Exception:  # noqa: BLE001 -- fixed diagnosis, never reflect contents
        return False


def _read_config(path: str) -> str:
    # No-follow/nonblocking open plus fstat prevents symlink/FIFO/device surprises.
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > MAX_CONFIG:
            raise ValueError("Invalid config file")
        with os.fdopen(fd, "rb", closefd=False) as source:
            raw = source.read(MAX_CONFIG + 1)
        if len(raw) > MAX_CONFIG:
            raise ValueError("Invalid config file")
        return raw.decode("utf-8", errors="strict")
    finally:
        os.close(fd)


def _socket_safe(path: str) -> bool:
    try:
        value = Path(path)
        wire.trusted_parent(value)
        info = value.lstat()
        return (
            stat.S_ISSOCK(info.st_mode)
            and info.st_uid == wire.BROKER_UID
            and stat.S_IMODE(info.st_mode) == 0o660
        )
    except Exception:  # noqa: BLE001 -- no path or exception reflection
        return False


def _adapter_importable() -> bool:
    # The diagnostic itself must not write import caches, even on a fresh install.
    original = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        importlib.import_module("truthlens.mcp_status")
        return True
    except Exception:  # noqa: BLE001 -- fixed diagnostic
        return False
    finally:
        sys.dont_write_bytecode = original


def _doctor(args) -> int:
    print("SOCKET_METADATA_OK" if _socket_safe(args.socket) else "SOCKET_UNSAFE_OR_MISSING")
    print("ADAPTER_IMPORTABLE" if _adapter_importable() else "ADAPTER_UNAVAILABLE")
    try:
        sdk = all(importlib.util.find_spec(name) is not None for name in ("mcp", "mcp_types", "anyio"))
    except Exception:  # noqa: BLE001 -- fixed diagnostic
        sdk = False
    print("MCP_SDK_PRESENT" if sdk else "MCP_SDK_MISSING")
    try:
        text = (
            _read_config(args.config) if args.config is not None else render_config(args.client, args.socket)
        )
        config_ok = valid_config(text, args.client, args.socket)
    except Exception:  # noqa: BLE001 -- fixed diagnostic
        config_ok = False
    print("CLIENT_CONFIG_VALID" if config_ok else "CLIENT_CONFIG_INVALID")
    # Metadata does not prove key custody, broker reachability, authz, sudo/docker
    # restrictions or reader network denial. This command never probes those.
    print("ISOLATION_UNVERIFIED")
    return 2


def main(command: str, argv: list[str]) -> int:
    parser = SafeParser(prog=f"truthlens {command}", allow_abbrev=False)
    if command == "agent-config":
        parser.add_argument("client", choices=CLIENTS)
        parser.add_argument("--socket", required=True, type=_socket_argument)
        parser.add_argument("--output", help="create a new snippet file; existing files are refused")
    elif command == "doctor":
        parser.add_argument("--socket", default=DEFAULT_SOCKET)
        parser.add_argument("--client", choices=CLIENTS, default="claude-code")
        parser.add_argument("--config", help="check only this standalone snippet, read-only")
    messages = {
        "agent-config": "Client config unavailable.",
        "doctor": "Doctor unavailable.",
        "demo-status": "Demo unavailable.",
    }
    try:
        args = parser.parse_args(argv)
        if command == "doctor":
            return _doctor(args)
        if command == "demo-status":
            from truthlens.demo_status import run_demo

            print(run_demo(), end="")
            return 0
        text = render_config(args.client, args.socket)
        if args.output is None:
            print(text, end="")
        else:
            # Explicit output only; no mkdir, merge, append, overwrite or symlink following.
            fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as target:
                target.write(text)
                target.flush()
                os.fsync(target.fileno())
            print("Client config written.")
        return 0
    except (Exception, KeyboardInterrupt):  # noqa: BLE001 -- fixed messages, never reflected errors
        sys.stderr.write(messages[command] + "\n")
        return 2
