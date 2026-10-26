"""Local catalog MCP: read-only tools and the HMAC display gate."""

import io
import json
import os
import shutil
import socket
from pathlib import Path

from truthlens.cli import main
from truthlens.mcp import TOOLS as LEGACY_TOOLS
from truthlens.mcp_local import TOOLS, serve

DEMO = Path(__file__).parent.parent / "demo" / "runs"
KEY = b"sk-test-mcp-catalog"
BANNED = ('"TRUE"', '"FALSE"', "bestätigt", "widerlegt")


def _rpc(root, *msgs, key=None):
    out = io.StringIO()
    serve(str(root), key, io.StringIO("".join(json.dumps(m) + "\n" for m in msgs)), out)
    return [json.loads(line) for line in out.getvalue().splitlines()]


def _call(i, name, **args):
    return {"jsonrpc": "2.0", "id": i, "method": "tools/call", "params": {"name": name, "arguments": args}}


def _body(response):
    return json.loads(response["result"]["content"][0]["text"])


def _signed(parent: Path, *, key: bytes | None):
    from truthlens.ledger import Ledger
    from truthlens.manifest import build_manifest

    root = parent / "runs"
    run = root / "signed"
    run.mkdir(parents=True)
    key_id = "test-key" if key is not None else None
    ledger = Ledger(run / "ledger.jsonl", key, key_id)
    run_id = "run_signed"
    wrapper = {"kind": "wrapper", "id": "w"}
    human = {"kind": "human", "id": "shu"}
    agent = {"kind": "agent", "id": "a"}
    ledger.append(run_id, wrapper, "run.started", {"repo": "local", "ref": "", "command": "true", "agent": "test"})
    ledger.append(run_id, human, "criterion.recorded", {
        "criterion_id": "c1", "text": "page exists", "source": "user",
    })
    ledger.append(run_id, human, "criterion.recorded", {
        "criterion_id": "c2", "text": "mail rejected", "source": "user",
    })
    ledger.append(run_id, wrapper, "test.reported", {
        "suite": "s", "passed": 1, "failed": 0, "criterion_ids": ["c1"],
    })
    ledger.append(run_id, wrapper, "test.reported", {
        "suite": "s", "passed": 0, "failed": 1, "criterion_ids": ["c2"],
    })
    ledger.append(run_id, agent, "agent.claim", {
        "kind": "completion", "claim_id": "k1", "text": "page exists", "criterion_ids": ["c1"],
    })
    ledger.append(run_id, agent, "agent.claim", {
        "kind": "completion", "claim_id": "k2", "text": "mail rejected", "criterion_ids": ["c2"],
    })
    previous = ledger.read()[-1]["hash"]
    ledger.append(run_id, wrapper, "run.finished", {"exit_code": 1, "status": "failed", "last_hash": previous})
    manifest = build_manifest(ledger.read(), {"name": "test"})
    (run / "manifest.json").write_text(json.dumps(manifest))
    return root


def _snapshot(root: Path) -> dict[str, bytes]:
    found = {}
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        current = Path(dirpath)
        dirnames[:] = [name for name in dirnames if not (current / name).is_symlink()]
        for name in filenames:
            path = current / name
            if path.is_symlink():
                continue
            found[str(path.relative_to(root))] = path.read_bytes()
    return found


def test_catalog_tools_are_separate_from_legacy_and_status():
    assert {tool["name"] for tool in TOOLS} == {"list_runs", "get_run", "verify_run", "doctor"}
    assert {tool["name"] for tool in LEGACY_TOOLS} == {"list_runs", "run_report", "run_events"}
    assert "truthlens_check_status" not in {tool["name"] for tool in TOOLS}


def test_hash_only_demo_stays_unknown_and_does_not_write(tmp_path):
    root = tmp_path / "root"
    shutil.copytree(DEMO / "demo-2", root / "demo-2")
    before = _snapshot(root)
    replies = _rpc(
        root,
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
        _call(3, "list_runs"),
        _call(4, "get_run", run="demo-2"),
        _call(5, "verify_run", path="demo-2/ledger.jsonl"),
        _call(6, "doctor"),
        _call(7, "get_run", run="../etc"),
    )
    assert [item["id"] for item in replies] == [1, 2, 3, 4, 5, 6, 7]
    assert {tool["name"] for tool in replies[1]["result"]["tools"]} == {
        "list_runs", "get_run", "verify_run", "doctor",
    }
    assert _body(replies[2]) == {"runs": ["demo-2"]}
    report = _body(replies[3])
    assert report["integrity"] == "hash-only"
    assert report["verified"] is False
    assert report["verdict"] == "UNKNOWN"
    assert report["label_de"] == "unklar"
    assert report["claims"] and report["evidence"]
    assert {row["verdict"] for row in report["claims"]} == {"UNKNOWN"}
    assert {row["verdict"] for row in report["criteria"]} == {"UNKNOWN"}
    rendered = json.dumps(report, ensure_ascii=False)
    for banned in BANNED:
        assert banned not in rendered
    checked = _body(replies[4])
    assert checked["integrity"] == "hash-only"
    assert checked["verdict"] == "UNKNOWN"
    assert "claims" not in checked
    doctor = _body(replies[5])
    assert doctor["network"] == "disabled"
    assert doctor["writes"] == "disabled"
    assert doctor["isolation"] == "unverified"
    assert doctor["hmac_key"] == "absent"
    assert "passed" not in json.dumps(doctor)
    assert str(root) not in json.dumps(doctor)
    assert replies[6]["result"]["isError"] is True
    assert _snapshot(root) == before


def test_hmac_get_run_uses_true_and_false_and_tamper_is_not_checkable(tmp_path):
    root = _signed(tmp_path, key=KEY)
    report = _body(_rpc(root, _call(1, "get_run", run="signed"), key=KEY)[0])
    assert report["integrity"] == "hmac"
    assert report["verified"] is True
    by_claim = {row["claim_id"]: row["verdict"] for row in report["claims"]}
    assert by_claim == {"k1": "TRUE", "k2": "FALSE"}
    assert {row["claim_id"]: row["label_de"] for row in report["claims"]} == {
        "k1": "bestätigt", "k2": "widerlegt",
    }
    assert report["verdict"] == "FALSE"
    assert report["label_de"] == "widerlegt"
    assert any(item["kind"] == "witness" for item in report["evidence"])
    checked = _body(_rpc(root, _call(2, "verify_run", path="signed"), key=KEY)[0])
    assert checked["verified"] is True and checked["integrity"] == "hmac"
    assert "TRUE" not in json.dumps(checked)
    assert "FALSE" not in json.dumps(checked)

    unsigned = _body(_rpc(root, _call(3, "get_run", run="signed"))[0])
    assert unsigned["integrity"] == "hash-only"
    assert unsigned["verdict"] == "UNKNOWN"
    rendered = json.dumps(unsigned, ensure_ascii=False)
    for banned in BANNED:
        assert banned not in rendered

    ledger = root / "signed" / "ledger.jsonl"
    ledger.write_bytes(ledger.read_bytes().replace(b'"failed":0', b'"failed":9', 1))
    damaged = _body(_rpc(root, _call(4, "get_run", run="signed"), key=KEY)[0])
    assert damaged["verified"] is False
    assert damaged["integrity"] == "failed"
    assert damaged["verdict"] == "not_checkable"
    assert "claims" not in damaged
    assert "criteria" not in damaged
    for banned in BANNED:
        assert banned not in json.dumps(damaged, ensure_ascii=False)
    refused = _body(_rpc(root, _call(5, "verify_run", path="signed/ledger.jsonl"), key=b"sk-test-wrong")[0])
    assert refused["verdict"] == "not_checkable"
    assert "claims" not in refused
    doctor_before = set(root.rglob("*"))
    _rpc(root, _call(6, "doctor"), key=KEY)
    assert set(root.rglob("*")) == doctor_before


def test_catalog_does_not_follow_links_or_open_sockets(tmp_path, monkeypatch):
    root = tmp_path / "root"
    root.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "manifest.json").write_text("{}")
    (outside / "ledger.jsonl").write_text("{}\n")
    (root / "escape").symlink_to(outside)
    calls = []

    def refuse(*_args, **_kwargs):
        calls.append("net")
        raise AssertionError("network")

    monkeypatch.setattr(socket, "create_connection", refuse)
    monkeypatch.setattr(socket.socket, "connect", refuse)
    listed = _body(_rpc(root, _call(1, "list_runs"))[0])
    assert listed == {"runs": []}
    assert _rpc(root, _call(2, "get_run", run="escape"))[0]["result"]["isError"] is True
    assert calls == []


def test_cli_uses_env_and_keeps_legacy_root(tmp_path, monkeypatch, capsys):
    root = _signed(tmp_path, key=None)
    monkeypatch.delenv("TRUTHLENS_ROOT", raising=False)
    assert main(["mcp"]) == 2
    assert "TRUTHLENS_ROOT" in capsys.readouterr().err

    monkeypatch.setenv("TRUTHLENS_ROOT", str(root))
    monkeypatch.setattr("sys.stdin", io.StringIO(json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}) + "\n"))
    assert main(["mcp"]) == 0
    listed = json.loads(capsys.readouterr().out)
    assert {tool["name"] for tool in listed["result"]["tools"]} == {
        "list_runs", "get_run", "verify_run", "doctor",
    }

    monkeypatch.setattr("sys.stdin", io.StringIO(json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}) + "\n"))
    assert main(["mcp", "--root", str(root)]) == 0
    legacy = json.loads(capsys.readouterr().out)
    assert {tool["name"] for tool in legacy["result"]["tools"]} == {"list_runs", "run_report", "run_events"}


def test_example_configs_are_local_stdio_and_not_status_snippets():
    from truthlens.agent_setup import valid_config

    root = Path(__file__).parent.parent / "integrations"
    paths = [
        root / "agent-zero" / "mcp-servers.example.json",
        root / "mausbot" / "mcp-servers.example.json",
    ]
    for path in paths:
        doc = json.loads(path.read_text(encoding="utf-8"))
        servers = doc["mcpServers"]
        entry = servers["truthlens"]
        assert entry["command"] == "truthlens"
        assert entry["args"] == ["mcp"]
        assert entry["env"]["TRUTHLENS_ROOT"] == "/path/to/local/runs"
        assert "socket" not in json.dumps(doc)
        assert "http" not in json.dumps(doc).lower()
        assert "--root" not in json.dumps(doc)
        assert "/srv" not in json.dumps(doc)
        rendered = path.read_text(encoding="utf-8")
        assert "sk-" not in rendered
        assert valid_config(rendered, "agent-zero", "/run/truthlens/status.sock") is False


def test_readme_mentions_the_catalog():
    readme = (Path(__file__).parent.parent / "README.md").read_text(encoding="utf-8")
    assert "## Local catalog MCP" in readme
    assert "TRUTHLENS_ROOT" in readme
    assert "integrations/agent-zero/mcp-servers.example.json" in readme
    assert "integrations/mausbot/mcp-servers.example.json" in readme
