"""CodexChat round-5 #32.5/#32.6 (redaction)."""
from truthlens.redaction import redact_str
from truthlens.wrapper import _scrub_bytes


def test_32_5_non_utf8_blob_is_redacted():
    out = _scrub_bytes(b"\xff password=hunter2secret\n", [])
    assert b"hunter2secret" not in out and out.startswith(b"\xff")


def test_32_6_long_whitespace_does_not_leak():
    assert "hunter2secret" not in redact_str("password" + " " * 65 + "= hunter2secret")
    assert "hunter2secret" not in redact_str("password" + " " * 5000 + ": hunter2secret")


def test_32_6_long_names_and_input_cap():
    import time

    from truthlens.redaction import MAX_INPUT
    assert "hunter2secret" not in redact_str(("A" * 65) + "_PASSWORD=hunter2secret")
    assert "hunter2secret" not in redact_str("--" + "x" * 100 + "-token hunter2secret")
    assert redact_str("x" * (MAX_INPUT + 1)).startswith("[REDACTED]")
    t = time.monotonic()
    redact_str("a" * 1_000_000 + "=1")  # linear, no catastrophic backtracking
    assert time.monotonic() - t < 2


def test_39_r6_neighbour_field_not_consumed():
    assert "hunter2secret" not in redact_str("curl --silent --password hunter2secret https://x")
    assert "hunter2secret" not in redact_str("info: password=hunter2secret")
