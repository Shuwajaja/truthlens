"""Run readers explain unusable manifests without emitting data or writing outputs."""

import pytest

from tests.test_cli import tl


@pytest.mark.parametrize("command", ["report", "export", "project"])
@pytest.mark.parametrize(
    "problem",
    [
        "missing-run",
        "missing-manifest",
        "manifest-directory",
        "invalid-json",
        "invalid-utf8",
        "array",
        "null",
    ],
)
def test_cli_manifest_errors_are_actionable_and_leave_files_unchanged(tmp_path, command, problem):
    root = tmp_path / "run"
    if problem != "missing-run":
        root.mkdir()
    manifest = root / "manifest.json"
    if problem == "manifest-directory":
        manifest.mkdir()
    elif problem in {"invalid-json", "invalid-utf8", "array", "null"}:
        manifest.write_bytes(
            {
                "invalid-json": b'{"synthetic-private-marker":',
                "invalid-utf8": b'"\xff"',
                "array": b'["synthetic-private-marker"]',
                "null": b"null",
            }[problem]
        )
    output = tmp_path / "export.json"
    output.write_bytes(b"existing export must survive\n")

    def snapshot():
        return {
            path.relative_to(tmp_path): path.read_bytes() if path.is_file() else None
            for path in tmp_path.rglob("*")
        }

    before = snapshot()
    options = {"report": ["--json"], "export": ["-o", str(output)], "project": []}[command]
    result = tl(command, str(root), *options)

    assert result.returncode == 1
    assert result.stderr == ""
    if problem in {"missing-run", "missing-manifest", "manifest-directory"}:
        assert result.stdout == (
            "FAIL cannot read manifest.json; pass a run directory containing manifest.json and ledger.jsonl\n"
        )
    else:
        assert result.stdout == "FAIL manifest.json must contain a UTF-8 JSON object\n"
    assert snapshot() == before
    assert not (root / "projection.sqlite").exists()
