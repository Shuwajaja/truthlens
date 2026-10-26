"""ULID generation with prefixes per D1."""

import os
import time

_CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
_ALPHABET_LEN = len(_CROCKFORD_ALPHABET)
_ULID_LEN = 26


def _encode_base32(value: int, length: int) -> str:
    chars = []
    for _ in range(length):
        chars.append(_CROCKFORD_ALPHABET[value % _ALPHABET_LEN])
        value //= _ALPHABET_LEN
    return "".join(reversed(chars))


_last_timestamp_ms = 0
_last_random = 0


def new_id(prefix: str) -> str:
    """Generate a ULID with the given prefix.

    Returns ``{prefix}_`` followed by a 26-character Crockford Base32 ULID.
    IDs produced within the same process are monotonically ordered by
    creation time, including when the wall clock moves backward.
    """
    global _last_timestamp_ms, _last_random

    now_ms = int(time.time() * 1000)

    if now_ms > _last_timestamp_ms:
        _last_timestamp_ms = now_ms
        _last_random = int.from_bytes(os.urandom(10), "big")
    else:
        # Equal and backward ticks must both advance the suffix to avoid
        # repeating the previous ID while the wall clock catches up.
        now_ms = _last_timestamp_ms
        _last_random = (_last_random + 1) % (2**80)

    ts_part = _encode_base32(now_ms, 10)
    rand_part = _encode_base32(_last_random, 16)

    return f"{prefix}_{ts_part}{rand_part}"
