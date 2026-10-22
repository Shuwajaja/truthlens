"""Private root supervisor: no worker survives into privileged wrapper reads."""

from __future__ import annotations

import os
import pwd
import signal
import subprocess
import time
from pathlib import Path

from truthlens.registry import Registry, RegistryError, deny, require_root, trusted

ENV = {"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8", "HOME": "/nonexistent"}


def quiesce(uid: int) -> None:
    if type(uid) is not int or uid <= 0:
        deny()
    for _ in range(3):
        clean = True
        for flag in ("-u", "-U"):  # effective AND real UID, including setuid helper descendants
            killed = subprocess.run(
                ["/usr/bin/pkill", "-KILL", flag, str(uid)],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                env=ENV,
                timeout=2,
                check=False,
            )
            if killed.returncode not in (0, 1):
                deny()
            remaining = subprocess.run(
                ["/usr/bin/pgrep", flag, str(uid)],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                env=ENV,
                timeout=2,
                check=False,
            )
            if remaining.returncode not in (0, 1):
                deny()
            clean = clean and remaining.returncode == 1
        if clean:
            return
        time.sleep(0.05)
    deny()


def supervise(argv: list[str], uid: int, parent_pid: int, cwd: str = "/") -> int:
    process = None
    try:
        process = subprocess.Popen(argv, stdin=subprocess.DEVNULL, env=ENV, cwd=cwd)
        try:
            return process.wait(timeout=1700)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
            return 124
    finally:
        try:
            quiesce(uid)
        except (RegistryError, OSError, subprocess.SubprocessError):
            # Returning would let the unchanged root wrapper perform unsafe reads
            # while worker processes still race. Terminate ONLY our bound launcher.
            if os.getppid() == parent_pid:
                os.kill(parent_pid, signal.SIGKILL)
            deny()


def serve(dispatch_id: str) -> int:
    require_root()
    trusted(Path(__file__))
    store = Registry()
    dispatch = next(
        (
            r["data"]
            for r in store.records()
            if r["event"] == "dispatch" and r["data"].get("dispatch_id") == dispatch_id
        ),
        None,
    )
    if dispatch is None or dispatch.get("launcher_pid") != os.getppid():
        deny()
    from truthlens.pipeline import agent_argv, load_profile

    profile, digest = load_profile(dispatch["profile"])
    if digest != dispatch["profile_digest"]:
        deny()
    uid = pwd.getpwnam("tl-agent").pw_uid
    if uid <= 0:
        deny()
    return supervise(agent_argv(profile["command"]), uid, os.getppid(), profile["repo"])
