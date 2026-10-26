"""Keep the portfolio entry point usable from a checkout, without network access."""

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
README = ROOT / "README.md"


class ReadmeTests(unittest.TestCase):
    def test_powershell_offline_walkthrough_matches_posix_commands(self):
        text = README.read_text(encoding="utf-8")
        walkthrough = text.split("## Try it in 1 minute\n", 1)[1].split("\n## ", 1)[0]
        posix = re.search(r"```bash\n(.*?)\n```", walkthrough, re.DOTALL)
        powershell = re.search(r"```powershell\n(.*?)\n```", walkthrough, re.DOTALL)
        self.assertIsNotNone(posix, "keep the POSIX offline walkthrough")
        self.assertIsNotNone(powershell, "provide an offline walkthrough for Windows PowerShell")
        ps_lines = powershell[1].splitlines()
        self.assertEqual(ps_lines[0], '$env:PYTHONPATH = "src"')
        posix_commands = [shlex.split(line) for line in posix[1].splitlines()]
        ps_commands = [shlex.split(line) for line in ps_lines[1:]]
        self.assertEqual(len(posix_commands), 2)
        self.assertEqual(len(ps_commands), 2)
        for bash, ps in zip(posix_commands, ps_commands, strict=True):
            self.assertEqual(bash[:2], ["PYTHONPATH=src", "python3"])
            self.assertEqual(ps[:2], ["py", "-3"])
            # These simple argument lists are compared, not executed in PowerShell.
            self.assertEqual(ps[2:], bash[2:])

    def test_offline_walkthrough_commands_read_the_recorded_demo(self):
        text = README.read_text(encoding="utf-8")
        block = re.search(r"```bash\n(.*?)\n```", text, re.DOTALL)
        self.assertIsNotNone(block)
        commands = [shlex.split(line) for line in block[1].splitlines()]
        self.assertEqual(
            commands,
            [
                ["PYTHONPATH=src", "python3", "-m", "truthlens", "report", "demo/runs/demo-2"],
                ["PYTHONPATH=src", "python3", "-m", "truthlens", "verify", "demo/runs/demo-2/ledger.jsonl"],
            ],
        )
        outputs = []
        for command in commands:
            result = subprocess.run(
                [sys.executable, *command[2:]],
                cwd=ROOT,
                env={**os.environ, "PYTHONPATH": "src"},
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=15,
            )
            self.assertEqual(result.returncode, 0, "documented offline command failed")
            self.assertEqual(result.stderr, "", "documented offline command wrote diagnostics")
            outputs.append(result.stdout)
        for criterion, status in (("c1", "met"), ("c2", "unmet"), ("c3", "unverified")):
            self.assertRegex(outputs[0], rf"(?m)^\s*{criterion}\s+{status}\b")
        self.assertEqual(outputs[1].strip(), "OK 16 events, anchored")

    def test_local_links_and_images_resolve_to_tracked_files(self):
        text = README.read_text(encoding="utf-8")
        tracked = set(subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0"))
        headings = {
            re.sub(r"[^\w -]", "", title.lower()).replace(" ", "-")
            for title in re.findall(r"^#{1,6} (.+)$", text, re.MULTILINE)
        }
        links = re.findall(r"\]\(([^\s)]+)(?:\s+\"[^\"]*\")?\)", text)
        self.assertTrue(links, "README must link to supporting evidence and documentation")
        for target in links:
            with self.subTest(target=target):
                url = urlsplit(target)
                if url.scheme or url.netloc:
                    continue  # Offline check: external badges/URLs are not fetched.
                if not url.path:
                    self.assertIn(unquote(url.fragment), headings, "broken README heading link")
                    continue
                relative = unquote(url.path)
                path = (ROOT / relative).resolve()
                self.assertTrue(path.is_relative_to(ROOT), "local links must stay in the checkout")
                self.assertTrue(path.exists(), "missing local link target")
                if path.is_dir():
                    self.assertTrue(any(p.startswith(relative.rstrip("/") + "/") for p in tracked))
                else:
                    self.assertIn(relative, tracked, "link target must be tracked, not just present locally")
                if url.fragment:
                    self.assertTrue(path.is_file(), "heading target must be a file")
                    target_headings = {
                        re.sub(r"[^\w -]", "", title.lower()).replace(" ", "-")
                        for title in re.findall(
                            r"^#{1,6} (.+)$", path.read_text(encoding="utf-8"), re.MULTILINE
                        )
                    }
                    self.assertIn(unquote(url.fragment), target_headings, "missing local link heading")

    def test_portfolio_opening_and_real_hero(self):
        text = README.read_text(encoding="utf-8")
        first_section = text.index("\n## ")
        opening = text[:first_section]
        hero = "docs/screenshots/readme/truthlens-overview-desktop.png"
        self.assertRegex(opening, rf"!\[[^\]]+\]\({re.escape(hero)}\)")
        image = ROOT / hero
        self.assertTrue(image.is_file(), "the supplied overview must be published with the README")
        self.assertEqual(image.read_bytes()[:8], b"\x89PNG\r\n\x1a\n")
        sections = re.findall(r"^## (.+)$", text, re.MULTILINE)
        self.assertEqual(sections[:3], ["Try it in 1 minute", "How it works", "What it does not do"])
        self.assertIn("UI is German", text)
        self.assertIn("Integrity is not approval", text)

    def test_no_private_host_paths_or_obvious_credentials(self):
        # Deliberately narrow tripwires, not a claim of comprehensive secret detection.
        patterns = (
            r"/(?:home/[^/\s]+|srv)(?:/|\b)",
            r"\b(?:\d{1,3}\.){3}\d{1,3}\b",  # A loopback example is permitted below.
            r"\b[^\s/@]+@[^\s/]+\.(?:com|net|org|io)\b",  # SSH/login addresses.
            r"\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b",
            r"-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----",
        )
        # Check the entry point and the reference material it moves out of the README.
        documents = [README, ROOT / "docs" / "REVIEWER-GUIDE.md"]
        for path in documents:
            if not path.exists():
                continue
            text = path.read_text(encoding="utf-8").replace("127.0.0.1", "LOOPBACK")
            for pattern in patterns:
                with self.subTest(document=path.name, pattern=pattern):
                    self.assertIsNone(re.search(pattern, text), "private detail or credential-shaped text")


@pytest.fixture
def readme_checkout(tmp_path, monkeypatch):
    """Exercise the README checker against a disposable, locally indexed checkout."""
    (tmp_path / "docs").mkdir()
    readme = tmp_path / "README.md"
    readme.write_text("# TruthLens\n", encoding="utf-8")
    (tmp_path / "docs" / "reviewer guide.md").write_text("## Fresh capture\n", encoding="utf-8")
    subprocess.run(
        ["git", "init", "--quiet", "--template=", "--initial-branch=main"],
        cwd=tmp_path,
        capture_output=True,
        check=True,
        timeout=10,
    )
    subprocess.run(
        ["git", "add", "README.md", "docs"],
        cwd=tmp_path,
        capture_output=True,
        check=True,
        timeout=10,
    )
    monkeypatch.setattr(sys.modules[__name__], "ROOT", tmp_path)
    monkeypatch.setattr(sys.modules[__name__], "README", readme)
    return readme


@pytest.mark.parametrize(
    "target, message",
    [
        ("docs/reviewer%20guide.md#missing", "missing local link heading"),
        ("docs/reviewer%20guide.md#missing%2Dheading", "missing local link heading"),
        ("docs/#fresh-capture", "heading target must be a file"),
    ],
)
def test_readme_link_check_rejects_broken_file_fragments(readme_checkout, target, message):
    readme_checkout.write_text(f"# TruthLens\n[Broken]({target})\n", encoding="utf-8")
    with pytest.raises(AssertionError, match=message):
        ReadmeTests().test_local_links_and_images_resolve_to_tracked_files()


def test_readme_link_check_accepts_published_targets_offline(readme_checkout):
    readme_checkout.write_text(
        "# TruthLens\n"
        "[Capture](docs/reviewer%20guide.md#fresh-capture)\n"
        "[Encoded heading](docs/reviewer%20guide.md#fresh%2Dcapture)\n"
        "[Guide](docs/reviewer%20guide.md)\n"
        "[Directory](docs/)\n"
        "[This page](#truthlens)\n"
        "[External](https://example.invalid/unreachable#missing)\n"
        "[External authority](//example.invalid/unreachable#missing)\n",
        encoding="utf-8",
    )
    ReadmeTests().test_local_links_and_images_resolve_to_tracked_files()
