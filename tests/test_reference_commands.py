"""Reference workspace and run-view commands. Synthetic ledgers only."""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from truthlens.capture_lifecycle import finish, ingest_extension, mark_interrupted, resume, start_run
from truthlens.cli import main
from truthlens.ledger import Ledger
from truthlens.mcp import TOOLS
from truthlens.run_view import RunViewRejected, load_declared_view, project_run

W = {"kind": "wrapper", "id": "w"}
H = {"kind": "human", "id": "u"}
A = {"kind": "agent", "id": "a"}


@pytest.fixture(autouse=True)
def reference_commands_enabled(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("TRUTHLENS_REFERENCE", "1")


def _close(ledger: Ledger, run_id: str, code: int = 0) -> list[dict]:
    previous = ledger.read()[-1]["hash"]
    ledger.append(
        run_id,
        W,
        "run.finished",
        {
            "exit_code": code,
            "status": "ok" if code == 0 else "failed",
            "last_hash": previous,
        },
    )
    return ledger.read()


def _ledger(
    path: Path, *, failed: bool = False, claim: str = "tests passed", benchmark: bool = False
) -> list[dict]:
    run_id = "run_ref"
    ledger = Ledger(path)
    ledger.append(
        run_id,
        W,
        "run.started",
        {"repo": "r", "ref": "", "command": "README aktualisieren", "agent": "agent-zero"},
    )
    ledger.append(
        run_id, H, "criterion.recorded", {"criterion_id": "c1", "text": "tests pass", "source": "user"}
    )
    ledger.append(
        run_id,
        W,
        "test.reported",
        {
            "suite": "benchmark" if benchmark else "pytest",
            "passed": 0 if failed else 2,
            "failed": 1 if failed else 0,
            "criterion_ids": ["c1"],
        },
    )
    ledger.append(
        run_id,
        A,
        "agent.claim",
        {
            "kind": "completion",
            "claim_id": "k1",
            "text": claim,
            "criterion_ids": ["c1"],
        },
    )
    return _close(ledger, run_id, 1 if failed else 0)


def test_one_refuted_claim_makes_the_run_refuted(tmp_path: Path):
    events = _ledger(tmp_path / "ledger.jsonl", failed=True, claim="Keine Abhängigkeiten geändert")
    view = project_run(events, project_id="mcpdeck", audit_state="pending", integrity="hash-only")
    assert view["review_summary"] == "refuted"
    assert view["counts"] == {"confirmed": 0, "refuted": 1, "unclear": 0}


def test_zero_claims_stay_unclear(tmp_path: Path):
    run_id = "run_empty"
    ledger = Ledger(tmp_path / "ledger.jsonl")
    ledger.append(
        run_id, W, "run.started", {"repo": "r", "ref": "", "command": "noop", "agent": "agent-zero"}
    )
    view = project_run(
        _close(ledger, run_id), project_id="mcpdeck", audit_state="complete", integrity="hash-only"
    )
    assert view["claims"] == []
    assert view["review_summary"] == "unclear"


def test_confirmed_needs_a_finished_audit_and_witness(tmp_path: Path):
    events = _ledger(tmp_path / "ledger.jsonl")
    pending = project_run(events, project_id="mcpdeck", audit_state="pending", integrity="hash-only")
    assert pending["review_summary"] == "unclear"
    done = project_run(events, project_id="mcpdeck", audit_state="complete", integrity="hash-only")
    assert done["review_summary"] == "confirmed"
    assert done["integrity"] == "hash-only"


def test_missing_benchmark_stays_unclear(tmp_path: Path):
    events = _ledger(tmp_path / "ledger.jsonl", claim="Performance um 30 % verbessert")
    view = project_run(events, project_id="mcpdeck", audit_state="complete", integrity="hash-only")
    assert view["claims"][0]["verdict"] == "unclear"
    assert view["claims"][0]["reason_code"] == "benchmark_missing"
    assert view["review_summary"] == "unclear"


def test_failed_integrity_and_tampered_confirmation_are_rejected(tmp_path: Path):
    events = _ledger(tmp_path / "ledger.jsonl", failed=True)
    with pytest.raises(RunViewRejected):
        project_run(events, project_id="mcpdeck", audit_state="complete", integrity="failed")
    honest = project_run(events, project_id="mcpdeck", audit_state="complete", integrity="hash-only")
    forged = json.loads(json.dumps(honest))
    forged["claims"][0]["verdict"] = "confirmed"
    forged["claims"][0]["reason_code"] = "witnessed_pass"
    forged["counts"] = {"confirmed": 1, "refuted": 0, "unclear": 0}
    forged["review_summary"] = "confirmed"
    with pytest.raises(RunViewRejected) as caught:
        load_declared_view(forged, events, project_id="mcpdeck")
    assert caught.value.code == "TAMPERED"
    with pytest.raises(RunViewRejected) as bare:
        load_declared_view(forged, None, project_id="mcpdeck")
    assert bare.value.code == "UNWITNESSED_CONFIRMATION"


def test_imported_view_drops_self_declared_audit_and_task(tmp_path: Path):
    events = _ledger(tmp_path / "ledger.jsonl")
    honest = project_run(
        events, project_id="mcpdeck", audit_state="unavailable", integrity="hash-only", imported=True
    )
    lying = json.loads(json.dumps(honest))
    lying["audit_state"] = "complete"
    lying["audit_revision"] = "rev-self"
    lying["task"] = "selbst erklärt fertig"
    lying["review_summary"] = "confirmed"
    loaded = load_declared_view(lying, events, project_id="mcpdeck", imported=True)
    assert loaded["audit_state"] == "unavailable"
    assert loaded["audit_revision"] is None
    assert loaded["task"] == "README aktualisieren"
    assert loaded["review_summary"] == "unclear"
    bare = json.loads(json.dumps(honest))
    bare["audit_state"] = "complete"
    bare["audit_revision"] = "rev-self"
    bare["task"] = "selbst erklärt fertig"
    without_events = load_declared_view(bare, None, project_id="mcpdeck", imported=True)
    assert without_events["audit_state"] == "unavailable"
    assert without_events["audit_revision"] is None
    assert without_events["task"] == "imported"
    assert without_events["review_summary"] == "unclear"
    bare["review_summary"] = "confirmed"
    with pytest.raises(RunViewRejected) as unwitnessed:
        load_declared_view(bare, None, project_id="mcpdeck", imported=True)
    assert unwitnessed.value.code == "UNWITNESSED_CONFIRMATION"


def test_init_ledger_contract_is_unchanged(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    ledger = tmp_path / "ledger.jsonl"
    assert main(["init", str(ledger)]) == 0
    assert capsys.readouterr().out.strip().startswith("run_")
    assert main(["doctor"]) == 2
    assert "ISOLATION_UNVERIFIED" in capsys.readouterr().out
    assert {tool["name"] for tool in TOOLS} == {"list_runs", "run_report", "run_events"}


def test_workspace_init_is_idempotent_and_dry_run_writes_nothing(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
):
    args = [
        "workspace",
        "init",
        "--project",
        "mcpdeck",
        "--root",
        str(tmp_path),
        "--harness",
        "agent-zero",
        "--target",
        "vps443",
        "--json",
    ]
    assert main([*args, "--dry-run"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["applied"] is False
    assert payload["warnings"]
    assert not (tmp_path / ".truthlens" / "workspace.toml").exists()
    assert main([*args, "--yes"]) == 0
    assert json.loads(capsys.readouterr().out)["applied"] is True
    assert main([*args, "--yes"]) == 0
    again = json.loads(capsys.readouterr().out)
    assert again["applied"] is True
    assert again["changes"] == []


def test_unlink_keeps_foreign_config_and_runs(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    args = [
        "--project",
        "mcpdeck",
        "--root",
        str(tmp_path),
        "--harness",
        "agent-zero",
        "--harness",
        "codex",
        "--target",
        "vps443",
        "--yes",
    ]
    assert main(["workspace", "init", *args]) == 0
    path = tmp_path / ".truthlens" / "workspace.toml"
    path.write_text('note = "keep"\n' + path.read_text(encoding="utf-8"), encoding="utf-8")
    run = tmp_path / ".truthlens" / "runs" / "run_keep"
    run.mkdir(parents=True)
    (run / "keep.txt").write_text("stay", encoding="utf-8")
    assert (
        main(["workspace", "unlink", "--root", str(tmp_path), "--harness", "codex", "--yes", "--json"]) == 0
    )
    capsys.readouterr()
    text = path.read_text(encoding="utf-8")
    assert 'note = "keep"' in text
    assert "agent-zero" in text
    assert "codex" not in text
    assert (run / "keep.txt").read_text(encoding="utf-8") == "stay"


def test_workspace_doctor_never_claims_isolation(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    assert main(["workspace", "doctor", "--root", str(tmp_path), "--json"]) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["isolation"] == "unverified"
    assert report["summary"]["error"] == 0
    assert main(["workspace", "doctor", "--root", str(tmp_path), "--strict", "--json"]) == 3
    (tmp_path / ".truthlens").mkdir()
    (tmp_path / ".truthlens" / "reader-target").write_text(
        "https://example.invalid/reader\n", encoding="utf-8"
    )
    assert main(["workspace", "doctor", "--root", str(tmp_path), "--json"]) == 4


def test_feature_flag_defaults_off(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("TRUTHLENS_REFERENCE", raising=False)
    assert main(["workspace", "doctor", "--root", str(tmp_path), "--json"]) == 2
    monkeypatch.setenv("TRUTHLENS_REFERENCE", "0")
    assert main(["runs", "list", "--root", str(tmp_path), "--json"]) == 2
    monkeypatch.setenv("TRUTHLENS_REFERENCE", "")
    assert main(["workspace", "doctor", "--root", str(tmp_path), "--json"]) == 2
    assert main(["init", str(tmp_path / "ledger.jsonl")]) == 0
    monkeypatch.setenv("TRUTHLENS_REFERENCE", "1")
    assert main(["workspace", "doctor", "--root", str(tmp_path), "--json"]) == 0


def _hand_built_run(root: Path, run_id: str = "run_manual") -> str:
    """A record the test writes itself. This is not a qualified launcher."""
    run = root / ".truthlens" / "runs" / run_id
    run.mkdir(parents=True)
    record = {"run_id": run_id, "project_id": "mcpdeck", "execution": "running", "inbox": []}
    (run / "record.json").write_text(json.dumps(record) + "\n", encoding="utf-8")
    Ledger(run / "ledger.jsonl").append(
        run_id, W, "run.started", {"repo": "r", "ref": "", "command": "README", "agent": "agent-zero"}
    )
    return run_id


def test_edited_workspace_cannot_start_a_run(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    assert (
        main(
            [
                "workspace",
                "init",
                "--project",
                "mcpdeck",
                "--root",
                str(tmp_path),
                "--harness",
                "agent-zero",
                "--target",
                "local",
                "--yes",
            ]
        )
        == 0
    )
    path = tmp_path / ".truthlens" / "workspace.toml"
    text = path.read_text(encoding="utf-8")
    path.write_text(
        text + 'qualified_harness_version = "test-fixture"\nqualified_harness_version = "9.9.9"\n',
        encoding="utf-8",
    )
    runs = tmp_path / ".truthlens" / "runs"
    for peer in (None, "operator", SimpleNamespace(role="operator")):
        refused = start_run(
            root=tmp_path, task="README", harness="agent-zero", project_id="mcpdeck", peer=peer
        )
        assert refused["captured"] is False
        assert refused["code"] == "START_REFUSED"
        assert not runs.exists()

    def trusted_peer(peer: object | None) -> str | None:
        if peer is None or isinstance(peer, str):
            return None
        role = getattr(peer, "role", None)
        return role if isinstance(role, str) else None

    monkeypatch.setattr("truthlens.capture_lifecycle._peer_role", trusted_peer)
    for harness in ("agent-zero", "codex"):
        blocked = start_run(
            root=tmp_path,
            task="README",
            harness=harness,
            project_id="mcpdeck",
            peer=SimpleNamespace(role="operator"),
        )
        assert blocked["captured"] is False
        assert blocked["code"] == "NOT_QUALIFIED"
        assert not runs.exists()


def test_extension_cannot_witness_a_hand_built_record(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Lifecycle coverage after a test-built record. Not a live Agent Zero launcher."""

    def trusted_peer(peer: object | None) -> str | None:
        if peer is None or isinstance(peer, str):
            return None
        role = getattr(peer, "role", None)
        return role if isinstance(role, str) else None

    monkeypatch.setattr("truthlens.capture_lifecycle._peer_role", trusted_peer)
    run_id = _hand_built_run(tmp_path)
    ledger = tmp_path / ".truthlens" / "runs" / run_id / "ledger.jsonl"
    assert mark_interrupted(root=tmp_path, run_id=run_id, peer="recorder")["code"] == "START_REFUSED"
    assert (
        mark_interrupted(root=tmp_path, run_id=run_id, peer=SimpleNamespace(role="recorder"))["execution"]
        == "interrupted"
    )
    assert (
        finish(root=tmp_path, run_id=run_id, exit_code=0, peer=SimpleNamespace(role="recorder"))["code"]
        == "RESUME_REFUSED"
    )
    assert (
        resume(root=tmp_path, run_id=run_id, peer=SimpleNamespace(role="operator"))["code"]
        == "RESUME_REFUSED"
    )
    witness = ingest_extension(
        root=tmp_path,
        run_id=run_id,
        project_id="mcpdeck",
        message_id="m1",
        text="ok",
        event_type="test.reported",
        peer=SimpleNamespace(role="extension"),
    )
    assert witness["code"] == "WITNESS_REFUSED"
    mismatch = ingest_extension(
        root=tmp_path,
        run_id=run_id,
        project_id="other",
        message_id="m2",
        text="fremd",
        event_type="agent.reported",
        peer=SimpleNamespace(role="extension"),
    )
    assert mismatch["code"] == "PROJECT_MISMATCH"
    first = ingest_extension(
        root=tmp_path,
        run_id=run_id,
        project_id="mcpdeck",
        message_id="m2",
        text="fertig",
        event_type="agent.reported",
        peer=SimpleNamespace(role="extension"),
    )
    second = ingest_extension(
        root=tmp_path,
        run_id=run_id,
        project_id="mcpdeck",
        message_id="m2",
        text="fertig",
        event_type="agent.reported",
        peer="extension",
    )
    assert first["count"] == 1
    assert second["code"] == "START_REFUSED"
    repeated = ingest_extension(
        root=tmp_path,
        run_id=run_id,
        project_id="mcpdeck",
        message_id="m2",
        text="fertig",
        event_type="agent.reported",
        peer=SimpleNamespace(role="extension"),
    )
    assert repeated["code"] == "DUPLICATE"
    assert repeated["count"] == 1
    assert "approval.granted" not in ledger.read_text(encoding="utf-8")


def test_runs_round_trip_import_and_recheck(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    assert (
        main(
            [
                "workspace",
                "init",
                "--project",
                "mcpdeck",
                "--root",
                str(tmp_path),
                "--harness",
                "agent-zero",
                "--target",
                "local",
                "--yes",
            ]
        )
        == 0
    )
    capsys.readouterr()
    source = tmp_path / "bundle"
    source.mkdir()
    _ledger(source / "ledger.jsonl", failed=True)
    assert main(["runs", "import", str(source), "--root", str(tmp_path), "--json"]) == 0
    imported = json.loads(capsys.readouterr().out)
    assert imported["state"] == "complete"
    assert main(["runs", "list", "--root", str(tmp_path), "--json"]) == 0
    listing = json.loads(capsys.readouterr().out)
    assert listing["items"][0]["review_summary"] == "refuted"
    assert listing["items"][0]["integrity"] == "hash-only"
    run_id = listing["items"][0]["run_id"]
    assert main(["runs", "show", run_id, "--root", str(tmp_path), "--json"]) == 0
    shown = json.loads(capsys.readouterr().out)
    assert shown["item"]["review_summary"] == "refuted"
    assert shown["demo"] is False
    forged = {"item": json.loads(json.dumps(shown["item"]))}
    forged["item"]["claims"][0]["verdict"] = "confirmed"
    forged["item"]["counts"] = {"confirmed": 1, "refuted": 0, "unclear": 0}
    forged["item"]["review_summary"] = "confirmed"
    forged["events"] = Ledger(source / "ledger.jsonl").read()
    blob = tmp_path / "forged.json"
    blob.write_text(json.dumps(forged), encoding="utf-8")
    assert main(["runs", "import", str(blob), "--root", str(tmp_path), "--json"]) == 1
    assert json.loads(capsys.readouterr().out)["error"]["code"] == "TAMPERED"
    assert (
        main(["runs", "recheck", run_id, "--root", str(tmp_path), "--expected-revision", "9", "--json"]) == 1
    )
    assert json.loads(capsys.readouterr().out)["error"]["code"] == "REVISION_CONFLICT"
    assert main(["runs", "recheck", run_id, "--root", str(tmp_path), "--json"]) == 0
    rechecked = json.loads(capsys.readouterr().out)
    assert rechecked["state"] == "complete"
    assert main(["runs", "show", run_id, "--root", str(tmp_path), "--json"]) == 0
    after = json.loads(capsys.readouterr().out)
    assert after["item"]["integrity"] == "hash-only"
    assert after["item"]["review_summary"] == "refuted"


def test_workspace_test_is_excluded_from_metrics(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    assert (
        main(
            [
                "workspace",
                "init",
                "--project",
                "mcpdeck",
                "--root",
                str(tmp_path),
                "--harness",
                "agent-zero",
                "--target",
                "local",
                "--yes",
            ]
        )
        == 0
    )
    capsys.readouterr()
    assert main(["workspace", "test", "--root", str(tmp_path), "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["state"] == "complete"
    assert main(["runs", "list", "--root", str(tmp_path), "--json"]) == 0
    item = json.loads(capsys.readouterr().out)["items"][0]
    assert item["synthetic"] is True
    assert item["excluded_from_metrics"] is True
    assert item["review_summary"] == "unclear"


def test_schema_files_match_the_projection_enums():
    root = Path(__file__).resolve().parents[1] / "schemas"
    view = json.loads((root / "run-view-v1.schema.json").read_text(encoding="utf-8"))
    assert view["properties"]["execution"]["enum"] == [
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
        "interrupted",
    ]
    assert view["properties"]["review_summary"]["enum"] == ["confirmed", "refuted", "unclear"]
    assert view["additionalProperties"] is False
    diagnostic = json.loads((root / "diagnostic-report-v1.schema.json").read_text(encoding="utf-8"))
    assert "unverified" in diagnostic["properties"]["isolation"]["enum"]
    workspace = json.loads((root / "workspace-config-v1.schema.json").read_text(encoding="utf-8"))
    assert workspace["properties"]["schema_version"]["const"] == 1
