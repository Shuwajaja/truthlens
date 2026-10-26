"""Keep personal home directories out of tracked public text, without echoing them."""

from __future__ import annotations

import hashlib
import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
HOME_PATH = re.compile(r"/(?:home|Users)/([^/\s]+)/")
PLACEHOLDER_USERS = frozenset({"example", "<user>"})
# Exact immutable exception: this published traceback is addressed by its SHA-256.
# Editing it would invalidate the demo's recorded evidence. No directory exemptions.
IMMUTABLE_BLOBS = {
    "demo/runs/demo-2/blobs/sha256/de/dedecd82fa4273c2f24733822c79ef4796927bed2f8a9fd33122210b1156afab": "Published content-addressed traceback; preserve the recorded artifact hash.",
}


def _personal_path_lines(text: str) -> list[int]:
    # JSON may escape slashes. Decode that spelling without interpreting arbitrary escapes.
    return [
        number
        for number, line in enumerate(text.splitlines(), 1)
        if any(match[1] not in PLACEHOLDER_USERS for match in HOME_PATH.finditer(line.replace(r"\/", "/")))
    ]


def _tracked_path_diagnostics(root: Path) -> list[str]:
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode("utf-8").split("\0")
    diagnostics = []
    for name in filter(None, tracked):
        data = (root / name).read_bytes()
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            continue
        lines = _personal_path_lines(text)
        if name in IMMUTABLE_BLOBS:
            # The exception cannot mask edited content or silently become obsolete.
            if not lines or hashlib.sha256(data).hexdigest() != Path(name).name:
                diagnostics.append(f"{name}:1")
            continue
        diagnostics.extend(f"{name}:{number}" for number in lines)
    diagnostics.extend(f"{name}:1" for name in IMMUTABLE_BLOBS.keys() - set(tracked))
    return diagnostics


def test_tracked_utf8_text_has_no_personal_home_paths():
    diagnostics = _tracked_path_diagnostics(ROOT)
    if diagnostics:
        # No assertion introspection, source excerpts, matched values or absolute roots.
        pytest.fail("\n".join(diagnostics), pytrace=False)


@pytest.mark.parametrize("prefix", ["/home/", "/Users/"])
def test_detector_rejects_personal_names_and_multiple_matches(prefix):
    private_path = prefix + "private" + "-account/project/"
    text = f"neutral\n{prefix}example/project/ {private_path}\n{private_path}{private_path}\n"
    assert _personal_path_lines(text) == [2, 3]
    assert _personal_path_lines(text.replace("/", r"\/")) == [2, 3]


def test_detector_allows_only_explicit_placeholder_users():
    assert _personal_path_lines("/home/example/repo/ /Users/<user>/repo/\n$HOME/repo/") == []
    assert _personal_path_lines("/srv/truthlens/ /etc/truthlens/ /var/lib/ /opt/tools/ /run/service/") == []


def test_scan_uses_tracked_utf8_files_and_safe_diagnostics(tmp_path, monkeypatch):
    subprocess.run(
        ["git", "init", "--quiet", "--template=", "--initial-branch=main"],
        cwd=tmp_path,
        check=True,
        capture_output=True,
    )
    private_path = "/Users/" + "private" + "-account/project/"
    (tmp_path / "tracked notes.md").write_text("neutral\n" + private_path, encoding="utf-8")
    (tmp_path / "binary.dat").write_bytes(b"\xff" + private_path.encode())
    (tmp_path / "untracked.md").write_text(private_path, encoding="utf-8")
    subprocess.run(
        ["git", "add", "--", "tracked notes.md", "binary.dat"], cwd=tmp_path, check=True, capture_output=True
    )
    monkeypatch.setattr("tests.test_public_paths.IMMUTABLE_BLOBS", {})
    assert _tracked_path_diagnostics(tmp_path) == ["tracked notes.md:2"]


def test_immutable_exception_rejects_changed_content(tmp_path, monkeypatch):
    # Even a same-path exception may not hide new personal content.
    name = "a" * 64
    (tmp_path / name).write_text("/home/" + "private" + "-account/project/", encoding="utf-8")
    monkeypatch.setattr("tests.test_public_paths.IMMUTABLE_BLOBS", {name: "Synthetic immutable fixture"})
    monkeypatch.setattr(subprocess, "check_output", lambda *args, **kwargs: (name + "\0").encode())
    assert _tracked_path_diagnostics(tmp_path) == [f"{name}:1"]
