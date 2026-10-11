import copy
import json

from truthlens.redaction import REDACTED, redact


def test_redact_keys():
    obj = {"api_key": "secret123", "safe": "hello"}
    result = redact(obj)
    assert result["api_key"] == REDACTED
    assert result["safe"] == "hello"


def test_redact_keys_case_insensitive():
    obj = {"Authorization": "Bearer abc", "TOKEN": "tkn123"}
    result = redact(obj)
    assert result["Authorization"] == REDACTED
    assert result["TOKEN"] == REDACTED


def test_redact_patterns():
    obj = {"key": "sk-proj-abc12345"}
    result = redact(obj)
    assert result["key"] == REDACTED


def test_redact_known_patterns():
    obj = {"a": "ghp_abc12345678", "b": "github_pat_abc12345678", "c": "Bearer tok12345678", "d": "AKIAABCDEFGHIJKL"}
    result = redact(obj)
    assert result["a"] == REDACTED
    assert result["b"] == REDACTED
    assert result["c"] == REDACTED
    assert result["d"] == REDACTED


def test_redact_nested_in_lists():
    obj = [{"api_key": "sk-abc12345678"}, {"password": "ghp_xyz"}]
    result = redact(obj)
    assert result[0]["api_key"] == REDACTED
    assert result[1]["password"] == REDACTED


def test_redact_plain_marker():
    assert REDACTED == "[REDACTED]"


def test_input_unchanged():
    obj = {"api_key": "sk-secret"}
    orig = copy.deepcopy(obj)
    redact(obj)
    assert obj == orig


def test_secret_never_in_dumps():
    obj = {"api_key": "sk-proj-secret", "token": "ghp_abc", "password": "Bearer tok12345678"}
    result = redact(obj)
    dumped = json.dumps(result, separators=(",", ":"))
    assert "sk-proj-secret" not in dumped
    assert "ghp_abc" not in dumped
    assert "Bearer tok12345678" not in dumped

def test_compound_keys_and_embedded_secrets():
    secret = "sk-or-v1-0123456789abcdef"
    obj = {"OPENROUTER_API_KEY": "x", "client_secret": "y", "cmd": f"export K={secret} && run"}
    result = redact(obj)
    assert result["OPENROUTER_API_KEY"] == REDACTED
    assert result["client_secret"] == REDACTED
    assert result["cmd"] == f"export K={REDACTED} && run"
    assert secret not in json.dumps(result)


def test_codex_review_bypasses_closed():
    from truthlens.canonical import canonical_bytes

    obj = {
        "args": ["--password", "hunter2", "--token=abc123", "-v"],
        "env": "API_KEY=topsecret PATH=/bin",
        "url": "https://user:pw@host/x",
        "hdr": "Authorization: Basic dXNlcjpwdw==",
        "slack": "xoxb-1-2", "google": "AIzaSyA1234567890abc",
        "jwt": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
        "short": "Bearer abc sk-test ghp_abc",
        "t": ("sk-abcdefghijk", {"password": "p"}),
    }
    out = canonical_bytes(redact(obj)).decode()
    for leaked in ("hunter2", "abc123", "topsecret", "user:pw", "dXNlcjpwdw", "xoxb-1", "AIzaSy",
                   "eyJhbGci", "Bearer abc", "sk-test", "ghp_abc", "sk-abcdefghijk", '"p"'):
        assert leaked not in out, leaked
    assert "PATH=/bin" in out and '"-v"' in out


def test_token_counters_are_not_secrets():
    obj = {"max_tokens": 100, "tokens_used": 42, "usage": {"prompt_tokens": 3}, "cmd": "run --max-tokens 50"}
    assert redact(obj) == obj


def test_linear_time_on_large_input():
    import time

    t = time.monotonic()
    redact({"blob": "a" * 60000, "b": "token" * 12000, "c": "x=" * 30000})
    assert time.monotonic() - t < 1.0
