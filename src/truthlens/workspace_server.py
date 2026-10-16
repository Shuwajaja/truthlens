"""Optional loopback-only static reader and bounded Codex presentation bridge.

No source/config writes, accounts, public hosting or worker execution endpoints.
"""

from __future__ import annotations

import json
import mimetypes
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from truthlens.catalog import export_catalog
from truthlens.codex_navigator import ask_codex
from truthlens.read_service import read_bytes


def create_server(db: str, static: str, projects: set[str], port: int = 4174) -> ThreadingHTTPServer:
    if not projects:
        raise ValueError("explicit allowed projects required")
    root = Path(static).resolve()
    if not (root / "index.html").is_file():
        raise ValueError("build the viewer before starting the reader")
    # Validate availability before binding. The ceiling never comes from requests.
    document = export_catalog(db, allowed_projects=projects)
    if not projects <= {p["id"] for p in document["projects"]}:
        raise ValueError("unknown allowed project")
    token = secrets.token_urlsafe(32)
    active = threading.Lock()
    cancel = threading.Event()
    last_request = [0.0]

    class Handler(BaseHTTPRequestHandler):
        server_version = "TruthLensLocal/1"

        def log_message(self, _format: str, *_args) -> None:
            return  # never log questions, transcripts, bearer tokens or source data

        def _allowed_origin(self) -> bool:
            origins = {f"http://127.0.0.1:{self.server.server_port}", f"http://localhost:{self.server.server_port}"}
            if self.headers.get("Host") not in {urlsplit(o).netloc for o in origins}:
                return False  # DNS rebinding / foreign host
            return self.headers.get("Origin") in origins | {None}

        def _send(self, status: int, body: bytes, content_type: str = "application/json") -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                             "img-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; "
                             "base-uri 'none'; frame-ancestors 'none'")
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def _json(self, status: int, value: object) -> None:
            self._send(status, json.dumps(value, ensure_ascii=False).encode())

        def do_GET(self) -> None:
            if not self._allowed_origin():
                self._json(403, {"error": "origin denied"})
                return
            route = unquote(urlsplit(self.path).path)
            if route == "/workspace.json":
                self._json(200, export_catalog(db, allowed_projects=projects))
                return
            if route == "/api/session":
                self._json(200, {"token": token, "provider": "codex-cli", "read_only": True})
                return
            if route == "/api/health":
                self._json(200, {"status": "ready", "read_only": True})
                return
            relative = "index.html" if route == "/" else route.lstrip("/")
            # Only built app assets; never arbitrary filesystem/source paths.
            if any(segment in {".", "..", ""} for segment in relative.split("/")) or \
                    "\\" in relative or (relative != "index.html" and not relative.startswith("assets/")):
                self._json(404, {"error": "not found"})
                return
            try:
                target = root / relative
                body = read_bytes(target, root if relative == "index.html" else root / "assets")
                self._send(200, body, mimetypes.guess_type(target.name)[0] or "application/octet-stream")
            except (ValueError, OSError):
                self._json(404, {"error": "not found"})

        def do_POST(self) -> None:
            if not self._allowed_origin() or not secrets.compare_digest(self.headers.get("X-TruthLens-Token", ""), token):
                self._json(403, {"error": "session or origin denied"})
                return
            route = urlsplit(self.path).path
            if route == "/api/navigator/cancel":
                cancel.set()
                self._json(200, {"cancel_requested": True})
                return
            if route != "/api/navigator":
                self._json(404, {"error": "not found"})
                return
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                self._json(415, {"error": "JSON required"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 1 <= length <= 8192:
                    raise ValueError("body size")
                self.connection.settimeout(5)
                request = json.loads(self.rfile.read(length))
                if not isinstance(request, dict) or set(request) != {"question", "project_id"}:
                    raise ValueError("shape")
                project = request["project_id"]
                if project not in projects or not isinstance(request["question"], str):
                    raise ValueError("scope")
            except (ValueError, OSError, TypeError):
                self._json(400, {"error": "invalid bounded request or project scope"})
                return
            if not active.acquire(blocking=False):
                self._json(429, {"error": "one Navigator request is already running"})
                return
            try:
                if time.monotonic() - last_request[0] < 2:
                    self._json(429, {"error": "wait before the next Navigator request"})
                    return
                last_request[0] = time.monotonic()
                cancel.clear()
                current = export_catalog(db, project=project, allowed_projects=projects)
                result = ask_codex(current, request["question"], project, cancel=cancel)
                self._json(200, result)
            except (ValueError, OSError, TypeError):
                self._json(503, {"error": "Codex unavailable, stopped, or response rejected; local search remains available"})
            finally:
                active.release()

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.cancel_pending = cancel
    return server


def serve(db: str, static: str, projects: set[str], port: int = 4174) -> None:
    server = create_server(db, static, projects, port)
    print(f"Local read-only workspace: http://127.0.0.1:{server.server_port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.cancel_pending.set()
        server.server_close()
