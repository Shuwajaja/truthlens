"""Process lifecycle guards use fake processes, never a host tl-agent account."""

import pytest

from truthlens import pipeline_agent, registry


def test_background_cleanup_happens_before_wrapper_can_resume(monkeypatch):
    calls = []

    class Process:
        def wait(self, timeout):
            calls.append("wait")
            return 7

    monkeypatch.setattr(pipeline_agent.subprocess, "Popen", lambda *args, **kwargs: Process())
    monkeypatch.setattr(pipeline_agent, "quiesce", lambda uid: calls.append("cleanup"))
    assert pipeline_agent.supervise(["/usr/bin/true"], 1234, 5678) == 7
    assert calls == ["wait", "cleanup"]


def test_failed_cleanup_aborts_privileged_parent_not_returning_to_file_reads(monkeypatch):
    killed = []
    monkeypatch.setattr(pipeline_agent.os, "getppid", lambda: 5678)

    class Process:
        def wait(self, timeout):
            return 0

    monkeypatch.setattr(pipeline_agent.subprocess, "Popen", lambda *args, **kwargs: Process())
    monkeypatch.setattr(pipeline_agent, "quiesce", lambda uid: registry.deny())
    monkeypatch.setattr(pipeline_agent.os, "kill", lambda pid, sig: killed.append(pid))
    with pytest.raises(registry.RegistryError):
        pipeline_agent.supervise(["/usr/bin/true"], 1234, 5678)
    assert killed == [5678]
