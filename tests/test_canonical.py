"""Tests for canonical JSON (D4) and ULID IDs (D1)."""

import unicodedata

from truthlens.canonical import CanonicalError, canonical_bytes
from truthlens.ids import new_id


def test_golden_vector_simple():
    obj = {"name": "test", "value": 42}
    assert canonical_bytes(obj) == b'{"name":"test","value":42}'


def test_golden_vector_nested():
    obj = {"z": {"a": 1}, "a": [3, 2, 1]}
    assert canonical_bytes(obj) == b'{"a":[3,2,1],"z":{"a":1}}'


def test_golden_vector_unicode():
    obj = {"caf\u00e9": 1, "\u00e9clair": 2}
    result = canonical_bytes(obj)
    assert result == b'{"caf\xc3\xa9":1,"\xc3\xa9clair":2}'


def test_float_rejected():
    for val in [1.5, float("nan"), float("inf"), float("-inf")]:
        try:
            canonical_bytes({"x": val})
            assert False, f"expected CanonicalError for {val}"
        except CanonicalError:
            pass


def test_nan_top_level():
    try:
        canonical_bytes(float("nan"))
        assert False
    except CanonicalError:
        pass


def test_nfc_equivalence():
    composed = "\u00e9"
    decomposed = "\u0065\u0301"
    assert unicodedata.normalize("NFC", decomposed) == composed
    c1 = canonical_bytes({"key": decomposed})
    c2 = canonical_bytes({"key": composed})
    assert c1 == c2


def test_nfc_key_equivalence():
    composed = "\u00c9"
    decomposed = "\u0045\u0301"
    c1 = canonical_bytes({decomposed: 1})
    c2 = canonical_bytes({composed: 1})
    assert c1 == c2


def test_non_str_key_rejected():
    try:
        canonical_bytes({1: "value"})
        assert False
    except CanonicalError:
        pass


def test_unsupported_type_rejected():
    try:
        canonical_bytes({"key": b"bytes"})
        assert False
    except CanonicalError:
        pass


def test_ulid_format():
    uid = new_id("evt")
    assert uid.startswith("evt_")
    assert len(uid) == 4 + 26
    suffix = uid[4:]
    assert all(c in "0123456789ABCDEFGHJKMNPQRSTVWXYZ" for c in suffix)


def test_ulid_monotonic():
    ids = [new_id("run") for _ in range(100)]
    assert ids == sorted(ids)