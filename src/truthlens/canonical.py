"""Canonical JSON per D4: UTF-8, sorted keys, NFC-normalized, no floats."""

import json
import unicodedata


class CanonicalError(ValueError):
    """Raised when a Python object cannot be serialized to canonical JSON."""


class _CanonicalEncoder(json.JSONEncoder):
    def _validate(self, obj):
        if isinstance(obj, float):
            raise CanonicalError("float values are not allowed")
        if isinstance(obj, dict):
            for k, v in obj.items():
                if not isinstance(k, str):
                    raise CanonicalError(
                        f"non-string key: {type(k).__name__}"
                    )
                self._validate(v)
        elif isinstance(obj, list):
            for item in obj:
                self._validate(item)
        elif obj is not None and not isinstance(obj, (bool, int, str)):
            raise CanonicalError(
                f"unsupported type: {type(obj).__name__}"
            )

    def _normalize(self, obj):
        if isinstance(obj, str):
            return unicodedata.normalize("NFC", obj)
        if isinstance(obj, dict):
            return {
                unicodedata.normalize("NFC", k): self._normalize(v)
                for k, v in obj.items()
            }
        if isinstance(obj, list):
            return [self._normalize(item) for item in obj]
        return obj

    def encode(self, obj):
        self._validate(obj)
        normalized = self._normalize(obj)
        return super().encode(normalized)

    def iterencode(self, obj, _one_shot=False):
        self._validate(obj)
        normalized = self._normalize(obj)
        return super().iterencode(normalized, _one_shot)


def canonical_bytes(obj) -> bytes:
    """Serialize obj to canonical JSON bytes.

    Raises CanonicalError if obj contains floats (including NaN/Infinity),
    non-string keys, or other unsupported types.
    """
    encoder = _CanonicalEncoder(
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    raw = encoder.encode(obj)
    if isinstance(raw, str):
        raw = raw.encode("utf-8")
    if isinstance(raw, bytes):
        return raw
    return raw.encode("utf-8")