"""Keep the shared design contract aligned with theme and repository rules."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_theme_guidance_keeps_open_review_and_warnings_neutral():
    text = (ROOT / "viewer" / "DESIGN.md").read_text(encoding="utf-8")
    themes = text.split("## Themes and tokens\n", 1)[1].split("\n## ", 1)[0]
    tokens = next(paragraph for paragraph in themes.split("\n\n") if "Success means" in paragraph)
    assert not re.search(r"\b(?:amber|yellow) means\b", text, re.IGNORECASE), (
        "the shared design must not assign retired warning colours to a status"
    )
    assert re.search(r"neutral gr[ae]y means open human review", tokens, re.IGNORECASE)
    assert re.search(r"warnings stay gr[ae]y", tokens, re.IGNORECASE)
    assert "no amber or yellow" in tokens.lower()


def test_merge_guidance_links_to_authoritative_repository_rules():
    text = (ROOT / "viewer" / "DESIGN.md").read_text(encoding="utf-8")
    acceptance = text.split("## Accessibility and regression acceptance\n", 1)[1].split("\n## ", 1)[0]
    assert "[AGENTS.md](../AGENTS.md)" in acceptance, (
        "merge guidance must defer to the authoritative repository rules instead of a named approver"
    )
    assert (ROOT / "viewer" / "../AGENTS.md").resolve().is_file()
    assert re.search(r"standing authorization", acceptance, re.IGNORECASE)
    assert re.search(r"task-specific limits", acceptance, re.IGNORECASE)


def test_merge_guidance_keeps_independent_review_for_security_sensitive_changes():
    text = (ROOT / "viewer" / "DESIGN.md").read_text(encoding="utf-8")
    acceptance = text.split("## Accessibility and regression acceptance\n", 1)[1].split("\n## ", 1)[0]
    assert re.search(
        r"security-sensitive changes require independent Codex review", acceptance, re.IGNORECASE
    ), "the merge-policy correction must retain the independent security-review requirement"
