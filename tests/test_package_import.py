"""Own-data onboarding must preserve scope, isolation and originals."""
import base64
import json

import pytest

from truthlens.package_import import package_files


def test_package_real_files_and_memory_through_catalog(tmp_path):
    from truthlens.catalog import export_catalog
    report = tmp_path / 'report.md'
    report.write_text('# My work\nAPI_KEY=fake-private-value')
    original = report.read_bytes()
    picture = tmp_path / 'screen.png'
    picture.write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII='))
    memory = tmp_path / 'notes.json'
    memory.write_text(json.dumps({'records': [{'id': 'note', 'text': 'Use large text', 'source_ref': 'report.md'}]}))
    dest = tmp_path / 'bundle'
    result = package_files([str(report), str(picture)], project='mine', output_dir=str(dest), memory_path=str(memory))
    doc = json.loads((dest / 'workspace.json').read_text())
    assert result['project_id'] == 'mine'
    run = doc['runs'][0]
    assert (run['origin'], run['integrity'], run['acceptance']) == ('IMPORTED', 'unknown', 'UNKNOWN')
    assert run['artifacts'][0]['content'] == '# My work\nAPI_KEY=[REDACTED]'
    assert run['artifacts'][1]['kind'] == 'image'
    assert base64.b64decode(run['artifacts'][1]['content'].split(',')[1]) == picture.read_bytes()
    assert doc['memory'][0]['text'] == 'Use large text'
    assert export_catalog(dest / 'catalog.sqlite', allowed_projects=['foreign'])['runs'] == []
    assert report.read_bytes() == original
    assert 'fake-private-value' not in (dest / 'import.json').read_text()
    with pytest.raises(ValueError):
        package_files([str(report)], project='mine', output_dir=str(dest))


@pytest.mark.parametrize('bad', ['oversize', 'symlink', 'image-mismatch', 'unsupported'])
def test_bad_input_leaves_no_package(tmp_path, bad):
    path = tmp_path / ('file.png' if bad == 'image-mismatch' else 'file.txt')
    if bad == 'symlink':
        real = tmp_path / 'real.txt'; real.write_text('hello'); path.symlink_to(real)
    elif bad == 'oversize':
        path.write_bytes(b'x' * 262145)
    elif bad == 'unsupported':
        path = tmp_path / 'file.svg'; path.write_text('<svg/>')
    else:
        path.write_text('not an image')
    dest = tmp_path / 'bundle'
    with pytest.raises((ValueError, OSError)):
        package_files([str(path)], project='mine', output_dir=str(dest))
    assert not dest.exists()


def test_json_redaction_preserves_structure(tmp_path):
    source = tmp_path / 'report.json'
    source.write_text('{"api_key":"fake-private-value","count":2,"nested":{"password":"private"}}')
    dest = tmp_path / 'bundle'
    package_files([str(source)], project='mine', output_dir=str(dest))
    doc = json.loads((dest / 'workspace.json').read_text())
    content = doc['runs'][0]['artifacts'][0]['content']
    assert json.loads(content) == {'api_key': '[REDACTED]', 'count': 2, 'nested': {'password': '[REDACTED]'}}
    assert 'fake-private-value' not in (dest / 'import.json').read_text()
