"""Synthetic human demo only. Never imported by the real G1 adapter/client.

This private fake transport can return simulated green without weakening root
ownership, ancestry or peer checks in status_client. It reads no TruthLens data.
"""

from __future__ import annotations

import os
import socket
import tempfile
import threading
from pathlib import Path

from truthlens import status_client
from truthlens import status_wire as wire


def run_demo() -> str:
    """Roundtrip three fixed simulated cases; real client must fail closed."""
    with tempfile.TemporaryDirectory(prefix="tl-demo-", dir=".") as directory:
        # AF_UNIX limits the address bytes, even when the cwd/temp root is long.
        # Keep the fake socket in a private 0700 directory, addressed relatively;
        # the unchanged real client rejects relative paths and must fail closed.
        path = Path(os.path.relpath(directory)) / "status.sock"
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as server:
            server.bind(str(path))
            os.chmod(path, 0o600)  # private fake socket, not a production broker
            server.listen(1)
            server.settimeout(wire.TIMEOUT)
            stop = threading.Event()
            errors = []

            def serve():
                try:
                    # Only the three fixed demo requests can be answered.
                    for expected in wire.STATUSES:
                        connection, _ = server.accept()
                        with connection:
                            request = wire.receive(connection, wire.MAX_REQUEST)
                            if request != {"version": 1, "run_id": expected}:
                                raise ValueError("Demo unavailable")
                            wire.send(connection, {"status": expected})
                    # Real client usually refuses before connect. If its metadata
                    # checks allow this root-owned tree, answer only unknown.
                    while not stop.is_set():
                        server.settimeout(0.05)
                        try:
                            connection, _ = server.accept()
                        except TimeoutError:
                            continue
                        with connection:
                            wire.receive(connection, wire.MAX_REQUEST)
                            wire.send(connection, wire.unknown())
                except Exception:  # noqa: BLE001 -- never retain exception contents
                    errors.append(True)

            worker = threading.Thread(target=serve, daemon=True)
            worker.start()
            try:
                lines = ["DEMO ONLY: synthetic fake broker; no audit or approval."]
                for expected in wire.STATUSES:
                    # Deliberately private synthetic client; no option or env can
                    # redirect the real adapter to this relaxed demo transport.
                    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
                        client.settimeout(wire.TIMEOUT)
                        client.connect(str(path))
                        wire.send(client, {"version": 1, "run_id": expected})
                        result = wire.status_only(wire.receive(client, wire.MAX_RESPONSE))
                    if result != {"status": expected}:
                        raise ValueError("Demo unavailable")
                    lines.append("Simulated: " + result["status"])
                real = status_client.check_status(path, "demo")
                if real != wire.unknown():
                    raise ValueError("Demo unavailable")
                lines.append("Real client: not_checkable")
            finally:
                stop.set()
                worker.join(wire.TIMEOUT + 0.1)
            if worker.is_alive() or errors:
                raise ValueError("Demo unavailable")
    return "\n".join(lines) + "\n"
