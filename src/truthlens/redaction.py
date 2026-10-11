"""Redaction before hashing (Event Schema v1, D5).

Ported from ai-agent-workspace @ ec0868c:core/redaction.py (concept + patterns);
changed: plain "[REDACTED]" marker (no hash hint), key match by substring,
secrets embedded inside longer strings are replaced in place.
"""

import re
from typing import Any

REDACTED = "[REDACTED]"

_KEY_PATTERN = re.compile(r"(?i)(secret|token|password|passwd|api[_-]?key|authorization|private[_-]?key)")
_VALUE_PATTERN = re.compile(
    r"(sk-[A-Za-z0-9_\-]{8,}"
    r"|gh[pousr]_[A-Za-z0-9]{8,}"
    r"|github_pat_[A-Za-z0-9_]{8,}"
    r"|(?i:bearer)\s+[A-Za-z0-9._~+/=\-]{8,}"
    r"|AKIA[0-9A-Z]{12,}"
    r"|-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----)"
)


def redact_str(value: str) -> str:
    return _VALUE_PATTERN.sub(REDACTED, value)


def redact(obj: Any) -> Any:
    """Return a redacted deep copy; the input is never mutated."""
    if isinstance(obj, dict):
        return {k: REDACTED if isinstance(k, str) and _KEY_PATTERN.search(k) else redact(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact(item) for item in obj]
    if isinstance(obj, str):
        return redact_str(obj)
    return obj
