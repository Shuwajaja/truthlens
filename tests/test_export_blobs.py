import hashlib

from truthlens.export import blob_texts


def test_blob_texts_verified_text_only_and_redacted():
    diff = b"diff --git a/x b/x\n@@ -1 +1 @@\n-a\n+password=hunter2secret\n"
    bad = b"tampered"
    store = {hashlib.sha256(diff).hexdigest(): diff, "f" * 64: bad, hashlib.sha256(b"\xff").hexdigest(): b"\xff"}
    evs = [{"payload": {"sha256": s}} for s in store] + [{"payload": {"sha256": "0" * 64}}]
    out = blob_texts(evs, store.get)
    assert list(out) == [hashlib.sha256(diff).hexdigest()]
    assert "hunter2secret" not in next(iter(out.values())) and "+password=" in next(iter(out.values()))
