"""Explicit local file packaging; no directory discovery or harness execution."""
from __future__ import annotations

import base64
import csv
import io
import json
import os
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from truthlens import catalog
from truthlens.read_model import identifier
from truthlens.read_service import read_bytes
from truthlens.redaction import redact

MAX_CONTENT = 262144
TEXT_KINDS = {'.md': 'markdown', '.markdown': 'markdown', '.txt': 'text', '.log': 'text',
              '.py': 'code', '.js': 'code', '.ts': 'code', '.tsx': 'code', '.css': 'code',
              '.diff': 'diff', '.patch': 'diff', '.html': 'html', '.htm': 'html',
              '.json': 'json', '.csv': 'table'}


def _artifact(path: Path, index: int) -> dict:
    suffix = path.suffix.lower()
    raster = {'.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.gif': 'gif', '.webp': 'webp'}
    if suffix not in TEXT_KINDS and suffix not in raster:
        raise ValueError('unsupported file type; use text, JSON, CSV, HTML or a raster image')
    data = read_bytes(path, path.parent, limit=MAX_CONTENT)
    if suffix in raster:
        mime = raster[suffix]
        matches = {'png': data.startswith(b'\x89PNG\r\n\x1a\n'),
                   'jpeg': data.startswith(b'\xff\xd8\xff'),
                   'gif': data.startswith((b'GIF87a', b'GIF89a')),
                   'webp': data.startswith(b'RIFF') and data[8:12] == b'WEBP'}
        if not matches[mime]:
            raise ValueError('image signature does not match file extension')
        content = f'data:image/{mime};base64,' + base64.b64encode(data).decode('ascii')
        kind = 'image'
    else:
        content = data.decode('utf-8')
        kind = TEXT_KINDS[suffix]
        if suffix == '.json':
            parsed = json.loads(content)
            kind = next((k for k in ('chart', 'graph', 'timeline', 'table')
                         if path.name.lower().endswith(f'.{k}.json')), 'json')
            if not isinstance(parsed, (dict, list)):
                raise ValueError('JSON file must contain an object or array')
            content = redact(parsed)
        elif suffix == '.csv':
            rows = list(csv.reader(io.StringIO(content)))
            if len(rows) > 1001 or any(len(row) > 100 for row in rows):
                raise ValueError('CSV exceeds 1000 data rows or 100 columns')
            content = {'columns': rows[0] if rows else [], 'rows': rows[1:]}
        content = redact(content)
    encoded = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False, allow_nan=False)
    if len(encoded.encode('utf-8')) > MAX_CONTENT:
        raise ValueError('encoded artifact exceeds 256 KiB; use a smaller file')
    return {'id': f'file-{index}', 'path': redact(path.name), 'kind': kind, 'content': content}


def package_files(files: list[str], *, project: str, output_dir: str,
                  memory_path: str | None = None) -> dict:
    """Create a new local import bundle from explicit files; never overwrite a bundle."""
    identifier(project)
    if not 1 <= len(files) <= 32:
        raise ValueError('select between 1 and 32 files')
    target = Path(output_dir).absolute()
    if target.exists() or target.is_symlink():
        raise ValueError('output directory must not already exist')
    if not target.parent.is_dir() or any(p.is_symlink() for p in (target.parent, *target.parents)):
        raise ValueError('output parent must exist and contain no symlinks')
    artifacts = [_artifact(Path(name).absolute(), i) for i, name in enumerate(files)]
    notes = []
    if memory_path:
        path = Path(memory_path).absolute()
        memory = json.loads(read_bytes(path, path.parent, limit=2 * 1024 * 1024))
        notes = memory.get('records', memory.get('memory')) if isinstance(memory, dict) else None
        if not isinstance(notes, list) or len(notes) > 1000 or any(
            not isinstance(n, dict) or not isinstance(n.get('text'), str)
            or not n['text'].strip() or len(n['text']) > 65536 for n in notes
        ):
            raise ValueError('memory must contain up to 1000 records with nonempty text')
        notes = redact(notes)
    snapshot = {'schema_version': 'truthlens.factory-snapshot/1',
                'runs': [{'id': 'selected-files', 'title': 'Imported files',
                          'started': datetime.now(UTC).isoformat(),
                          'summary': 'Explicit local file import; no harness execution was recorded.',
                          'artifacts': artifacts, 'events': []}], 'memory': notes}
    config = {'schema_version': 'truthlens.sources/1',
              'projects': [{'id': project, 'name': project}],
              'workspaces': [{'id': 'selected-files', 'project_id': project, 'name': 'Imported files'}],
              'sources': [{'id': 'local-files', 'name': 'Selected local files', 'kind': 'factory',
                           'path': 'import.json', 'project_id': project, 'workspace_id': 'selected-files'}]}
    stage = Path(tempfile.mkdtemp(prefix='.truthlens-import-', dir=target.parent))
    try:
        for name, value in (('import.json', snapshot), ('sources.json', config)):
            with (stage / name).open('x', encoding='utf-8') as stream:
                json.dump(redact(value), stream, ensure_ascii=False, allow_nan=False)
                stream.flush()
                os.fsync(stream.fileno())
        catalog.rebuild(stage / 'sources.json', stage / 'catalog.sqlite')
        document = catalog.export_catalog(stage / 'catalog.sqlite', project=project)
        if any(source.get('errors') for source in document['sources']) or not document['runs']:
            raise ValueError('source validation failed; no bundle created')
        with (stage / 'workspace.json').open('x', encoding='utf-8') as stream:
            json.dump(document, stream, ensure_ascii=False, allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        # mkdir reserves the destination without replacing a concurrently created directory.
        target.mkdir()
        try:
            for path in stage.iterdir():
                os.replace(path, target / path.name)
        except BaseException:
            shutil.rmtree(target)
            raise
    finally:
        shutil.rmtree(stage)
    return {'project_id': project, 'directory': str(target),
            'workspace': str(target / 'workspace.json'), 'catalog': str(target / 'catalog.sqlite'),
            'artifacts': len(artifacts), 'memory_records': len(document['memory']),
            'mode': 'local snapshot import', 'image_note': 'Image pixels are not automatically redacted.'}
