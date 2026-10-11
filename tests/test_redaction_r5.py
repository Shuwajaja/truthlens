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


def test_39_r6_agent_textconv_driver_not_run(tmp_path):
    import subprocess
    import sys

    from tests.test_wrapper import _keyfile, _repo
    from truthlens.cli import main
    r, crit = _repo(tmp_path)
    marker = tmp_path / "textconv-ran"
    (r / "evil.py").write_text(
        "import subprocess, pathlib\n"
        f"pathlib.Path('conv.sh').write_text('#!/bin/sh\\ntouch {marker}\\ncat \"$1\"\\n')\n"
        "subprocess.run(['chmod', '+x', 'conv.sh'])\n"
        "subprocess.run(['git', 'config', 'diff.evil.textconv', './conv.sh'])\n"
        "pathlib.Path('.gitattributes').write_text('* diff=evil\\n')\n"
        "pathlib.Path('index.html').write_text('changed')\n")
    subprocess.run(["git", "-C", str(r), "add", "evil.py"], check=True)
    subprocess.run(["git", "-C", str(r), "-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "e"], check=True)
    assert main(["run", "--out", str(tmp_path / "run"), "--repo", str(r), "--criteria", str(crit),
                 "--hmac-key-file", str(_keyfile(tmp_path)), "--hmac-key-id", "k1",
                 "--", sys.executable, "evil.py"]) == 0
    assert not marker.exists()


def test_39_r6_agent_filter_driver_not_run(tmp_path):
    import subprocess
    import sys

    from tests.test_wrapper import _keyfile, _repo
    from truthlens.cli import main
    r, crit = _repo(tmp_path)
    marker = tmp_path / "filter-ran"
    (r / "evil.py").write_text(
        "import subprocess, pathlib\n"
        f"subprocess.run(['git', 'config', 'filter.evil.driver.clean', 'touch {marker}'], check=True)\n"
        "pathlib.Path('.gitattributes').write_text('* filter=evil.driver\\n')\n"
        "pathlib.Path('index.html').write_text('changed')\n"
        "pathlib.Path('README.md').write_text('changed by agent\\n')\n")
    subprocess.run(["git", "-C", str(r), "add", "evil.py"], check=True)
    subprocess.run(["git", "-C", str(r), "-c", "user.email=a@b", "-c", "user.name=a", "commit", "-qm", "e"], check=True)
    assert main(["run", "--out", str(tmp_path / "run"), "--repo", str(r), "--criteria", str(crit),
                 "--hmac-key-file", str(_keyfile(tmp_path)), "--hmac-key-id", "k1",
                 "--", sys.executable, "evil.py"]) == 0
    assert not marker.exists()
