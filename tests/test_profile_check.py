"""Operator-only preflight; real temporary Git repos, simulated root identity."""

import json
import subprocess
from pathlib import Path

import pytest

from truthlens import registry
from truthlens.cli import main


@pytest.fixture
def profile(tmp_path, monkeypatch):
    monkeypatch.setattr(registry, "require_root", lambda: None)
    repo = tmp_path / "repo"
    repo.mkdir()
    for args in (
        ["init", "-q", str(repo)],
        [
            "-C",
            str(repo),
            "-c",
            "user.name=Test",
            "-c",
            "user.email=test@example.invalid",
            "commit",
            "--allow-empty",
            "-qm",
            "fixture",
        ],
    ):
        subprocess.run(["/usr/bin/git", *args], check=True, capture_output=True)
    return {
        "repo": str(repo),
        "criteria": {"criteria": [{"id": "c1", "text": "Human supplied", "source": "user"}]},
        "tests": [{"criterion_ids": ["c1"], "command": "/usr/bin/python3 -m pytest -q"}],
    }


def check(tmp_path, profile):
    path = tmp_path / "draft.json"
    path.write_text(json.dumps(profile))
    return main(["profile", "check", str(path)])


def test_valid_profile_is_quiet_and_read_only(tmp_path, profile, capsys):
    before = {p.relative_to(tmp_path): p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}
    assert check(tmp_path, profile) == 0
    assert capsys.readouterr() == ("", "")
    after = {p.relative_to(tmp_path): p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}
    after.pop(Path("draft.json"))
    assert after == before


def test_derived_only_warns_without_confirming_or_reflecting_content(tmp_path, profile, capsys):
    profile["criteria"]["criteria"][0].update(source="derived", text="PRIVATE_OPERATOR_TEXT")
    assert check(tmp_path, profile) == 2
    out = capsys.readouterr()
    assert out.out == ""
    assert "DERIVED_ONLY" in out.err and "confirmation" in out.err
    assert "PRIVATE_OPERATOR_TEXT" not in out.err
    assert json.loads((tmp_path / "draft.json").read_text()) == profile


def test_mixed_criteria_do_not_get_derived_only_warning(tmp_path, profile, capsys):
    profile["criteria"]["criteria"].append({"id": "c2", "text": "Proposed", "source": "derived"})
    assert check(tmp_path, profile) == 0
    assert capsys.readouterr() == ("", "")


@pytest.mark.parametrize("executable", ["python3", "./venv/bin/python", "venv/bin/python3", "pytest"])
def test_nonabsolute_test_executable_warns(tmp_path, profile, capsys, executable):
    profile["tests"][0]["command"] = f"{executable} -m pytest -q"
    assert check(tmp_path, profile) == 2
    out = capsys.readouterr()
    assert out.out == "" and "TEST_EXECUTABLE" in out.err and "absolute" in out.err


def test_absolute_quoted_executable_is_not_run(tmp_path, profile, capsys):
    marker = tmp_path / "must-not-exist"
    profile["tests"][0]["command"] = f"'/absent interpreter/python3' -m pytest; touch {marker}"
    assert check(tmp_path, profile) == 0
    assert not marker.exists()
    assert capsys.readouterr() == ("", "")


@pytest.mark.parametrize("kind", ["missing", "plain", "unborn", "file", "relative"])
def test_repo_requires_git_worktree_with_commit(tmp_path, profile, capsys, kind):
    repo = tmp_path / "invalid"
    if kind in {"plain", "unborn"}:
        repo.mkdir()
    if kind == "unborn":
        subprocess.run(["/usr/bin/git", "init", "-q", str(repo)], check=True, capture_output=True)
    if kind == "file":
        repo.write_text("not a repository")
    profile["repo"] = "relative/repo" if kind == "relative" else str(repo)
    assert check(tmp_path, profile) == 2
    out = capsys.readouterr()
    assert out.out == "" and "REPO_HEAD" in out.err and "commit" in out.err
    assert str(repo) not in out.err


def test_git_failure_is_a_fixed_warning(tmp_path, profile, capsys, monkeypatch):
    def unavailable(*args, **kwargs):
        raise subprocess.TimeoutExpired("PRIVATE_COMMAND", 5, stderr="PRIVATE_STDERR")

    monkeypatch.setattr(subprocess, "run", unavailable)
    assert check(tmp_path, profile) == 2
    out = capsys.readouterr()
    assert out.out == "" and "REPO_HEAD" in out.err
    assert "PRIVATE" not in out.err


@pytest.mark.parametrize("command", ["", "'unterminated", None])
def test_invalid_test_command_is_fixed_diagnostic(tmp_path, profile, capsys, command):
    profile["tests"][0]["command"] = command
    assert check(tmp_path, profile) == 2
    out = capsys.readouterr()
    assert out.out == "" and "TEST_EXECUTABLE" in out.err


def test_name_reuses_protected_loader(tmp_path, profile, capsys, monkeypatch):
    from truthlens import pipeline

    loaded = []

    def load(name):
        loaded.append(name)
        return profile, "unused-digest"

    monkeypatch.setattr(pipeline, "load_profile", load)
    assert main(["profile", "check", "agent-zero"]) == 0
    assert loaded == ["agent-zero"]
    assert capsys.readouterr() == ("", "")


def test_nonroot_denied_before_profile_read(tmp_path, capsys, monkeypatch):
    monkeypatch.setattr(registry.os, "getuid", lambda: 1234)
    monkeypatch.setattr(registry.os, "geteuid", lambda: 1234)
    monkeypatch.setattr(Path, "read_bytes", lambda *a: pytest.fail("must not read profile"))
    assert main(["profile", "check", str(tmp_path / "private.json")]) == 2
    out = capsys.readouterr()
    assert out.out == "" and out.err == "Profile check unavailable or access denied.\n"


@pytest.mark.parametrize("kind", ["missing", "symlink", "directory", "oversize", "invalid", "array"])
def test_unsafe_or_invalid_draft_has_fixed_error(tmp_path, capsys, monkeypatch, kind):
    monkeypatch.setattr(registry, "require_root", lambda: None)
    path = tmp_path / "PRIVATE_PROFILE.json"
    if kind == "symlink":
        path.symlink_to(tmp_path / "target")
    elif kind == "directory":
        path.mkdir()
    elif kind != "missing":
        path.write_text({"oversize": " " * 65537, "invalid": "PRIVATE_CONTENT", "array": "[]"}[kind])
    assert main(["profile", "check", str(path)]) == 2
    out = capsys.readouterr()
    assert out.out == "" and out.err == "Profile check unavailable or access denied.\n"


def test_operator_warnings_never_enter_agent_or_pipeline_outputs(tmp_path, profile, capsys, monkeypatch):
    profile["criteria"]["criteria"][0]["source"] = "derived"
    profile["tests"][0]["command"] = "python3 -m pytest"
    profile["repo"] = str(tmp_path / "missing")
    assert check(tmp_path, profile) == 2
    warning = capsys.readouterr()
    assert all(code in warning.err for code in ("DERIVED_ONLY", "TEST_EXECUTABLE", "REPO_HEAD"))

    from truthlens import pipeline

    monkeypatch.setattr(pipeline, "load_profile", lambda name: pytest.fail("status must not load profiles"))
    monkeypatch.setattr(registry, "caller_uid", registry.deny)
    assert (
        main(["agent-status", "--socket", str(tmp_path / "absent.sock"), "--run-id", "allowed", "--json"])
        == 2
    )
    assert capsys.readouterr() == ('{"status":"not_checkable"}\n', "")
    assert main(["status", "allowed"]) == 2
    assert capsys.readouterr() == (
        '{"connection": "not connected", "message": "Pipeline unavailable or access denied.", '
        '"state": "unavailable"}\n',
        "",
    )
