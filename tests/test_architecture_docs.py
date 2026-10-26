"""Execute the architecture's offline CLI tour without provisioning a host."""

from __future__ import annotations

import os
import re
import shlex
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCUMENT = ROOT / "docs" / "ARCHITECTURE.md"


class ArchitectureDocsTests(unittest.TestCase):
    def test_documented_cli_tour_is_read_only_and_runs_offline(self):
        blocks = re.findall(r"^```bash\n(.*?)^```", DOCUMENT.read_text(encoding="utf-8"), re.M | re.S)
        commands = [line.strip() for block in blocks for line in block.splitlines() if line.strip()]
        self.assertTrue(commands, "architecture needs an executable offline CLI tour")
        env = {**os.environ, "PYTHONPATH": str(ROOT / "src"), "PYTHONIOENCODING": "utf-8"}
        for command in commands:
            with self.subTest(command=command):
                argv = shlex.split(command)
                # Never run shell syntax, a service, a broker or a mutating command from prose.
                self.assertIn(
                    argv,
                    [
                        ["python3", "-m", "truthlens", *args]
                        for args in (
                            ["--help"],
                            ["audit", "--help"],
                            ["agent-status", "--help"],
                            ["mcp-status", "--help"],
                        )
                    ],
                )
                result = subprocess.run(
                    [sys.executable, *argv[1:]],
                    cwd=ROOT,
                    env=env,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    timeout=10,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("usage:", result.stdout.lower())


if __name__ == "__main__":
    unittest.main()
