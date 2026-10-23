"""CI must skip only proven unrelated work and fail closed on missing evidence."""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / ".github" / "ci_scope.py"


class ScopeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("ci_scope", SCRIPT)
        cls.scope = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.scope)

    def test_paths_skip_only_proven_unrelated_jobs(self):
        cases = [
            (["docs/STATUS.md", "AGENTS.md"], (False, False)),
            (["src/truthlens/audit.py"], (False, True)),
            (["tests/test_audit.py"], (False, True)),
            (["viewer/src/App.tsx"], (True, False)),
            (["integrations/agent-zero-acp/audit-status.cjs"], (True, False)),
            (["surprise/tool.sh"], (True, True)),
            ([".github/workflows/ci.yml"], (True, True)),
            (["viewer/package-lock.json"], (True, True)),
            (["pyproject.toml"], (True, True)),
        ]
        for paths, expected in cases:
            with self.subTest(paths=paths):
                self.assertEqual(self.scope.classify(paths), expected)

    def test_git_diff_keeps_deleted_and_both_renamed_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)

            def git(*args):
                return subprocess.check_output(["git", "-C", directory, *args]).decode().strip()

            git("init", "-q")
            git("config", "user.email", "ci-test@example.invalid")
            git("config", "user.name", "CI Test")
            (root / "viewer").mkdir()
            (root / "viewer/old.ts").write_text("original\n")
            (root / "removed.py").write_text("removed\n")
            git("add", ".")
            git("commit", "-qm", "base")
            base = git("rev-parse", "HEAD")
            (root / "docs").mkdir()
            (root / "viewer/old.ts").rename(root / "docs/new.md")
            (root / "removed.py").unlink()
            git("add", "-A")
            git("commit", "-qm", "rename and delete")
            paths = self.scope.changed_paths(base, cwd=root)
            self.assertEqual(set(paths), {"viewer/old.ts", "docs/new.md", "removed.py"})
            self.assertEqual(self.scope.classify(paths), (True, True))
            self.assertEqual(self.scope.detect("0" * 40, cwd=root)[0:2], (True, True))
            self.assertEqual(self.scope.detect("f" * 40, cwd=root)[0:2], (True, True))

    def test_regressions_and_changed_tests_selected_without_silent_missing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "tests").mkdir()
            for name in ("test_gate_r5.py", "test_new.py"):
                (root / "tests" / name).touch()
            selected = self.scope.extra_tests(
                ["src/truthlens/gate.py", "tests/test_new.py", "tests/test_deleted.py"], root
            )
            self.assertIn("tests/test_gate_r5.py", selected)
            self.assertIn("tests/test_new.py", selected)
            self.assertNotIn("tests/test_deleted.py", selected)

    def test_private_reader_changes_select_both_boundary_suites(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "tests").mkdir()
            expected = {"tests/test_read_projection.py", "tests/test_read_service.py"}
            for name in expected:
                (root / name).touch()
            for source in ("read_projection", "read_service"):
                self.assertEqual(
                    set(self.scope.extra_tests([f"src/truthlens/{source}.py"], root)), expected
                )

    def test_aggregate_rejects_missing_required_evidence(self):
        for result in ("failure", "cancelled", "skipped", ""):
            with self.subTest(result=result):
                self.assertFalse(
                    self.scope.aggregate("success", "success", "true", "false", result, "skipped")
                )
        self.assertTrue(self.scope.aggregate("success", "success", "false", "false", "skipped", "skipped"))
        self.assertTrue(self.scope.aggregate("success", "success", "true", "true", "success", "success"))
        for scope, docs, viewer_needed in (
            ("failure", "success", "false"),
            ("success", "failure", "false"),
            ("success", "success", ""),
        ):
            self.assertFalse(self.scope.aggregate(scope, docs, viewer_needed, "false", "skipped", "skipped"))

    def test_security_sources_select_targeted_round5_regressions(self):
        root = SCRIPT.parent.parent
        gate = self.scope.extra_tests(["src/truthlens/gate.py"], root)
        wrapper = self.scope.extra_tests(["src/truthlens/wrapper.py"], root)
        self.assertIn("tests/test_round5.py::test_r8_gate_bundled_short_c_refused", gate)
        self.assertIn("tests/test_round5.py::test_r7_sibling_dir_of_repo_is_not_mapped_into_copy", wrapper)

    def test_detect_cli_unknown_base_runs_both_and_reports_error(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "outputs"
            result = subprocess.run(
                ["python3", str(SCRIPT), "detect"],
                env={"BASE_SHA": "", "GITHUB_OUTPUT": str(output)},
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 1)
            self.assertIn("viewer=true", output.read_text())
            self.assertIn("python=true", output.read_text())
            self.assertIsInstance(json.loads(output.read_text().split("extra_tests=", 1)[1]), list)

    @unittest.skipUnless(importlib.util.find_spec("pytest"), "pytest boundary runs after Python dev install")
    def test_extra_tests_cli_executes_nodeids_and_propagates_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "tests").mkdir()
            (root / "tests/test_boundary.py").write_text(
                "def test_pass():\n    assert True\ndef test_fail():\n    assert False\n"
            )
            for name, expected in (("test_pass", 0), ("test_fail", 1)):
                with self.subTest(name=name):
                    result = subprocess.run(
                        [sys.executable, str(SCRIPT), "extra-tests"],
                        cwd=root,
                        env={**os.environ, "EXTRA_TESTS": json.dumps([f"tests/test_boundary.py::{name}"])},
                        capture_output=True,
                        text=True,
                        check=False,
                    )
                    self.assertEqual(result.returncode, expected, result.stderr + result.stdout)

    def test_baseline_changes_do_not_repeat_baseline_tests(self):
        self.assertEqual(
            self.scope.extra_tests(
                ["tests/test_manifest.py", "tests/test_redaction.py"], SCRIPT.parent.parent
            ),
            [],
        )
