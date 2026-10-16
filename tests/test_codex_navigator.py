"""Codex subprocess/output boundary checks, explicitly not live login evidence."""

import json

import pytest

from truthlens.codex_navigator import ask_codex


def test_codex_has_no_execution_tools_and_validates_source_and_action(monkeypatch):
    response = {"message": "The source reports an update.", "source_ids": ["r"],
                "actions": [{"type": "open_run", "view": None, "run_id": "r", "artifact_id": None}]}
    calls = []

    def run_cli(command, prompt, _timeout, _cancel):
        calls.append(command)
        assert "private" not in prompt
        return 0, json.dumps({"type": "item.completed", "item": {"type": "agent_message", "text": json.dumps(response)}})

    monkeypatch.setattr("truthlens.codex_navigator.shutil.which", lambda _: "/fake/codex")
    monkeypatch.setattr("truthlens.codex_navigator._run_cli", run_cli)
    doc = {"projects": [{"id": "a"}, {"id": "b"}], "runs": [
        {"id": "r", "project_id": "a", "title": "recorded", "integrity": "hash-only", "artifacts": []},
        {"id": "foreign", "project_id": "b", "title": "private", "artifacts": []}], "memory": []}
    result = ask_codex(doc, "what happened?", "a")
    assert result["actions"] == [{"type": "open_run", "project_id": "a", "run_id": "r"}]
    assert result["client_acknowledged"] is False
    command = calls[0]
    assert "--ignore-user-config" in command and "--ephemeral" in command
    assert command[command.index("--sandbox") + 1] == "read-only"
    assert all(feature in command for feature in ("shell_tool", "apps", "plugins", "multi_agent", "hooks"))
    response["source_ids"] = ["foreign"]
    with pytest.raises(ValueError):
        ask_codex(doc, "what happened?", "a")
    response["source_ids"] = ["r"]
    response["actions"] = [{"type": "approve", "run_id": "r"}]
    with pytest.raises(ValueError):
        ask_codex(doc, "approve", "a")


def test_process_output_limit_and_cancellation():
    import sys
    import threading

    from truthlens.codex_navigator import _run_cli

    with pytest.raises(ValueError, match="output exceeded"):
        _run_cli([sys.executable, "-c", "import sys;sys.stdout.write('x'*1100000)"], "", 5, None)
    cancel = threading.Event()
    cancel.set()
    with pytest.raises(ValueError, match="stopped"):
        _run_cli([sys.executable, "-c", "import time;time.sleep(10)"], "", 5, cancel)
