"""Keep the portfolio entry point usable from a checkout, without network access."""

from __future__ import annotations

import re
import subprocess
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"


class ReadmeTests(unittest.TestCase):
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
