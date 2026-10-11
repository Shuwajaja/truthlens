import pytest

from truthlens.store import BlobStore, StoreError


def test_put_get_and_corruption_detected(tmp_path):
    s = BlobStore(tmp_path)
    h = s.put(b"hello")
    assert s.put(b"hello") == h and s.get(h) == b"hello"
    s.path(h).write_bytes(b"evil")
    with pytest.raises(StoreError):
        s.get(h)
