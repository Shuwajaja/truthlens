"""Write or print a local MCP entry, and check catalog readiness.

The key value is never stored or printed. Config files keep only the env var
name. ``truthlens doctor`` with no status-doctor flag scans harnesses and
does not write. ``truthlens doctor --socket`` stays the isolation doctor.
"""

from __future__ import annotations

import argparse
import json
import os
import stat
import sys
import tempfile
import tomllib
from collections.abc import Mapping
from pathlib import Path

AGENTS = ("agent-zero", "codex", "gemini", "claude-code", "cursor", "mausbot")
PROMPT_AGENTS = ("codex", "claude-code", "gemini", "cursor", "agent-zero")
_KEY_NAME = r"[A-Za-z_][A-Za-z0-9_]{0,63}"
_MAX_CONFIG = 2_000_000
_MCP_DOCTOR_FLAGS = {
    "--agent",
    "--root",
    "--key-env",
    "--agent-zero-settings",
    "--mausbot-config",
}
_DEFAULT_KEY = "TRUTHLENS_HMAC_KEY"


class SetupError(Exception):
    def __init__(self, message: str = "setup unavailable.") -> None:
        super().__init__(message)
        self.message = message


class _Parser(argparse.ArgumentParser):
    message = "setup unavailable."

    def error(self, _message: str) -> None:
        sys.stderr.write(self.message + "\n")
        raise SystemExit(2)


def mcp_doctor_argv(argv: list[str]) -> bool:
    """Bare doctor is the catalog scan. Status flags stay on the isolation doctor."""
    flags = [item.split("=", 1)[0] for item in argv if item.startswith("-")]
    return not flags or all(item in _MCP_DOCTOR_FLAGS for item in flags)


def valid_key_name(name: str, environ: Mapping[str, str]) -> bool:
    import re

    if re.fullmatch(_KEY_NAME, name) is None:
        return False
    return all(value != name or key == name for key, value in environ.items())


def _toml_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def catalog_entry(root: str, key_env: str) -> dict:
    return {
        "command": "truthlens",
        "args": ["mcp", "--hmac-key-env", key_env],
        "env": {"TRUTHLENS_ROOT": root},
    }


def render_codex(root: str, key_env: str) -> str:
    args = ", ".join(_toml_string(part) for part in ("mcp", "--hmac-key-env", key_env))
    return (
        "[mcp_servers.truthlens]\n"
        'command = "truthlens"\n'
        f"args = [{args}]\n"
        f"env_vars = [{_toml_string(key_env)}]\n"
        "\n"
        "[mcp_servers.truthlens.env]\n"
        f"TRUTHLENS_ROOT = {_toml_string(root)}\n"
    )


def render_json(agent: str, root: str, key_env: str) -> str:
    key = "mcp_servers" if agent == "agent-zero" else "mcpServers"
    return json.dumps({key: {"truthlens": catalog_entry(root, key_env)}}, indent=2) + "\n"


def render_config(agent: str, root: str, key_env: str) -> str:
    if agent == "codex":
        return render_codex(root, key_env)
    if agent not in AGENTS:
        raise SetupError("error: unknown agent")
    return render_json(agent, root, key_env)


def render_prompt(agent: str) -> str:
    if agent not in AGENTS:
        raise SetupError("error: unknown agent")
    title = {
        "codex": "Codex",
        "claude-code": "Claude Code",
        "gemini": "Gemini / agy",
        "cursor": "Cursor",
        "agent-zero": "Agent Zero",
        "mausbot": "Mausbot",
    }[agent]
    return (
        f"# {title}\n"
        "Ask the user before writing any config file.\n"
        "Never write or print the key value. Only the env var name is allowed.\n"
        "1. Install TruthLens (Python 3.12+) from a reviewed checkout: pip install -e .\n"
        "2. Ask the user for the local runs directory.\n"
        "3. After the user agrees, run:\n"
        f"truthlens setup --agent {agent} --root <path> --key-env TRUTHLENS_HMAC_KEY --write\n"
        "That write makes a .bak of an existing file first.\n"
        "4. The user sets TRUTHLENS_HMAC_KEY in their own environment.\n"
        "Without that key, verdicts stay unklar / UNKNOWN.\n"
        "5. Run: truthlens doctor\n"
        "Report the RESULT line to the user.\n"
    )


def render_prompts(agent: str | None) -> str:
    names = (agent,) if agent else PROMPT_AGENTS
    return "\n".join(render_prompt(name) for name in names)


def _check_values(agent: str, root: str, key_env: str, environ: Mapping[str, str]) -> None:
    if agent not in AGENTS:
        raise SetupError("error: unknown agent")
    if not root or "\n" in root or "\r" in root:
        raise SetupError("error: root path is not valid")
    if not valid_key_name(key_env, environ):
        raise SetupError("error: key-env must be an env var name")
    if any(value and value == root for value in environ.values()):
        raise SetupError("error: root path is not valid")


def destination(
    agent: str,
    *,
    home: Path,
    environ: Mapping[str, str],
    config: str | None,
) -> Path:
    if config:
        return Path(config)
    if agent == "codex":
        base = Path(environ["CODEX_HOME"]) if environ.get("CODEX_HOME") else home / ".codex"
        return base / "config.toml"
    if agent == "claude-code":
        return home / ".claude.json"
    if agent == "gemini":
        base = Path(environ["GEMINI_CLI_HOME"]) if environ.get("GEMINI_CLI_HOME") else home / ".gemini"
        return base / "settings.json"
    if agent == "cursor":
        return home / ".cursor" / "mcp.json"
    if agent == "agent-zero":
        raw = environ.get("TRUTHLENS_AGENT_ZERO_SETTINGS", "")
    else:
        raw = environ.get("TRUTHLENS_MAUSBOT_CONFIG", "")
    if not raw:
        raise SetupError("error: pass --config or the harness path env for this agent")
    return Path(raw)


def _atomic(path: Path, data: bytes) -> None:
    if path.is_symlink():
        raise SetupError("error: refusing symlink")
    parent = path.parent
    parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(tmp_name, 0o600)
        os.replace(tmp_name, path)
    except OSError:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def merge_text(agent: str, existing: str | None, root: str, key_env: str) -> str:
    if agent == "codex":
        kept = _strip_toml(existing or "")
        body = render_codex(root, key_env)
        if kept.strip():
            return kept.rstrip() + "\n\n" + body
        return body
    key = "mcp_servers" if agent == "agent-zero" else "mcpServers"
    try:
        doc = json.loads(existing) if existing and existing.strip() else {}
    except json.JSONDecodeError as exc:
        raise SetupError("error: config is not valid JSON") from exc
    if not isinstance(doc, dict):
        raise SetupError("error: config is not a JSON object")
    servers = doc.get(key, {})
    if not isinstance(servers, dict):
        raise SetupError("error: mcp server table is not an object")
    servers = dict(servers)
    servers["truthlens"] = catalog_entry(root, key_env)
    doc[key] = servers
    return json.dumps(doc, indent=2) + "\n"


def _strip_toml(text: str) -> str:
    kept: list[str] = []
    skipping = False
    for line in text.splitlines(keepends=True):
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            name = stripped[1:-1].strip().strip('"')
            skipping = name == "mcp_servers.truthlens" or name.startswith("mcp_servers.truthlens.")
        if not skipping:
            kept.append(line)
    return "".join(kept)


def write_config(path: Path, text: str) -> None:
    if path.is_symlink() or (path.exists() and not path.is_file()):
        raise SetupError("error: cannot write config")
    if path.is_file():
        _atomic(Path(str(path) + ".bak"), path.read_bytes())
    try:
        _atomic(path, text.encode("utf-8"))
    except SetupError:
        raise
    except OSError as exc:
        raise SetupError("error: cannot write config") from exc


def _binary_found(names: tuple[str, ...], path_env: str) -> bool:
    for directory in path_env.split(os.pathsep):
        if not directory:
            continue
        for name in names:
            candidate = Path(directory) / name
            try:
                info = candidate.stat()
            except OSError:
                continue
            if stat.S_ISREG(info.st_mode) and os.access(candidate, os.X_OK):
                return True
    return False


def _read_regular(path: Path) -> str | None:
    """Return file text. None if the path is missing. Raise if it cannot be read safely."""
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except FileNotFoundError:
        return None
    except OSError as exc:
        raise SetupError("unreadable") from exc
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > _MAX_CONFIG:
            raise SetupError("unreadable")
        with os.fdopen(fd, "rb", closefd=False) as handle:
            raw = handle.read(_MAX_CONFIG + 1)
    finally:
        os.close(fd)
    if len(raw) > _MAX_CONFIG:
        raise SetupError("unreadable")
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise SetupError("unreadable") from exc


def _config_path(agent: str, home: Path, environ: Mapping[str, str], overrides: Mapping[str, str]) -> Path | None:
    if agent == "agent-zero":
        raw = overrides.get("agent-zero") or environ.get("TRUTHLENS_AGENT_ZERO_SETTINGS", "")
        return Path(raw) if raw else None
    if agent == "mausbot":
        raw = overrides.get("mausbot") or environ.get("TRUTHLENS_MAUSBOT_CONFIG", "")
        return Path(raw) if raw else None
    try:
        return destination(agent, home=home, environ=environ, config=None)
    except SetupError:
        return None


def _inspect(text: str) -> tuple[bool, list[str], list[str]]:
    try:
        if text.lstrip().startswith("{"):
            doc = json.loads(text)
            if not isinstance(doc, dict):
                return False, [], []
            block = doc.get("mcpServers")
            if not isinstance(block, dict):
                block = doc.get("mcp_servers")
            server = block.get("truthlens") if isinstance(block, dict) else None
        else:
            doc = tomllib.loads(text)
            block = doc.get("mcp_servers")
            server = block.get("truthlens") if isinstance(block, dict) else None
    except (json.JSONDecodeError, tomllib.TOMLDecodeError, UnicodeError, ValueError):
        raise SetupError("unreadable") from None
    if not isinstance(server, dict):
        return False, [], []
    roots: list[str] = []
    keys: list[str] = []
    env = server.get("env")
    if isinstance(env, dict) and isinstance(env.get("TRUTHLENS_ROOT"), str):
        roots.append(env["TRUTHLENS_ROOT"])
    args = server.get("args")
    if isinstance(args, list):
        for index, item in enumerate(args):
            if item == "--hmac-key-env" and index + 1 < len(args) and isinstance(args[index + 1], str):
                keys.append(args[index + 1])
    for item in server.get("env_vars") or []:
        if isinstance(item, str) and item not in keys:
            keys.append(item)
    return True, roots, keys


_BINARIES = {
    "codex": ("codex",),
    "claude-code": ("claude",),
    "gemini": ("gemini", "agy"),
    "cursor": ("cursor-agent",),
    "agent-zero": (),
    "mausbot": (),
}


def _root_state(paths: list[str]) -> str:
    if not paths:
        return "unconfigured"
    state = "ok"
    for raw in paths:
        path = Path(raw)
        if not path.exists():
            return "missing"
        if not path.is_dir() or not os.access(path, os.R_OK | os.X_OK):
            state = "unreadable"
    return state


def _key_state(names: list[str], environ: Mapping[str, str]) -> str:
    if not names:
        return "unconfigured"
    for name in names:
        if not environ.get(name, "").strip():
            return "missing"
    return "present"


def doctor_report(
    *,
    home: Path,
    environ: Mapping[str, str],
    root: str | None = None,
    key_env: str | None = None,
    agent_zero: str | None = None,
    mausbot: str | None = None,
) -> tuple[int, str]:
    overrides = {}
    if agent_zero:
        overrides["agent-zero"] = agent_zero
    if mausbot:
        overrides["mausbot"] = mausbot
    rows: list[str] = []
    roots: list[str] = [root] if root else []
    keys: list[str] = [key_env] if key_env else []
    entries = 0
    path_env = environ.get("PATH", "")
    for agent in AGENTS:
        found = _binary_found(_BINARIES[agent], path_env)
        entry = False
        hint = f"truthlens setup --agent {agent}"
        config = _config_path(agent, home, environ, overrides)
        if config is not None and (config.exists() or config.is_symlink()):
            found = True
            try:
                text = _read_regular(config)
            except SetupError:
                hint = "config unreadable"
                text = None
            if text is not None:
                try:
                    present, found_roots, found_keys = _inspect(text)
                except SetupError:
                    hint = "config unreadable"
                    present = False
                    found_roots, found_keys = [], []
                if present:
                    entry = True
                    entries += 1
                    hint = "vorhanden"
                    if root is None:
                        roots.extend(found_roots)
                    if key_env is None:
                        keys.extend(found_keys)
        if not found:
            entry = False
        rows.append(f"{agent} | {'ja' if found else 'nein'} | {'ja' if entry else 'nein'} | {hint}")
    if root is None and not roots:
        env_root = environ.get("TRUTHLENS_ROOT", "").strip()
        if env_root:
            roots.append(env_root)
    if key_env is None and not keys:
        keys.append(_DEFAULT_KEY)
    root_state = _root_state(roots)
    key_state = _key_state(keys, environ)
    lines = [
        f"RESULT root={root_state} key={key_state} entries={entries}",
        f"ROOT_{root_state.upper()}",
        f"KEY_ENV_{key_state.upper()}",
        "harness | gefunden ja/nein | TruthLens-Eintrag ja/nein | Hinweis",
        *rows,
    ]
    ready = root_state == "ok" and key_state == "present" and entries > 0
    return (0 if ready else 1), "\n".join(lines) + "\n"


def _ask(label: str) -> str:
    sys.stderr.write(label + " ")
    sys.stderr.flush()
    line = sys.stdin.readline()
    if not line:
        raise SetupError("error: setup cancelled")
    return line.strip()


def main(argv: list[str] | None = None) -> int:
    parser = _Parser(prog="truthlens setup", allow_abbrev=False)
    parser.add_argument("--agent", choices=AGENTS)
    parser.add_argument("--root")
    parser.add_argument("--key-env")
    parser.add_argument("--config")
    parser.add_argument("--print", dest="print_config", action="store_true")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--prompt", action="store_true")
    try:
        args = parser.parse_args(argv)
        environ = os.environ
        if args.prompt:
            if args.print_config or args.write:
                raise SetupError("error: --prompt does not write config")
            sys.stdout.write(render_prompts(args.agent))
            return 0
        agent, root, key_env = args.agent, args.root, args.key_env
        mode = "write" if args.write else "print" if args.print_config else ""
        if args.write and args.print_config:
            raise SetupError("error: pass only one of --print or --write")
        if not (agent and root and key_env and mode):
            if not sys.stdin.isatty():
                raise SetupError(
                    "error: pass --agent, --root, --key-env, and --print or --write"
                )
            agent = agent or _ask("Agent [agent-zero|codex|gemini|claude-code|cursor|mausbot]:")
            root = root or _ask("Runs directory:")
            key_env = key_env or _ask("Env var name for the HMAC key:")
            mode = mode or _ask("print or write:")
        if mode not in {"print", "write"}:
            raise SetupError("error: pass --print or --write")
        _check_values(agent, root, key_env, environ)
        if mode == "print":
            sys.stdout.write(render_config(agent, root, key_env))
            return 0
        path = destination(agent, home=Path.home(), environ=environ, config=args.config)
        current = None
        if path.is_symlink():
            raise SetupError("error: refusing symlink")
        if path.is_file():
            current = path.read_text(encoding="utf-8")
        write_config(path, merge_text(agent, current, root, key_env))
        sys.stderr.write("config written\n")
        return 0
    except SetupError as exc:
        sys.stderr.write(exc.message + "\n")
        return 2
    except (OSError, UnicodeError):
        sys.stderr.write("setup unavailable.\n")
        return 2


def doctor_main(argv: list[str] | None = None) -> int:
    parser = _Parser(prog="truthlens doctor", allow_abbrev=False)
    parser.message = "Doctor unavailable."
    parser.add_argument("--agent", choices=AGENTS)
    parser.add_argument("--root")
    parser.add_argument("--key-env")
    parser.add_argument("--agent-zero-settings")
    parser.add_argument("--mausbot-config")
    try:
        args = parser.parse_args(argv)
        code, text = doctor_report(
            home=Path.home(),
            environ=dict(os.environ),
            root=args.root,
            key_env=args.key_env,
            agent_zero=args.agent_zero_settings,
            mausbot=args.mausbot_config,
        )
        sys.stdout.write(text)
        return code
    except SystemExit:
        raise
    except SetupError as exc:
        sys.stderr.write(exc.message + "\n")
        return 2
    except OSError:
        sys.stderr.write("Doctor unavailable.\n")
        return 2
