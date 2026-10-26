"""Keep contributor navigation and the branch example usable offline."""

from __future__ import annotations

import re
import shlex
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOCUMENT = ROOT / "CONTRIBUTING.md"


def test_contributor_links_reach_tracked_rules_and_development_checks():
    text = DOCUMENT.read_text(encoding="utf-8")
    links = re.findall(r"\]\(([^\s)]+)\)", text)
    assert "AGENTS.md" in links, "contributors need the current repository workflow rules"
    assert "docs/REVIEWER-GUIDE.md#development-checks" in links, "contributors need setup and test commands"
    tracked = set(subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0"))
    for link in links:
        url = urlsplit(link)
        if url.scheme or url.netloc:
            continue  # This check never fetches external links.
        path = (ROOT / unquote(url.path)).resolve()
        assert path.is_relative_to(ROOT), "contributor links must stay in the checkout"
        assert path.relative_to(ROOT).as_posix() in tracked, "link target must be published"
        if url.fragment:
            headings = {
                re.sub(r"[^\w -]", "", title.lower()).replace(" ", "-")
                for title in re.findall(r"^#{1,6} (.+)$", path.read_text(encoding="utf-8"), re.MULTILINE)
            }
            assert unquote(url.fragment) in headings, "missing contributor link heading"


def test_documented_branch_command_works_in_a_disposable_checkout(tmp_path):
    text = DOCUMENT.read_text(encoding="utf-8")
    commands = re.findall(r"^git switch -c ([^\n]+)$", text, re.MULTILINE)
    assert commands, "contributors need a copyable branch command"
    subprocess.run(
        ["git", "init", "--quiet", "--template=", "--initial-branch=main"],
        cwd=tmp_path,
        capture_output=True,
        check=True,
        timeout=10,
    )
    for example in commands:
        args = shlex.split(example)
        assert len(args) == 1 and not args[0].startswith("-"), "example must name one branch"
        subprocess.run(
            ["git", "switch", "-c", *args], cwd=tmp_path, capture_output=True, check=True, timeout=10
        )
        actual = subprocess.check_output(["git", "branch", "--show-current"], cwd=tmp_path).decode().strip()
        assert actual == args[0]
