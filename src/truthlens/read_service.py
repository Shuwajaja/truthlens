"""Fixed-view read-only HTTP, with D34 unprivileged loopback entrypoint.

Run only after a separately authorized host setup. The legacy Unix transport
is retained for compatibility tests; the CLI serves only the D34 loopback view.
Neither transport installs services, users, keys, or configuration.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import signal
import socket
import socketserver
import stat
import struct
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from truthlens.registry import ID, RegistryError, trusted

ROOT_UID = 0
MAX_REQUEST = 16384
MAX_RESPONSE = 10 * 1024 * 1024
REQUEST_TIMEOUT = 3
STATIC_TYPES = {
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
}
PUBLIC_ASSETS = {"favicon.svg", "favicon.ico", "apple-touch-icon.png", "logo-icon.svg", "logo-wordmark.svg"}
CSP = (
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    "connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; "
    "frame-src blob: data:; object-src 'none'; base-uri 'none'; form-action 'none'; "
    "frame-ancestors 'none'; worker-src 'none'"
)


@dataclass(frozen=True)
class ReaderConfig:
    state_root: Path
    socket_path: Path
    viewer_dist: Path
    origin: str
    forwarder_uid: int
    view_id: str

    def validate(self) -> None:
        if type(self.forwarder_uid) is not int or not 1 <= self.forwarder_uid < 4294967295:
            raise ValueError("Invalid reader configuration")
        if not isinstance(self.view_id, str) or not ID.fullmatch(self.view_id):
            raise ValueError("Invalid reader configuration")
        if not isinstance(self.origin, str) or not re.fullmatch(
            r"http://127\.0\.0\.1:[1-9][0-9]{0,4}", self.origin
        ):
            raise ValueError("Invalid reader configuration")
        if not 1 <= urlsplit(self.origin).port <= 65535:
            raise ValueError("Invalid reader configuration")
        for path in (self.state_root, self.socket_path, self.viewer_dist):
            if not isinstance(path, Path) or not path.is_absolute() or ".." in path.parts:
                raise ValueError("Invalid reader configuration")
        if len(os.fsencode(self.socket_path)) > 100:
            raise ValueError("Invalid reader configuration")
        validate_paths(self)


def validate_paths(config: ReaderConfig) -> None:
    """Production ancestry is root-owned, immutable to the SSH user, and real."""
    trusted(config.state_root, directory=True, private=True)
    trusted(config.viewer_dist, directory=True)
    trusted(config.socket_path.parent, directory=True)
    # Root-owned traverse-only parent: selected nonroot SSH user can reach 0600
    # socket but cannot list, replace or create its pathname.
    if stat.S_IMODE(config.socket_path.parent.stat().st_mode) != 0o711:
        raise ValueError("Invalid reader socket parent")
    trusted(config.viewer_dist / "index.html")


def load_config(path: Path) -> ReaderConfig:
    trusted(path, private=True)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_REQUEST:
            raise ValueError("Invalid reader configuration")
        data = os.read(fd, MAX_REQUEST + 1)
        if len(data) != info.st_size:
            raise ValueError("Invalid reader configuration")
    finally:
        os.close(fd)

    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Invalid reader configuration")
            result[key] = value
        return result

    try:
        raw = json.loads(data, object_pairs_hook=unique)
        if not isinstance(raw, dict) or set(raw) != set(ReaderConfig.__dataclass_fields__):
            raise ValueError("Invalid reader configuration")
        for key in ("state_root", "socket_path", "viewer_dist"):
            if not isinstance(raw[key], str):
                raise TypeError("Invalid reader configuration")
            raw[key] = Path(raw[key])
        config = ReaderConfig(**raw)
        config.validate()
        return config
    except (TypeError, UnicodeError, json.JSONDecodeError, RecursionError) as exc:
        raise ValueError("Invalid reader configuration") from exc


class HTTPError(Exception):
    def __init__(self, status: int, code: str):
        self.status = status
        self.code = code


def _query(raw: str, allowed: dict[str, tuple[int, int, int]]) -> dict[str, int]:
    try:
        query = parse_qs(raw, keep_blank_values=True, strict_parsing=True, max_num_fields=4)
    except ValueError as exc:
        raise HTTPError(400, "bad_request") from exc
    if set(query) - set(allowed):
        raise HTTPError(400, "bad_request")
    result = {}
    for key, (default, lower, upper) in allowed.items():
        values = query.get(key, [str(default)])
        if len(values) != 1 or not re.fullmatch(r"[0-9]{1,7}", values[0]):
            raise HTTPError(400, "bad_request")
        value = int(values[0])
        if not lower <= value <= upper:
            raise HTTPError(400, "bad_request")
        result[key] = value
    return result


def _static(root_fd: int, parts: list[str]) -> bytes:
    """Resolve every component below an already-open production root, no links."""
    current = os.dup(root_fd)
    try:
        for index, part in enumerate(parts):
            flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK
            if index < len(parts) - 1:
                flags |= os.O_DIRECTORY
            child = os.open(part, flags, dir_fd=current)
            os.close(current)
            current = child
            info = os.fstat(current)
            if info.st_uid != ROOT_UID or info.st_mode & 0o022:
                raise HTTPError(404, "not_found")
        info = os.fstat(current)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise HTTPError(404, "not_found")
        if info.st_size > MAX_RESPONSE:
            raise HTTPError(413, "response_too_large")
        data = bytearray()
        while len(data) <= MAX_RESPONSE:
            block = os.read(current, min(65536, MAX_RESPONSE + 1 - len(data)))
            if not block:
                break
            data.extend(block)
        after = os.fstat(current)
        if len(data) > MAX_RESPONSE:
            raise HTTPError(413, "response_too_large")
        if len(data) != info.st_size or (info.st_size, info.st_mtime_ns, info.st_ctime_ns) != (
            after.st_size,
            after.st_mtime_ns,
            after.st_ctime_ns,
        ):
            raise HTTPError(403, "unavailable")
        return bytes(data)
    except OSError as exc:
        raise HTTPError(404, "not_found") from exc
    finally:
        os.close(current)


class ReadHandler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        self.method = "GET"
        try:
            response, media = self.read_request()
            self.respond(200, response, media)
        except HTTPError as exc:
            self.respond(exc.status, {"error": exc.code})
        except RegistryError:
            self.respond(403, {"error": "unavailable"})
        except TimeoutError:
            self.request.settimeout(REQUEST_TIMEOUT)
            self.respond(408, {"error": "request_timeout"})
        except (ValueError, OSError, UnicodeError, TypeError):
            self.respond(400, {"error": "bad_request"})
        except Exception:  # noqa: BLE001 — private boundary must never expose internals
            # No traceback or reflected private paths in transport logs/responses.
            self.respond(503, {"error": "unavailable"})

    def read_request(self) -> tuple[dict | bytes, str]:
        raw = bytearray()
        deadline = time.monotonic() + REQUEST_TIMEOUT
        while b"\r\n\r\n" not in raw:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise HTTPError(408, "request_timeout")
            self.request.settimeout(remaining)
            block = self.request.recv(min(1024, MAX_REQUEST + 1 - len(raw)))
            if not block:
                raise HTTPError(400, "bad_request")
            raw.extend(block)
            if len(raw) > MAX_REQUEST:
                raise HTTPError(431, "headers_too_large")
        head, body = bytes(raw).split(b"\r\n\r\n", 1)
        lines = head.decode("ascii").split("\r\n")
        if len(lines) > 65 or len(lines[0]) > 2048:
            raise HTTPError(431, "headers_too_large")
        fields = lines[0].split(" ")
        if len(fields) != 3 or fields[2] not in ("HTTP/1.0", "HTTP/1.1"):
            raise HTTPError(400, "bad_request")
        self.method, target, _ = fields
        if self.method not in ("GET", "HEAD"):
            raise HTTPError(405, "method_not_allowed")
        headers = {}
        for line in lines[1:]:
            key, separator, value = line.partition(":")
            if not separator or not re.fullmatch(r"[A-Za-z0-9-]+", key):
                raise HTTPError(400, "bad_request")
            key, value = key.lower(), value.strip(" \t")
            if key in headers or any(ord(char) < 32 or ord(char) == 127 for char in value):
                raise HTTPError(400, "bad_request")
            headers[key] = value
        config = self.server.config
        if headers.get("host") != config.origin.removeprefix("http://"):
            raise HTTPError(403, "unavailable")
        if "origin" in headers and headers["origin"] != config.origin:
            raise HTTPError(403, "unavailable")
        if headers.get("sec-fetch-site", "same-origin") not in ("same-origin", "none"):
            raise HTTPError(403, "unavailable")
        if headers.get("sec-fetch-mode", "same-origin") not in ("same-origin", "cors", "navigate", "no-cors"):
            raise HTTPError(403, "unavailable")
        if body or headers.get("content-length", "0") != "0" or "transfer-encoding" in headers:
            raise HTTPError(400, "bad_request")
        path, separator, query = target.partition("?")
        if (
            not target.startswith("/")
            or target.startswith("//")
            or any(char in target for char in ("\\", "#"))
            or "%" in path
            or (path != "/" and "%" in query)
        ):
            raise HTTPError(400, "bad_request")
        if any(part in (".", "..", "") for part in path.split("/")[1:]) and path != "/":
            raise HTTPError(400, "bad_request")
        if headers.get("sec-fetch-mode") == "no-cors" and (
            path.startswith("/v1/") or headers.get("sec-fetch-site") != "same-origin"
        ):
            raise HTTPError(403, "unavailable")
        self.request.settimeout(REQUEST_TIMEOUT)
        projection = self.server.projection
        if path == "/v1/health":
            _query(query, {})
            return {"source_id": projection.source_id, "service": "available"}, "application/json"
        if path == "/v1/runs":
            args = _query(query, {"offset": (0, 0, 1000000), "limit": (50, 1, 50)})
            return projection.catalog(**args), "application/json"
        extra = re.fullmatch(
            r"/v1/runs/([A-Za-z0-9_-]{1,80})/(artifacts|blobs|audits)(?:/([a-f0-9]{64}))?", path
        )
        if extra:
            run_id, route, digest = extra.groups()
            _query(query, {})
            if digest is not None:
                if route != "blobs":
                    raise HTTPError(404, "not_found")
                return projection.blob(run_id, digest), "application/octet-stream"
            return getattr(projection, route)(run_id), "application/json"
        match = re.fullmatch(r"/v1/runs/([A-Za-z0-9_-]{1,80})/(document|events)", path)
        if match:
            run_id, route = match.groups()
            if route == "document":
                _query(query, {})
                return projection.document(run_id), "application/json"
            args = _query(query, {"after_seq": (0, 0, 100000), "limit": (100, 1, 100)})
            return projection.events(run_id, **args), "application/json"
        if path == "/":
            try:
                navigation = parse_qs(
                    query, keep_blank_values=True, strict_parsing=True, max_num_fields=4, errors="strict"
                )
            except (ValueError, UnicodeError) as exc:
                raise HTTPError(400, "bad_request") from exc
            if set(navigation) - {"source", "run", "view", "tab"} or any(
                len(values) != 1
                or len(values[0]) > 512
                or any(ord(char) < 32 or ord(char) == 127 for char in values[0])
                for values in navigation.values()
            ):
                raise HTTPError(400, "bad_request")
            # Navigation metadata never selects a host path, principal or run.
            return _static(self.server.dist_fd, ["index.html"]), "text/html; charset=utf-8"
        if separator:
            raise HTTPError(400, "bad_request")
        if path.removeprefix("/") in PUBLIC_ASSETS:
            return _static(self.server.dist_fd, [path.removeprefix("/")]), STATIC_TYPES[Path(path).suffix]
        if re.fullmatch(r"/assets/[A-Za-z0-9_.-]+", path) and Path(path).suffix in STATIC_TYPES:
            return _static(self.server.dist_fd, path.lstrip("/").split("/")), STATIC_TYPES[Path(path).suffix]
        raise HTTPError(404, "not_found")

    def respond(self, status: int, value: dict | bytes, media: str = "application/json") -> None:
        try:
            if isinstance(value, bytes):
                body = value
            else:
                encoded = bytearray()
                encoder = json.JSONEncoder(ensure_ascii=True, separators=(",", ":"), allow_nan=False)
                for part in encoder.iterencode(value):
                    chunk = part.encode("ascii")
                    if len(encoded) + len(chunk) > MAX_RESPONSE:
                        status, media = 413, "application/json"
                        encoded = bytearray(b'{"error":"response_too_large"}')
                        break
                    encoded.extend(chunk)
                body = bytes(encoded)
            if len(body) > MAX_RESPONSE:
                status, body, media = 413, b'{"error":"response_too_large"}', "application/json"
            headers = {
                "Content-Type": media,
                "Content-Length": str(len(body)),
                "Connection": "close",
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
                "Referrer-Policy": "no-referrer",
                "Content-Security-Policy": CSP,
                "Cross-Origin-Resource-Policy": "same-origin",
                "X-Frame-Options": "DENY",
            }
            if status == 405:
                headers["Allow"] = "GET, HEAD"
            head = (
                f"HTTP/1.1 {status} Response\r\n"
                + "".join(f"{key}: {value}\r\n" for key, value in headers.items())
                + "\r\n"
            )
            self.request.sendall(head.encode("ascii") + (b"" if self.method == "HEAD" else body))
        except (OSError, ValueError, TypeError):
            pass


class ReadServer(socketserver.UnixStreamServer):
    """Two reusable workers, bounded submissions; credentials precede dispatch."""

    request_queue_size = 16
    allow_reuse_address = False

    def __init__(self, config: ReaderConfig, projection):
        config.validate()
        self.config = config
        self.projection = projection
        self.socket_identity = None
        self._slots = threading.BoundedSemaphore(2)
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="truthlens-reader")
        self.dist_fd = os.open(
            config.viewer_dist, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
        )
        try:
            # bind refuses every existing pathname. Never unlink a stale socket.
            super().__init__(str(config.socket_path), ReadHandler, bind_and_activate=False)
            previous_umask = os.umask(0o177)
            try:
                self.server_bind()
                info = config.socket_path.lstat()
                self.socket_identity = (info.st_dev, info.st_ino)
                os.chmod(config.socket_path, 0o600, follow_symlinks=False)
                if info.st_uid != config.forwarder_uid:
                    os.chown(config.socket_path, config.forwarder_uid, -1, follow_symlinks=False)
                self.server_activate()
            finally:
                os.umask(previous_umask)
        except BaseException:
            self.server_close()
            raise

    def get_request(self):
        request, address = super().get_request()
        request.settimeout(REQUEST_TIMEOUT)
        return request, address

    def verify_request(self, request: socket.socket, client_address) -> bool:
        try:
            _, uid, _ = struct.unpack("3i", request.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
            return uid == self.config.forwarder_uid
        except (OSError, AttributeError, struct.error):
            return False

    def process_request(self, request: socket.socket, client_address: str) -> None:
        # BaseServer has already checked SO_PEERCRED. Acquire before submit so
        # the executor's internal work queue cannot grow with incoming clients.
        acquired = False
        try:
            self._slots.acquire()
            acquired = True
            self._executor.submit(self._process_request, request, client_address)
        except BaseException:
            if acquired:
                self._slots.release()
            self.shutdown_request(request)
            raise

    def _process_request(self, request: socket.socket, client_address: str) -> None:
        try:
            self.finish_request(request, client_address)
        except Exception:  # noqa: BLE001 — fixed private error handling, no tracebacks
            self.handle_error(request, client_address)
        finally:
            try:
                self.shutdown_request(request)
            finally:
                self._slots.release()

    def handle_error(self, request, client_address) -> None:
        pass

    def server_close(self) -> None:
        if hasattr(self, "socket"):
            super().server_close()
        self._executor.shutdown(wait=True)
        if self.socket_identity is not None:
            try:
                info = self.config.socket_path.lstat()
                if (info.st_dev, info.st_ino) == self.socket_identity and stat.S_ISSOCK(info.st_mode):
                    self.config.socket_path.unlink()
            except FileNotFoundError:
                pass
            self.socket_identity = None
        if self.dist_fd is not None:
            os.close(self.dist_fd)
            self.dist_fd = None


@dataclass(frozen=True)
class LoopbackConfig:
    published_root: Path
    viewer_dist: Path
    view_id: str
    origin: str = "http://127.0.0.1:8765"

    def validate(self) -> None:
        if self.origin != "http://127.0.0.1:8765":
            raise ValueError("Invalid reader configuration")
        if not isinstance(self.view_id, str) or not ID.fullmatch(self.view_id):
            raise ValueError("Invalid reader configuration")
        for path in (self.published_root, self.viewer_dist):
            if not isinstance(path, Path) or not path.is_absolute() or ".." in path.parts:
                raise ValueError("Invalid reader configuration")
        validate_loopback_paths(self)


def validate_loopback_paths(config: LoopbackConfig) -> None:
    # Same protected ancestry, but permit group read on the separate publication.
    # Never grant this service access to the private registry or audit key.
    trusted(config.published_root, directory=True)
    trusted(config.published_root / "read-index.json")
    trusted(config.viewer_dist, directory=True)
    trusted(config.viewer_dist / "index.html")


def load_loopback_config(path: Path) -> LoopbackConfig:
    from truthlens.audit_inputs import SafeRunReader
    from truthlens.read_projection import _json

    trusted(path)
    with SafeRunReader(path.parent) as reader:
        raw = _json(reader.read(path.name, limit=MAX_REQUEST))
        reader.finish()
    if not isinstance(raw, dict) or set(raw) != set(LoopbackConfig.__dataclass_fields__):
        raise ValueError("Invalid reader configuration")
    for key in ("published_root", "viewer_dist"):
        if not isinstance(raw[key], str):
            raise TypeError("Invalid reader configuration")
        raw[key] = Path(raw[key])
    config = LoopbackConfig(**raw)
    config.validate()
    return config


class LoopbackReadServer(socketserver.TCPServer):
    """D34 Shu transport. Loopback is NOT an OS principal/authentication check.

    Live use additionally requires reviewed worker UID/netns exclusion. Agent
    Zero must never be pointed at this evidence-bearing endpoint.
    """

    request_queue_size = 16
    allow_reuse_address = True

    def __init__(self, config: LoopbackConfig, projection):
        config.validate()
        self.config = config
        self.projection = projection
        self.dist_fd = os.open(
            config.viewer_dist, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
        )
        self._slots = threading.BoundedSemaphore(2)
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="truthlens-reader")
        try:
            super().__init__(("127.0.0.1", 8765), ReadHandler)
        except BaseException:
            self.server_close()
            raise

    def get_request(self):
        request, address = super().get_request()
        request.settimeout(REQUEST_TIMEOUT)
        return request, address

    process_request = ReadServer.process_request
    _process_request = ReadServer._process_request
    handle_error = ReadServer.handle_error

    def verify_request(self, request: socket.socket, client_address) -> bool:
        return client_address[0] == "127.0.0.1"

    def server_close(self) -> None:
        if hasattr(self, "socket"):
            super().server_close()
        self._executor.shutdown(wait=True)
        if self.dist_fd is not None:
            os.close(self.dist_fd)
            self.dist_fd = None


def legacy_main(argv: list[str] | None = None) -> int:
    """Compatibility test entrypoint for the earlier Unix transport (not CLI)."""
    from truthlens.registry import Registry

    parser = argparse.ArgumentParser(description="Legacy private Unix HTTP reader")
    parser.add_argument("--config", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        from truthlens.read_projection import ReadProjection

        config = load_config(args.config)
        projection = ReadProjection(
            Registry(config.state_root), uid=config.forwarder_uid, view_id=config.view_id
        )

        def stop_on_sigterm(signum, frame):
            raise KeyboardInterrupt

        previous_handler = signal.signal(signal.SIGTERM, stop_on_sigterm)
        try:
            with ReadServer(config, projection) as server:
                server.serve_forever()
        finally:
            signal.signal(signal.SIGTERM, previous_handler)
    except KeyboardInterrupt:
        return 0
    except (OSError, ValueError, RegistryError):
        parser.exit(1, "Reader unavailable or configuration denied.\n")
    return 0


def main(argv: list[str] | None = None) -> int:
    from truthlens.audit_inputs import AuditInputError
    from truthlens.read_projection import PublishedReadProjection

    parser = argparse.ArgumentParser(description="D34 fixed Shu reader on 127.0.0.1:8765")
    parser.add_argument("--config", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        if os.getuid() == 0 or os.geteuid() == 0:
            raise ValueError("Unprivileged reader required")
        config = load_loopback_config(args.config)
        projection = PublishedReadProjection(config.published_root, view_id=config.view_id)

        def stop_on_sigterm(signum, frame):
            raise KeyboardInterrupt

        previous = signal.signal(signal.SIGTERM, stop_on_sigterm)
        try:
            with LoopbackReadServer(config, projection) as server:
                server.serve_forever()
        finally:
            signal.signal(signal.SIGTERM, previous)
    except KeyboardInterrupt:
        return 0
    except (OSError, ValueError, RegistryError, AuditInputError, TypeError, RecursionError):
        parser.exit(1, "Reader unavailable or configuration denied.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
