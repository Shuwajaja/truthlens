"""CodexChat round-5 #32.5/#32.6 (redaction)."""
import hashlib
import sys

from truthlens.cli import main
from truthlens.ledger import Ledger, verify
from truthlens.redaction import MAX_INPUT, redact_str
from truthlens.store import BlobStore
from truthlens.wrapper import _redact_claim_trailers, _scrub, _scrub_bytes, extract_claims


def test_51_short_known_secret_redacted(tmp_path, monkeypatch):
    secret = "qZ7"
    assert _scrub("status qZ7", [secret]) == "status [REDACTED]"
    assert _scrub_bytes(b"status qZ7", [secret]) == b"status [REDACTED]"
    malformed = "TRUTHLENS_CLAIMS: [not-json qZ7]"
    assert _redact_claim_trailers(malformed, []) == malformed
    malformed_scrubbed = _redact_claim_trailers(malformed, [secret])
    assert secret not in malformed_scrubbed and "[REDACTED]" in malformed_scrubbed

    from tests.test_wrapper import _keyfile, _repo

    repo, criteria = _repo(tmp_path)
    (repo / "agent.py").write_text(
        "import os\n"
        "secret = os.environ['SHORT_FAKE_SECRET']\n"
        "print('ordinary output survives')\n"
        "print('TRUTHLENS_CLAIMS: [{\"text\": \"status ' + secret + '\", \"safe\": \"complete\"}]')\n"
    )
    monkeypatch.setenv("SHORT_FAKE_SECRET", secret)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(repo), "--criteria", str(criteria),
                 "--pass-env", "SHORT_FAKE_SECRET", "--hmac-key-file", str(_keyfile(tmp_path)),
                 "--hmac-key-id", "k1", "--", sys.executable, "agent.py"]) == 0

    ledger_path = out / "ledger.jsonl"
    assert verify(ledger_path, b"hmac-key-outside-agent").anchored
    events = Ledger(ledger_path).read()
    claim = next(e["payload"]["text"] for e in events if e["type"] == "agent.claim")
    assert claim == "status [REDACTED]"
    command_sha = next(e["payload"]["sha256"] for e in events
                       if e["type"] == "evidence.attached" and e["payload"].get("refers_to") == "agent_command")
    command_blob = BlobStore(out / "blobs").get(command_sha)
    assert secret.encode() not in command_blob
    assert b"ordinary output survives" in command_blob
    assert b'"safe":"complete"' in command_blob
    all_stored = ledger_path.read_bytes() + b"".join(p.read_bytes() for p in (out / "blobs").rglob("*") if p.is_file())
    assert secret.encode() not in all_stored


def test_51_unicode_escaped_claim_secret_redacted(tmp_path, monkeypatch):
    from tests.test_wrapper import _keyfile, _repo

    repo, criteria = _repo(tmp_path)
    (repo / "agent.py").write_text(
        """secret = ''.join(('SAFE', '-FAKE', '-73'))
print('preceding ordinary output survives')
print('TRUTHLENS_CLAIMS: [{"api_key": "ordinary-value", "access\\\\u005fkey": "' + secret + '", "note": "\\\\u0071Z7", "safe": "first"}]')
print(f'TRUTHLENS_CLAIMS: [{{"api\\u005fkey": "{secret}", "safe": "first"}}]')
print('TRUTHLENS_CLAIMS: [{"api\\\\u005fkey": "' + secret + '", "text": "status: complete", "criterion_ids": [], "safe": "complete"}]')
"""
    )
    monkeypatch.setenv("SHORT_FAKE_SECRET", "qZ7")
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(repo), "--criteria", str(criteria),
                 "--pass-env", "SHORT_FAKE_SECRET",
                 "--hmac-key-file", str(_keyfile(tmp_path)),
                 "--hmac-key-id", "k1", "--", sys.executable, "agent.py"]) == 0

    ledger_path = out / "ledger.jsonl"
    assert verify(ledger_path, b"hmac-key-outside-agent").anchored
    events = Ledger(ledger_path).read()
    claim = next(e["payload"]["text"] for e in events if e["type"] == "agent.claim")
    assert claim == "status: complete"
    command_sha = next(e["payload"]["sha256"] for e in events
                       if e["type"] == "evidence.attached" and e["payload"].get("refers_to") == "agent_command")
    command_blob = BlobStore(out / "blobs").get(command_sha)
    all_stored = ledger_path.read_bytes() + b"".join(p.read_bytes() for p in (out / "blobs").rglob("*") if p.is_file())
    assert b"SAFE-FAKE-73" not in command_blob + all_stored
    assert b"qZ7" not in command_blob + all_stored
    assert b"preceding ordinary output survives" in command_blob
    assert b'"api_key":"[REDACTED]"' in command_blob
    assert b'"access_key":"[REDACTED]"' in command_blob
    assert b'"note":"[REDACTED]"' in command_blob
    assert b'"safe":"complete"' in command_blob
    for event in events:
        if event["type"] not in {"evidence.attached", "artifact.recorded"}:
            continue
        sha = event.get("payload", {}).get("sha256")
        if sha:
            data = BlobStore(out / "blobs").get(sha)
            assert hashlib.sha256(data).hexdigest() == sha


def test_51_secret_overlapping_unicode_escape_does_not_corrupt_trailer(tmp_path, monkeypatch):
    from tests.test_wrapper import _keyfile, _repo

    escaped_trailer = 'TRUTHLENS_CLAIMS: [{"api\\u005fkey":"SAFE-FAKE-73","text":"done"}]'
    for configured_secret in ("005", "u", "0"):
        structurally_redacted = _redact_claim_trailers(escaped_trailer, [configured_secret])
        assert '"api_key":"[REDACTED]"' in structurally_redacted
        assert extract_claims(structurally_redacted)[0]["text"] == "done"

    repo, criteria = _repo(tmp_path)
    (repo / "agent.py").write_text(
        """value = ''.join(('SAFE', '-FAKE', '-73'))
escape = chr(92) + 'u' + '00' + '5f'
print('TRUTHLENS_CLAIMS: [{"api' + escape + 'key": "' + value + '", "text": "done"}]')
"""
    )
    monkeypatch.setenv("ESCAPE_OVERLAP_SECRET", "005")
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(repo), "--criteria", str(criteria),
                 "--pass-env", "ESCAPE_OVERLAP_SECRET", "--hmac-key-file", str(_keyfile(tmp_path)),
                 "--hmac-key-id", "k1", "--", sys.executable, "agent.py"]) == 0

    ledger_path = out / "ledger.jsonl"
    assert verify(ledger_path, b"hmac-key-outside-agent").anchored
    events = Ledger(ledger_path).read()
    assert next(e["payload"]["text"] for e in events if e["type"] == "agent.claim") == "done"
    command_sha = next(e["payload"]["sha256"] for e in events
                       if e["type"] == "evidence.attached" and e["payload"].get("refers_to") == "agent_command")
    command_blob = BlobStore(out / "blobs").get(command_sha)
    assert b"SAFE-FAKE-73" not in command_blob + ledger_path.read_bytes()
    assert b"005" not in command_blob
    assert b'"api_key":"[REDACTED]"' in command_blob


def test_51_short_secrets_do_not_rewrite_redaction_markers(tmp_path, monkeypatch):
    assert _scrub_bytes(b"status qZ7 [REDACTED]", ["qZ7", "R"]) == b"status [REDACTED] [REDACTED]"
    assert _scrub("status qZ7 [REDACTED]", ["qZ7", "R"]) == "status [REDACTED] [REDACTED]"
    invalid_byte_secret = b"\xff".decode("utf-8", "surrogateescape")
    assert _scrub_bytes(b"before \xff after", [invalid_byte_secret]) == b"before [REDACTED] after"

    from tests.test_wrapper import _keyfile, _repo

    repo, criteria = _repo(tmp_path)
    (repo / "agent.py").write_text(
        "import os\n"
        "print('status ' + os.environ['ONE_CHAR_SECRET'])\n"
        "print('[REDACTED]')\n"
    )
    monkeypatch.setenv("ONE_CHAR_SECRET", "R")
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(repo), "--criteria", str(criteria),
                 "--pass-env", "ONE_CHAR_SECRET", "--hmac-key-file", str(_keyfile(tmp_path)),
                 "--hmac-key-id", "k1", "--", sys.executable, "agent.py"]) == 0
    events = Ledger(out / "ledger.jsonl").read()
    command_sha = next(e["payload"]["sha256"] for e in events
                       if e["type"] == "evidence.attached" and e["payload"].get("refers_to") == "agent_command")
    command_blob = BlobStore(out / "blobs").get(command_sha)
    assert b"status [REDACTED]\n[REDACTED]" in command_blob
    assert b"[[REDACTED]EDACTED]" not in command_blob


def test_51_trailer_processing_is_bounded_and_deep_input_fails_closed():
    deep = "[" * 600 + '"hidden"' + "]" * 600
    stdout = 'TRUTHLENS_CLAIMS: ' + deep + '\nTRUTHLENS_CLAIMS: [{"text":"done"}]'
    sanitized = _redact_claim_trailers(stdout, [])
    assert "hidden" not in sanitized
    assert extract_claims(sanitized)[0]["text"] == "done"

    item_count = MAX_INPUT // 7 + 10
    oversized = 'TRUTHLENS_CLAIMS: [' + ',   '.join(['"x"'] * item_count) + ']'
    assert len(oversized) > MAX_INPUT
    assert _redact_claim_trailers(oversized, []) == "[REDACTED] [input too large to redact safely]"


def test_51_long_secret_starting_with_redaction_marker_is_replaced(tmp_path, monkeypatch):
    secret = "[REDACTED]-qZ7"
    assert _scrub("status " + secret, [secret]) == "status [REDACTED]"
    assert _scrub_bytes(("status " + secret).encode(), [secret]) == b"status [REDACTED]"

    trailer = f'TRUTHLENS_CLAIMS: [{{"text":"status {secret}"}}]'
    sanitized = _redact_claim_trailers(trailer, [secret])
    assert extract_claims(sanitized)[0]["text"] == "status [REDACTED]"

    from tests.test_wrapper import _keyfile, _repo

    repo, criteria = _repo(tmp_path)
    (repo / "agent.py").write_text(
        "import os\n"
        "secret = os.environ['COMPOSITE_SECRET']\n"
        "print('TRUTHLENS_CLAIMS: [{\"text\": \"status ' + secret + '\"}]')\n"
    )
    monkeypatch.setenv("COMPOSITE_SECRET", secret)
    out = tmp_path / "run"
    assert main(["run", "--out", str(out), "--repo", str(repo), "--criteria", str(criteria),
                 "--pass-env", "COMPOSITE_SECRET", "--hmac-key-file", str(_keyfile(tmp_path)),
                 "--hmac-key-id", "k1", "--", sys.executable, "agent.py"]) == 0
    ledger_path = out / "ledger.jsonl"
    events = Ledger(ledger_path).read()
    assert next(e["payload"]["text"] for e in events if e["type"] == "agent.claim") == "status [REDACTED]"
    command_sha = next(e["payload"]["sha256"] for e in events
                       if e["type"] == "evidence.attached" and e["payload"].get("refers_to") == "agent_command")
    command_blob = BlobStore(out / "blobs").get(command_sha)
    assert secret.encode() not in command_blob + ledger_path.read_bytes()
    assert b"status [REDACTED]" in command_blob


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
