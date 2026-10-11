"""Redaction before hashing (Event Schema v1, D5).

Ported from ai-agent-workspace @ ec0868c:core/redaction.py (concept + patterns);
changed: plain "[REDACTED]" marker (no hash hint), secret-name match on keys, CLI args
(`--password x`, `--token=x`) and env assignments (`API_KEY=x`), secrets embedded in longer
strings are replaced in place, tuples handled like lists, no minimum secret length.
Token *counters* (max_tokens, tokens_used, ...) are metrics, not secrets, and stay untouched.
"""

from __future__ import annotations

import re
from typing import Any

REDACTED = "[REDACTED]"

_NAME = (
    r"(?:secret|password|passwd|pwd|api[_-]?key|access[_-]?key|private[_-]?key|authorization"
    r"|credentials?|cookie|session[_-]?id|token)"
)
_KEY_PATTERN = re.compile(rf"(?i){_NAME}")
_FLAG = re.compile(rf"(?i)^--?[a-z0-9_-]*{_NAME}[a-z0-9_-]*$")
_FLAG_VAL = re.compile(rf"(?i)(?<![A-Za-z0-9_-])(--?[a-z0-9_-]{{0,64}}?{_NAME}[a-z0-9_-]{{0,64}})\s+([^\s;&|]+)")

_COUNTER_NAMES = frozenset({
    "max_tokens", "max_token", "num_tokens", "total_tokens",
    "input_tokens", "output_tokens", "prompt_tokens", "completion_tokens",
    "tokens_used", "token_count", "tokens", "max_completion_tokens",
})


def _is_counter(name: str) -> bool:
    return name.lower().replace("-", "_") in _COUNTER_NAMES

_VALUE_PATTERN = re.compile(
    r"(?<![A-Za-z0-9])(?:sk-[A-Za-z0-9_\-]{3,}"
    r"|gh[pousr]_[A-Za-z0-9]+"
    r"|github_pat_[A-Za-z0-9_]+"
    r"|xox[abposr]-[A-Za-z0-9-]+"
    r"|AIza[0-9A-Za-z_\-]{10,}"
    r"|AKIA[0-9A-Z]{12,}"
    r"|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*)"
    r"|(?i:bearer|basic)\s+[A-Za-z0-9._~+/=\-]+"
    r"|-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"
)
# NAME=value / NAME: value / --name=value inside free text (env dumps, logs, commands)
_ASSIGN = re.compile(rf"(?i)(?<![A-Za-z0-9_.-])([\"']?[A-Za-z0-9_.-]{{0,64}}?{_NAME}[A-Za-z0-9_.-]{{0,64}}[\"']?\s{{0,4}}[=:]\s{{0,4}})(\"[^\"]*\"|'[^']*'|[^\s&|]+)")
_URL_CRED = re.compile(r"(?<=://)(?:[^/\s:@]+(?::[^/\s@]+)?|:[^/\s@]+)(?=@)")


def is_secret_key(key: str) -> bool:
    return bool(_KEY_PATTERN.search(key)) and not _is_counter(key)


def _flag_val(m: re.Match) -> str:
    flag = m.group(1)
    return m.group(0) if _is_counter(flag.lstrip("-")) else m.group(1) + " " + REDACTED


def redact_str(value: str) -> str:
    value = _URL_CRED.sub(REDACTED, value)
    value = _VALUE_PATTERN.sub(REDACTED, value)

    def _assign(m: re.Match) -> str:
        name = m.group(1).split("=")[0].split(":")[0].strip().strip("'\"")
        return m.group(0) if _is_counter(name.lstrip("-")) or m.group(2) == REDACTED else m.group(1) + REDACTED

    value = _ASSIGN.sub(_assign, value)
    value = _FLAG_VAL.sub(_flag_val, value)
    return value


def _redact_seq(items) -> list:
    out, hide_next = [], False
    for item in items:
        if hide_next and isinstance(item, str):
            out.append(REDACTED)
            hide_next = False
            continue
        hide_next = isinstance(item, str) and bool(_FLAG.match(item)) and not _is_counter(item.lstrip("-"))
        out.append(redact(item))
    return out


def redact(obj: Any) -> Any:
    """Return a redacted deep copy (tuples become lists); the input is never mutated."""
    if isinstance(obj, dict):
        return {
            k: REDACTED if isinstance(k, str) and is_secret_key(k) and v is not None else redact(v)
            for k, v in obj.items()
        }
    if isinstance(obj, (list, tuple)):
        return _redact_seq(obj)
    if isinstance(obj, str):
        return redact_str(obj)
    return obj
