"""Queue tests simulate privilege; CLI integration is separate from host activation."""

import pytest

from truthlens import pipeline_jobs, registry

pytest_plugins = ("tests.test_registry",)


def test_queue_drains_once_and_restart_preserves_findings(captured, monkeypatch):
    store, dispatch, capture = captured
    store.queue(capture["run_id"], 1234)
    calls = []

    def execute(argv):
        from truthlens.pipeline import check_snapshot

        calls.append(argv)
        return 0, check_snapshot(store, {**dispatch, **capture})

    monkeypatch.setattr(pipeline_jobs, "_execute", execute)
    monkeypatch.setattr(pipeline_jobs, "trusted", lambda *args, **kwargs: None)
    pipeline_jobs.drain(store)
    pipeline_jobs.drain(registry.Registry(store.root))
    assert len(calls) == 1
    assert "--expect-last-hash" in calls[0] and "--hmac-key-file" in calls[0]
    assert pipeline_jobs.status(store, capture["run_id"], 1234)["state"] == "completed"


def test_running_after_crash_becomes_interrupted_never_completed(captured, monkeypatch):
    store, _, capture = captured
    job = store.queue(capture["run_id"], 1234)
    store.append("running", {"audit_id": job["audit_id"], "run_id": capture["run_id"]})
    monkeypatch.setattr(pipeline_jobs, "trusted", lambda *args, **kwargs: None)
    pipeline_jobs.drain(store)
    public = pipeline_jobs.status(store, capture["run_id"], 1234)
    assert public["state"] == "failed" and public["reason"] == "interrupted" and public["conclusion"] is None


def test_timeout_is_technical_failure_without_false_conclusion(captured, monkeypatch):
    store, _, capture = captured
    store.queue(capture["run_id"], 1234)

    def timeout(argv):
        raise pipeline_jobs.JobError()

    monkeypatch.setattr(pipeline_jobs, "_execute", timeout)
    monkeypatch.setattr(pipeline_jobs, "trusted", lambda *args, **kwargs: None)
    pipeline_jobs.drain(store)
    public = pipeline_jobs.status(store, capture["run_id"], 1234)
    assert public["state"] == "failed" and public["conclusion"] is None
    assert str(store.root) not in str(public)
    with pytest.raises(registry.RegistryError):
        pipeline_jobs.status(store, capture["run_id"], 5678)


def test_real_cli_report_and_exit_are_consumed_without_shell(tmp_path, monkeypatch):
    import json
    import sys
    from pathlib import Path

    from tests.audit_support import TEST_KEY, make_run

    monkeypatch.setattr(pipeline_jobs, "trusted", lambda *args, **kwargs: None)
    run = make_run(tmp_path / "run")
    key = tmp_path / "key"
    key.write_bytes(TEST_KEY)
    key.chmod(0o600)
    source = str(Path(__file__).parents[1] / "src")
    bootstrap = (
        "import sys;sys.path.insert(0,"
        + json.dumps(source)
        + ");from truthlens.cli import main;sys.exit(main(sys.argv[1:]))"
    )
    code, report = pipeline_jobs._execute(
        [sys.executable, "-c", bootstrap, "audit", str(run), "--json", "--hmac-key-file", str(key)]
    )
    assert code == 0 and report["authentication"] == "supported"


def test_real_timeout_terminates_only_its_own_child(monkeypatch):
    import sys

    monkeypatch.setattr(pipeline_jobs, "trusted", lambda *args, **kwargs: None)
    monkeypatch.setattr(pipeline_jobs, "TIMEOUT", 0.05)
    with pytest.raises(pipeline_jobs.JobError):
        pipeline_jobs._execute([sys.executable, "-c", "import time;time.sleep(5)"])


def test_close_before_enqueue_crash_is_recovered(store, tmp_path, monkeypatch):
    from tests.audit_support import TEST_KEY, make_run
    from truthlens import pipeline

    monkeypatch.setattr(pipeline, "trusted", lambda *args, **kwargs: None)
    monkeypatch.setattr(pipeline_jobs, "trusted", lambda *args, **kwargs: None)
    key = tmp_path / "key"
    key.write_bytes(TEST_KEY)
    key.chmod(0o600)
    monkeypatch.setattr(pipeline, "KEY_FILE", key)
    dispatch = store.dispatch("agent-zero", 1234, "Shu", [1234], "a" * 64)
    make_run(store.root / "runs" / dispatch["dispatch_id"])
    # Simulated root launcher death after wrapper close, before snapshot/registration.
    monkeypatch.setattr(
        pipeline_jobs, "_execute", lambda argv: (_ for _ in ()).throw(pipeline_jobs.JobError())
    )
    pipeline_jobs.drain(store)
    assert any(r["event"] == "captured" for r in store.records())
    assert any(r["event"] == "queued" for r in store.records())
