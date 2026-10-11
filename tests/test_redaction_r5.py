"""CodexChat round-5 #32.5/#32.6 (redaction)."""
from truthlens.redaction import redact_str
from truthlens.wrapper import _scrub_bytes


def test_32_5_non_utf8_blob_is_redacted():
    out = _scrub_bytes(b"\xff password=hunter2secret\n", [])
    assert b"hunter2secret" not in out and out.startswith(b"\xff")


def test_32_6_long_whitespace_does_not_leak():
    assert "hunter2secret" not in redact_str("password" + " " * 65 + "= hunter2secret")
    assert "hunter2secret" not in redact_str("password" + " " * 5000 + ": hunter2secret")
