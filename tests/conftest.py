import pytest


@pytest.fixture(autouse=True)
def _anchor_dir(tmp_path_factory, monkeypatch):
    # gate rollback anchors go outside run dirs; keep them per test, never in the real HOME
    monkeypatch.setenv("TRUTHLENS_ANCHOR_DIR", str(tmp_path_factory.mktemp("anchors")))
