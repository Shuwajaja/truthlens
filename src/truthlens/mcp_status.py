"""D34 stdio MCP adapter. Only the fixed Unix status client is reachable here."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from truthlens import status_wire as wire
from truthlens.status_client import check_status

MAX_LINE = 65536
INPUT_SCHEMA = {
    "type": "object",
    "properties": {"run_id": {"type": "string", "pattern": "^[A-Za-z0-9_-]{1,80}$"}},
    "required": ["run_id"],
    "additionalProperties": False,
}
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {"status": {"type": "string", "enum": list(wire.STATUSES)}},
    "required": ["status"],
    "additionalProperties": False,
}


def call_status(socket_path: Path | str, name: str, arguments: object) -> dict[str, str]:
    if (
        name != "truthlens_check_status"
        or type(arguments) is not dict
        or set(arguments) != {"run_id"}
        or not wire.valid_run_id(arguments["run_id"])
    ):
        return wire.unknown()
    try:
        return wire.status_only(check_status(socket_path, arguments["run_id"]))
    except Exception:  # noqa: BLE001 -- D34: no reflected errors or diagnostic logging
        return wire.unknown()


def _error(mid: object = None, code: int = -32600) -> dict:
    return {"jsonrpc": "2.0", "id": mid, "error": {"code": code, "message": "Request unavailable"}}


async def serve(socket_path: Path | str) -> None:
    """Use the pinned SDK engine, with a bounded and sanitized stdio transport.

    SDK default stdio reads unbounded lines and permits duplicate JSON keys.
    Only one request is in flight here; neither SDK task dispatch nor the broker
    can accumulate an unbounded submission queue. Malformed/oversized framing
    closes the input after a fixed protocol error.
    """
    import anyio
    import mcp_types as types
    from mcp.server.lowlevel import Server
    from mcp.shared.message import SessionMessage

    # SDK validation/logging must never reflect tool arguments or exception data.
    logger = logging.getLogger("mcp")
    logger.handlers = [logging.NullHandler()]
    logger.propagate = False
    logger.setLevel(logging.CRITICAL)

    async def list_tools(ctx, params):
        return types.ListToolsResult(
            tools=[
                types.Tool(
                    name="truthlens_check_status",
                    description="Read an authorized stored audit status. Integrity is not approval.",
                    input_schema=INPUT_SCHEMA,
                    output_schema=OUTPUT_SCHEMA,
                    annotations=types.ToolAnnotations(
                        read_only_hint=True, destructive_hint=False, open_world_hint=False
                    ),
                )
            ]
        )

    async def call_tool(ctx, params):
        result = await anyio.to_thread.run_sync(call_status, socket_path, params.name, params.arguments)
        return types.CallToolResult(
            content=[types.TextContent(type="text", text=wire.encode(result).decode())]
        )

    server = Server("truthlens-status", version="0.1.0", on_list_tools=list_tools, on_call_tool=call_tool)
    incoming_send, incoming = anyio.create_memory_object_stream(0)
    outgoing, outgoing_receive = anyio.create_memory_object_stream(0)
    ready = anyio.Event()
    ready.set()
    write_lock = anyio.Lock()

    async def emit(value):
        async with write_lock:
            await anyio.to_thread.run_sync(sys.stdout.buffer.write, wire.encode(value) + b"\n")
            await anyio.to_thread.run_sync(sys.stdout.buffer.flush)

    async def read_input():
        nonlocal ready
        async with incoming_send:
            while True:
                await ready.wait()
                raw = await anyio.to_thread.run_sync(sys.stdin.buffer.readline, MAX_LINE + 1)
                if not raw:
                    break
                if len(raw) > MAX_LINE:
                    await emit(_error(code=-32700))
                    break  # never drain an unbounded attacker stream
                try:
                    value = wire.decode(raw)
                    if (
                        type(value) is not dict
                        or value.get("jsonrpc") != "2.0"
                        or not set(value).issubset({"jsonrpc", "id", "method", "params"})
                        or type(value.get("method")) is not str
                        or ("params" in value and type(value["params"]) is not dict)
                    ):
                        raise ValueError()
                    if "id" not in value:
                        # Only the legacy initialization notification is relevant.
                        if value["method"] == "notifications/initialized":
                            msg = types.jsonrpc_message_adapter.validate_python(value, by_name=False)
                            await incoming_send.send(SessionMessage(msg))
                        continue
                    mid = value["id"]
                    if not (type(mid) is int and -(2**31) <= mid < 2**31) and not (
                        isinstance(mid, str) and wire.valid_run_id(mid)
                    ):
                        raise ValueError()
                    method, params = value["method"], value.get("params", {})
                    if method not in {"initialize", "server/discover", "tools/list", "tools/call", "ping"}:
                        await emit(_error(mid, -32601))
                        continue
                    # Strict params before SDK validation; no input reflection.
                    if method == "tools/call" and (
                        not set(params).issubset({"name", "arguments", "_meta"})
                        or params.get("name") != "truthlens_check_status"
                        or type(params.get("arguments")) is not dict
                        or set(params["arguments"]) != {"run_id"}
                        or not wire.valid_run_id(params["arguments"]["run_id"])
                    ):
                        await emit(
                            {
                                "jsonrpc": "2.0",
                                "id": mid,
                                "result": {
                                    "content": [
                                        {"type": "text", "text": wire.encode(wire.unknown()).decode()}
                                    ],
                                    "isError": False,
                                },
                            }
                        )
                        continue
                    msg = types.jsonrpc_message_adapter.validate_python(value, by_name=False)
                except Exception:  # noqa: BLE001 -- D34: no reflected errors or diagnostic logging
                    await emit(_error(code=-32700))
                    continue
                ready = anyio.Event()
                await incoming_send.send(SessionMessage(msg))

    async def write_output():
        async with outgoing_receive:
            async for message in outgoing_receive:
                value = message.message.model_dump(mode="json", by_alias=True, exclude_none=True)
                # SDK errors can carry arbitrary validation input in message/data.
                if "error" in value:
                    value = _error(value.get("id"), value["error"].get("code", -32603))
                if isinstance(value.get("result"), dict):
                    value["result"].pop("_meta", None)
                await emit(value)
                if "id" in value:
                    ready.set()

    async with anyio.create_task_group() as group:
        group.start_soon(read_input)
        group.start_soon(write_output)
        async with incoming, outgoing:
            await server.run(incoming, outgoing, server.create_initialization_options())


def main(argv: list[str] | None = None) -> int:
    class Parser(argparse.ArgumentParser):
        def error(self, message):
            raise ValueError("Invalid adapter configuration")

    parser = Parser(
        prog="truthlens mcp-status",
        description="Status-only stdio MCP; requires a protected broker",
        allow_abbrev=False,
    )
    parser.add_argument("--socket", required=True, type=Path)
    try:
        args = parser.parse_args(argv)
        import anyio

        anyio.run(serve, args.socket)
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception:  # noqa: BLE001 -- D34: no reflected errors or diagnostic logging
        # Missing optional SDK or invalid config must never produce a traceback.
        sys.stderr.write("Status adapter unavailable.\n")
        return 2
