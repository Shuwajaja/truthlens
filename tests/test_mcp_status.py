"""Real stdio framing/SDK checks; no real model client or deployed broker claim."""

import json
import os
import subprocess
import sys

import pytest

UNKNOWN = {"status": "not_checkable"}


def module():
    from truthlens import mcp_status

    return mcp_status


def message(method, params=None, mid=1):
    return {"jsonrpc": "2.0", "id": mid, "method": method, "params": params or {}}


def run_stdio(tmp_path, requests):
    raw = b"".join(json.dumps(m).encode() + b"\n" if isinstance(m, dict) else m for m in requests)
    result = subprocess.run(
        [sys.executable, "-m", "truthlens.cli", "mcp-status", "--socket", str(tmp_path / "absent.sock")],
        input=raw, capture_output=True, timeout=15,
        env={"PATH": os.environ["PATH"], "PYTHONPATH": "src", "LANG": "C.UTF-8"},
    )
    assert result.returncode == 0, result.stderr
    assert result.stderr == b""
    return [json.loads(line) for line in result.stdout.splitlines()]


def handshake():
    return [message("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "synthetic-test", "version": "1"}}), {"jsonrpc": "2.0", "method": "notifications/initialized"}]


def tool_status(reply):
    result = reply["result"]
    assert len(result["content"]) == 1
    assert result["content"][0]["type"] == "text"
    text = result["content"][0]["text"]
    doc = json.loads(text)
    assert set(doc) == {"status"}
    assert text == json.dumps(doc, sort_keys=True, separators=(",", ":"))
    assert "_meta" not in result
    if "structuredContent" in result:
        assert result["structuredContent"] == doc
    return doc


def test_legacy_stdio_handshake_one_tool_and_status_only(tmp_path):
    replies = run_stdio(tmp_path, handshake() + [message("tools/list", mid=2), message("tools/call", {"name": "truthlens_check_status", "arguments": {"run_id": "allowed"}}, mid=3)])
    assert replies[0]["result"]["protocolVersion"] == "2025-06-18"
    assert set(replies[0]["result"]["capabilities"]) == {"tools"}
    tools = replies[1]["result"]["tools"]
    assert [t["name"] for t in tools] == ["truthlens_check_status"]
    assert tools[0]["inputSchema"]["additionalProperties"] is False
    assert tools[0]["annotations"]["readOnlyHint"] is True
    assert tools[0]["annotations"]["destructiveHint"] is False
    assert tools[0]["annotations"]["openWorldHint"] is False
    assert tool_status(replies[2]) == UNKNOWN


def test_modern_stateless_discovery_and_tool(tmp_path):
    meta = {"io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientInfo": {"name": "synthetic-test", "version": "1"}, "io.modelcontextprotocol/clientCapabilities": {}}
    replies = run_stdio(tmp_path, [message("server/discover", {"_meta": meta}), message("tools/call", {"_meta": meta, "name": "truthlens_check_status", "arguments": {"run_id": "allowed"}}, mid=2)])
    assert "error" not in replies[0]
    assert tool_status(replies[1]) == UNKNOWN


@pytest.mark.parametrize("args", [{}, [], None, {"run_id": "../private"}, {"run_id": "https://private"}, {"run_id": "x" * 81}, {"run_id": 1}, {"run_id": "allowed", "path": "/synthetic/private"}, {"run_id": "allowed", "uid": 0}])
def test_tool_invalid_input_never_reaches_client(args, monkeypatch):
    mcp = module()
    monkeypatch.setattr(mcp, "check_status", lambda *a: pytest.fail("invalid input queried broker"))
    assert mcp.call_status("/synthetic/fixed.sock", "truthlens_check_status", args) == UNKNOWN


@pytest.mark.parametrize("name", ["audit", "register", "approve", "run", "repair", "raw", "list_runs", "run_events", "run_report"])
def test_other_tools_have_no_side_effects(name, monkeypatch):
    mcp = module()
    monkeypatch.setattr(mcp, "check_status", lambda *a: pytest.fail("unknown tool queried broker"))
    assert mcp.call_status("/synthetic/fixed.sock", name, {"run_id": "allowed"}) == UNKNOWN


def test_resources_prompts_and_privileged_tools_are_not_exposed(tmp_path):
    methods = ["resources/list", "resources/read", "prompts/list", "prompts/get", "audit", "register", "approve", "run", "repair"]
    replies = run_stdio(tmp_path, handshake() + [message(method, {"uri": "/synthetic/private"}, mid=i + 2) for i, method in enumerate(methods)])
    assert all("error" in reply for reply in replies[1:])
    assert "synthetic/private" not in json.dumps(replies)


@pytest.mark.parametrize("raw", [b'[]\n', b'null\n', b'{\n', b'\xff\n', b'{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"truthlens_check_status","arguments":{"run_id":"allowed","run_id":"private"}}}\n', b'x' * 65537 + b'\n'], ids=["array", "null", "broken-json", "utf8", "duplicate", "oversize"])
def test_malformed_duplicate_oversize_inputs_are_bounded_and_sanitized(tmp_path, raw):
    replies = run_stdio(tmp_path, handshake() + [raw])
    assert "error" in replies[-1]
    assert "private" not in json.dumps(replies)


def test_client_reply_and_exceptions_are_allowlisted(monkeypatch):
    mcp = module()
    marker = "/synthetic/private-key EVENTS EVIDENCE run_id https://private"
    for value in [{"status": "passed", "evidence": marker}, {"status": marker}, None]:
        monkeypatch.setattr(mcp, "check_status", lambda *args: value)
        assert mcp.call_status("/fixed.sock", "truthlens_check_status", {"run_id": "allowed"}) == UNKNOWN

    def broken(*args):
        raise RuntimeError(marker)

    monkeypatch.setattr(mcp, "check_status", broken)
    assert mcp.call_status("/fixed.sock", "truthlens_check_status", {"run_id": "allowed"}) == UNKNOWN


def test_adapter_imports_no_private_source_modules():
    result = subprocess.run([sys.executable, "-c", "import sys; from truthlens import mcp_status; assert not any('truthlens.'+m in sys.modules for m in ['registry','registry_view','pipeline','pipeline_jobs','read_service','read_projection','audit','ledger','manifest','wrapper'])"], capture_output=True, timeout=10)
    assert result.returncode == 0, result.stderr


def test_cli_parser_does_not_echo_private_args(tmp_path):
    result = subprocess.run([sys.executable, "-m", "truthlens.cli", "mcp-status", "--root", "/synthetic/private-key"], capture_output=True, timeout=10)
    assert result.returncode == 2
    assert b"synthetic" not in result.stdout + result.stderr
