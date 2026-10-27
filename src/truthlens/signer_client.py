"""Bounded AF_UNIX client and opt-in MCP adapter. Never loads a signing key."""

from __future__ import annotations

import json
import socket
import sys
from pathlib import Path

from truthlens.canonical import canonical_bytes
from truthlens.signer import MAX_MESSAGE, decode, private_file

SCHEMAS = {
    "start_signed_run": (
        {"harness": {"type": "string"}, "task": {"type": "string"}, "criteria": {"type": "array"}},
        ["harness", "task"],
    ),
    "append_signed_event": (
        {"run_id": {"type": "string"}, "token": {"type": "string"}, "event": {"type": "object"}},
        ["run_id", "token", "event"],
    ),
    "finish_signed_run": (
        {"run_id": {"type": "string"}, "token": {"type": "string"}, "summary": {"type": "string"}},
        ["run_id", "token", "summary"],
    ),
    "signed_run_status": ({"run_id": {"type": "string"}, "token": {"type": "string"}}, ["run_id", "token"]),
}
TOOLS = [
    {
        "name": name,
        "description": "Submit to host signer. Agent reports remain unwitnessed. Integrity is not approval.",
        "inputSchema": {
            "type": "object",
            "properties": props,
            "required": required,
            "additionalProperties": False,
        },
    }
    for name, (props, required) in SCHEMAS.items()
]
OPERATIONS = {"append_signed_event": "append_event", "signed_run_status": "status"}


class Client:
    def __init__(self, path: str, token_file: str | None = None):
        self.path = path
        self.token_file = token_file

    def call(self, name: str, args: dict) -> dict:
        try:
            props, required = SCHEMAS[name]
            if not isinstance(args, dict) or args.keys() - props.keys() or set(required) - args.keys():
                raise ValueError
            req = {**args, "op": OPERATIONS.get(name, name)}
            if self.token_file:
                raw = private_file(Path(self.token_file), 4096).strip()
                if not 32 <= len(raw) <= 4096 or any(c < 33 or c > 126 for c in raw):
                    raise ValueError
                req["caller_token"] = raw.decode("ascii")
            raw = canonical_bytes(req) + b"\n"
            if len(raw) > MAX_MESSAGE:
                raise ValueError
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as conn:
                conn.settimeout(5)
                conn.connect(self.path)
                conn.sendall(raw)
                with conn.makefile("rb") as stream:
                    raw = stream.readline(MAX_MESSAGE + 1)
            if len(raw) > MAX_MESSAGE or not raw.endswith(b"\n"):
                raise ValueError
            response = decode(raw)
            if response.get("ok") is not True or not isinstance(response.get("result"), dict):
                raise ValueError
            return response["result"]
        except Exception:  # noqa: BLE001 -- server/credential errors must never be reflected
            # Do not reflect even an untrusted server's error, credential, or exception.
            raise ValueError("signer request unavailable or rejected") from None


class SigningServer:
    def __init__(self, base, client: Client):
        self.base, self.client = base, client

    def handle(self, msg: object) -> dict | None:
        if isinstance(msg, dict) and msg.get("id") is not None:
            if msg.get("method") == "tools/list":
                response = self.base.handle(msg)
                response["result"]["tools"] = response["result"]["tools"] + TOOLS
                return response
            if msg.get("method") == "tools/call":
                params = msg.get("params")
                if (
                    isinstance(params, dict)
                    and isinstance(params.get("name"), str)
                    and params["name"] in SCHEMAS
                ):
                    try:
                        result = self.client.call(params["name"], params.get("arguments", {}))
                        body = {"content": [{"type": "text", "text": json.dumps(result)}], "isError": False}
                    except ValueError:
                        body = {
                            "content": [{"type": "text", "text": "signer request unavailable or rejected"}],
                            "isError": True,
                        }
                    return {"jsonrpc": "2.0", "id": msg["id"], "result": body}
        return self.base.handle(msg)


def serve(base, client: Client, inp=sys.stdin, out=sys.stdout) -> None:
    server = SigningServer(base, client)
    for line in inp:
        if not line.strip():
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            response = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "parse error"}}
        else:
            response = server.handle(msg)
        if response is not None:
            out.write(json.dumps(response) + "\n")
            out.flush()
