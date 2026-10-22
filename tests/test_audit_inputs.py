import os

import pytest

from truthlens.audit_inputs import AuditInputError, AuditLimits, SafeRunReader


def test_reader_refuses_symlink_fifo_and_parent_escape(tmp_path):
    root = tmp_path / "run"
    root.mkdir()
    (tmp_path / "outside").write_bytes(b"outside")
    (root / "link").symlink_to(tmp_path / "outside")
    os.mkfifo(root / "fifo")
    (root / "dir").symlink_to(tmp_path, target_is_directory=True)
    with SafeRunReader(root) as reader:
        for name in ["link", "fifo", "../outside", "/etc/passwd", "dir/outside", "./x", "x//y", "x/"]:
            with pytest.raises(AuditInputError):
                reader.read(name, limit=32)
    alias = tmp_path / "alias"
    alias.symlink_to(root, target_is_directory=True)
    with pytest.raises(AuditInputError), SafeRunReader(alias):
        pass


def test_reader_enforces_limits_before_and_during_read(tmp_path, monkeypatch):
    path = tmp_path / "file"
    path.write_bytes(b"abcd")
    with SafeRunReader(tmp_path, AuditLimits(total_bytes=4)) as reader:
        assert reader.read("file", limit=4) == b"abcd"
        assert reader.finish()["file"]
    with SafeRunReader(tmp_path) as reader, pytest.raises(AuditInputError, match="resource_limit"):
        reader.read("file", limit=3)
    original = os.read
    changed = False

    def growing(fd, size):
        nonlocal changed
        if not changed:
            changed = True
            with path.open("ab") as stream:
                stream.write(b"ef")
        return original(fd, size)

    with SafeRunReader(tmp_path, AuditLimits(total_bytes=4)) as reader:
        monkeypatch.setattr(os, "read", growing)
        with pytest.raises(AuditInputError):
            reader.read("file", limit=4)


@pytest.mark.parametrize("replace", [False, True])
def test_reader_detects_replace_and_same_size_rewrite(tmp_path, replace):
    path = tmp_path / "data"
    path.write_bytes(b"old")
    with SafeRunReader(tmp_path) as reader:
        assert reader.read("data", limit=3) == b"old"
        if replace:
            path.rename(tmp_path / "previous")
        path.write_bytes(b"new")
        with pytest.raises(AuditInputError, match="input_changed"):
            reader.finish()


def test_reader_reads_duplicate_path_once(tmp_path):
    (tmp_path / "a").write_bytes(b"abcd")
    with SafeRunReader(tmp_path, AuditLimits(total_bytes=4)) as reader:
        assert reader.read("a", limit=4) == reader.read("a", limit=4)
        with pytest.raises(TypeError):
            reader.digests["a"] = "not allowed"
        with pytest.raises(AuditInputError):
            reader.read("a", limit=3)
        assert len(reader.finish()) == 1


def test_reader_refuses_directory_swap_before_open(tmp_path, monkeypatch):
    root = tmp_path / "run"
    root.mkdir()
    (root / "nested").mkdir()
    (root / "nested" / "a").write_bytes(b"local")
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "a").write_bytes(b"outside")
    original = os.open
    swapped = False

    def swap(path, flags, *args, **kwargs):
        nonlocal swapped
        if path == "nested" and not swapped:
            swapped = True
            (root / "nested").rename(root / "saved")
            (root / "nested").symlink_to(outside, target_is_directory=True)
        return original(path, flags, *args, **kwargs)

    with SafeRunReader(root) as reader:
        monkeypatch.setattr(os, "open", swap)
        with pytest.raises(AuditInputError):
            reader.read("nested/a", limit=32)


def test_reader_detects_root_replacement(tmp_path):
    root = tmp_path / "run"
    root.mkdir()
    (root / "a").write_bytes(b"a")
    with SafeRunReader(root) as reader:
        reader.read("a", limit=1)
        root.rename(tmp_path / "old")
        root.mkdir()
        with pytest.raises(AuditInputError, match="input_changed"):
            reader.finish()


def test_private_key_file_is_external_owned_and_bounded(tmp_path):
    from truthlens.audit_inputs import read_audit_key

    root = tmp_path / "run"
    root.mkdir()
    key = tmp_path / "key"
    key.write_bytes(b" sk-test-private-key\n")
    key.chmod(0o600)
    assert read_audit_key(key, root) == b"sk-test-private-key"
    key.chmod(0o644)
    with pytest.raises(AuditInputError):
        read_audit_key(key, root)
    key.chmod(0o600)
    inside = root / "key"
    inside.write_bytes(b"sk-test-inside")
    inside.chmod(0o600)
    with pytest.raises(AuditInputError):
        read_audit_key(inside, root)
    link = tmp_path / "link"
    link.symlink_to(key)
    with pytest.raises(AuditInputError):
        read_audit_key(link, root)
    for value in (b"", b" " * 4096, b"x" * 4097):
        key.write_bytes(value)
        with pytest.raises(AuditInputError):
            read_audit_key(key, root)
