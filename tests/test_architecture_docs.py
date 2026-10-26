"""Keep the architecture's source map and CLI tour usable offline."""

from __future__ import annotations

import os
import re
import shlex
import subprocess
import sys
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit

import pytest

ROOT = Path(__file__).resolve().parents[1]
DOCUMENT = ROOT / "docs" / "ARCHITECTURE.md"


class ArchitectureDocsTests(unittest.TestCase):
    def test_local_links_resolve_to_published_targets(self):
        links = re.findall(r"\]\(([^\s)]+)\)", DOCUMENT.read_text(encoding="utf-8"))
        self.assertTrue(links, "architecture needs links to source and supporting documentation")
        tracked = set(subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0"))
        for target in links:
            with self.subTest(target=target):
                url = urlsplit(target)
                if url.scheme or url.netloc:
                    continue  # Never fetch external links.
                path = (DOCUMENT.parent / unquote(url.path)).resolve() if url.path else DOCUMENT.resolve()
                self.assertTrue(path.is_relative_to(ROOT), "local links must stay in the checkout")
                self.assertTrue(path.exists(), "missing local link target")
                relative = path.relative_to(ROOT).as_posix()
                if path.is_dir():
                    prefix = relative.rstrip("/") + "/" if path != ROOT else ""
                    self.assertTrue(
                        any(p and p.startswith(prefix) for p in tracked),
                        "directory must contain published files",
                    )
                else:
                    self.assertIn(relative, tracked, "link target must be published")
                if url.fragment:
                    self.assertTrue(path.is_file(), "heading target must be a file")
                    headings = {
                        re.sub(r"[^\w -]", "", title.lower()).replace(" ", "-")
                        for title in re.findall(
                            r"^#{1,6} (.+)$", path.read_text(encoding="utf-8"), re.MULTILINE
                        )
                    }
                    self.assertIn(unquote(url.fragment), headings, "missing local link heading")

    def test_documented_cli_tour_is_read_only_and_runs_offline(self):
        blocks = re.findall(
            r"^```bash\n(.*?)^```", DOCUMENT.read_text(encoding="utf-8"), re.MULTILINE | re.DOTALL
        )
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
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("usage:", result.stdout.lower())


@pytest.fixture
def architecture_checkout(tmp_path, monkeypatch):
    """A disposable index proves publication checks without changing the real index."""
    (tmp_path / "docs").mkdir()
    (tmp_path / "src").mkdir()
    document = tmp_path / "docs" / "ARCHITECTURE.md"
    document.write_text("# Architecture\n", encoding="utf-8")
    (tmp_path / "README.md").write_text("# Try it in 1 minute\n", encoding="utf-8")
    (tmp_path / "src" / "source file.py").write_text("", encoding="utf-8")
    (tmp_path / "draft.md").write_text("# Draft\n", encoding="utf-8")
    (tmp_path / "drafts").mkdir()
    (tmp_path / "drafts" / "notes.md").write_text("# Notes\n", encoding="utf-8")
    subprocess.run(
        ["git", "init", "--quiet", "--template=", "--initial-branch=main"],
        cwd=tmp_path,
        capture_output=True,
        check=True,
        timeout=10,
    )
    subprocess.run(
        ["git", "add", "docs/ARCHITECTURE.md", "README.md", "src"],
        cwd=tmp_path,
        capture_output=True,
        check=True,
        timeout=10,
    )
    monkeypatch.setattr(sys.modules[__name__], "ROOT", tmp_path)
    monkeypatch.setattr(sys.modules[__name__], "DOCUMENT", document)
    return document


@pytest.mark.parametrize(
    "target, message",
    [
        ("../missing.py", "missing local link target"),
        ("../draft.md", "link target must be published"),
        ("../drafts/", "directory must contain published files"),
        ("../README.md#missing", "missing local link heading"),
        ("#missing", "missing local link heading"),
        ("../../outside.md", "local links must stay in the checkout"),
    ],
)
def test_architecture_link_check_rejects_broken_targets(architecture_checkout, target, message):
    architecture_checkout.write_text(f"# Architecture\n[Broken]({target})\n", encoding="utf-8")
    with pytest.raises(AssertionError, match=message):
        ArchitectureDocsTests().test_local_links_resolve_to_published_targets()


def test_architecture_link_check_accepts_published_targets_offline(architecture_checkout):
    architecture_checkout.write_text(
        "# Architecture\n"
        "[Start](../README.md#try-it-in-1-minute)\n"
        "[Source](../src/source%20file.py)\n"
        "[Directory](../src/)\n"
        "[This page](#architecture)\n"
        "[External](https://example.invalid/unreachable#missing)\n"
        "[External authority](//example.invalid/unreachable)\n",
        encoding="utf-8",
    )
    ArchitectureDocsTests().test_local_links_resolve_to_published_targets()


if __name__ == "__main__":
    unittest.main()
