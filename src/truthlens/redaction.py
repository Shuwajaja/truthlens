import re
from typing import Any

REDACTED = "[REDACTED]"

_KEY_PATTERN = re.compile(r"(?i)^(secret|token|password|api[_-]?key|authorization)$")
_VALUE_PATTERNS = (
    re.compile(r"^sk-\S+"),
    re.compile(r"^ghp_\S+"),
    re.compile(r"^github_pat_\S+"),
    re.compile(r"^Bearer\s+\S+"),
    re.compile(r"^AKIA\S*"),
)


def _is_sensitive_key(key: str) -> bool:
    return bool(_KEY_PATTERN.match(key))


def _is_sensitive_value(value: str) -> bool:
    for pat in _VALUE_PATTERNS:
        if pat.match(value):
            return True
    return False


def redact(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: REDACTED if _is_sensitive_key(k) else redact(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [redact(item) for item in obj]
    if isinstance(obj, str):
        return REDACTED if _is_sensitive_value(obj) else obj
    return obj