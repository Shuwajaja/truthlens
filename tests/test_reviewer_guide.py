"""Keep the portfolio reviewer guide aligned with the neutral claim presentation."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_agent_story_guidance_keeps_supported_claims_neutral():
    text = (ROOT / "docs" / "REVIEWER-GUIDE.md").read_text(encoding="utf-8")
    assert not re.search(r"\b(?:yellow|amber)\b", text, re.IGNORECASE), (
        "the reviewer guide must not describe claims with the retired warning colours"
    )
    story = text.split("Agent Story orders", 1)[1].split("\n## ", 1)[0]
    assert re.search(r"Claim steps stay\s+neutral gr[ae]y\b", story)
    assert "including supported claims" in story
    assert "only `met` criteria can appear green" in story
