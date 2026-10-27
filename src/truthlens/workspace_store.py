"""Project-local workspace file. Paths stay in this file and out of agent status."""

from __future__ import annotations

import json
import os
import re
import tomllib
from pathlib import Path

HARNESSES = ("agent-zero", "codex", "claude-code", "agy")
CAPABILITIES = ("task_start", "task_end", "task_error", "artifacts", "structured_tests")
_PROJECT = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}\Z")
_PROFILE = re.compile(r"[a-z0-9][a-z0-9-]{0,63}\Z")
_KNOWN = {"schema_version", "project_id", "display_name", "root", "target_profile", "adapters"}


class WorkspaceError(Exception):
    def __init__(self, code: str, message: str, status: int = 1) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def slug(name: str) -> str:
    if _PROJECT.fullmatch(name) is None:
        raise WorkspaceError("USAGE", "Projektname fehlt oder ist ungültig", 2)
    return name.lower()


def check_profile(value: str) -> str:
    if _PROFILE.fullmatch(value) is None:
        raise WorkspaceError("USAGE", "Zielprofil fehlt oder ist ungültig", 2)
    return value


def resolve_root(value: str) -> Path:
    if not value or value.startswith(("http://", "https://")) or "\x00" in value:
        raise WorkspaceError("ROOT_INVALID", "Projektwurzel ist unzulässig", 1)
    root = Path(value).expanduser().resolve()
    if not root.is_dir():
        raise WorkspaceError("ROOT_INVALID", "Projektwurzel ist kein Verzeichnis", 1)
    return root


def config_path(root: Path, override: str | None = None) -> Path:
    if override:
        path = Path(override).expanduser()
        if not path.is_absolute():
            path = root / path
        return path.resolve()
    return root / ".truthlens" / "workspace.toml"


def _toml_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _dump_value(value: object) -> str:
    if isinstance(value, str):
        return _toml_string(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, list):
        return "[" + ", ".join(_dump_value(item) for item in value) + "]"
    raise WorkspaceError("SCHEMA", "Workspace-Datei enthält einen nicht unterstützten Wert", 1)


def dump_toml(document: dict, foreign: dict | None = None) -> str:
    lines = [
        f"schema_version = {int(document['schema_version'])}",
        f"project_id = {_toml_string(document['project_id'])}",
        f"display_name = {_toml_string(document['display_name'])}",
        f"root = {_toml_string(document['root'])}",
        f"target_profile = {_toml_string(document['target_profile'])}",
        "",
    ]
    for adapter in document["adapters"]:
        lines.append("[[adapters]]")
        lines.append(f"id = {_toml_string(adapter['id'])}")
        lines.append(f"version = {_toml_string(adapter['version'])}")
        lines.append("capabilities = " + _dump_value(list(adapter["capabilities"])))
        qualified = adapter.get("qualified_harness_version")
        if qualified:
            lines.append(f"qualified_harness_version = {_toml_string(qualified)}")
        lines.append("")
    for key, value in (foreign or {}).items():
        if isinstance(value, dict):
            lines.append(f"[{key}]")
            for child, inner in value.items():
                if isinstance(inner, dict):
                    raise WorkspaceError(
                        "SCHEMA", "Fremde Workspace-Struktur bleibt unverändert nur eine Ebene tief", 1
                    )
                lines.append(f"{child} = {_dump_value(inner)}")
            lines.append("")
        else:
            lines.append(f"{key} = {_dump_value(value)}")
    return "\n".join(lines).rstrip() + "\n"


def _atomic(path: Path, text: str) -> None:
    path.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def load(path: Path) -> tuple[dict, dict]:
    try:
        raw = tomllib.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, tomllib.TOMLDecodeError) as exc:
        raise WorkspaceError("WORKSPACE_INVALID", "Workspace-Datei ist ungültig oder unlesbar", 1) from exc
    if not isinstance(raw, dict):
        raise WorkspaceError("WORKSPACE_INVALID", "Workspace-Datei ist ungültig oder unlesbar", 1)
    foreign = {key: value for key, value in raw.items() if key not in _KNOWN}
    adapters = []
    for item in raw.get("adapters") or []:
        if not isinstance(item, dict) or item.get("id") not in HARNESSES:
            raise WorkspaceError("WORKSPACE_INVALID", "Workspace-Datei ist ungültig oder unlesbar", 1)
        qualified = item.get("qualified_harness_version")
        adapters.append(
            {
                "id": item["id"],
                "version": item.get("version")
                if isinstance(item.get("version"), str) and item.get("version")
                else "unknown",
                "capabilities": [cap for cap in item.get("capabilities") or [] if isinstance(cap, str)],
                "qualified_harness_version": qualified if isinstance(qualified, str) and qualified else None,
            }
        )
    document = {
        "schema_version": 1,
        "project_id": raw.get("project_id"),
        "display_name": raw.get("display_name"),
        "root": raw.get("root"),
        "target_profile": raw.get("target_profile"),
        "adapters": adapters,
    }
    if not all(
        isinstance(document[key], str) and document[key]
        for key in ("project_id", "display_name", "root", "target_profile")
    ):
        raise WorkspaceError("WORKSPACE_INVALID", "Workspace-Datei ist ungültig oder unlesbar", 1)
    return document, foreign


def managed_path(path: Path) -> Path:
    return path.with_name("managed-adapters.json")


def read_managed(path: Path) -> list[str]:
    pointer = managed_path(path)
    if not pointer.is_file():
        return []
    try:
        payload = json.loads(pointer.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return []
    if not isinstance(payload, list):
        return []
    return [item for item in payload if isinstance(item, str)]


def write_managed(path: Path, ids: list[str]) -> None:
    _atomic(managed_path(path), json.dumps(sorted(set(ids)), separators=(",", ":")) + "\n")


def save(path: Path, document: dict, foreign: dict | None = None) -> None:
    _atomic(path, dump_toml(document, foreign))


def blank(project: str, root: Path, profile: str) -> dict:
    return {
        "schema_version": 1,
        "project_id": slug(project),
        "display_name": project,
        "root": str(root),
        "target_profile": check_profile(profile),
        "adapters": [],
    }


def adapter(harness: str, qualified: str | None = None) -> dict:
    if harness not in HARNESSES:
        raise WorkspaceError("USAGE", "Unbekannter Adapter", 2)
    return {
        "id": harness,
        "version": "unknown",
        "capabilities": list(CAPABILITIES),
        "qualified_harness_version": qualified,
    }
