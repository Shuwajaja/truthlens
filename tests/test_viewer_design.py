"""Keep the shared design contract consistent with the approved neutral warnings."""

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
