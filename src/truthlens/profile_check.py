"""Read-only operator preflight, deliberately separate from run/status paths."""

from __future__ import annotations

import os
import shlex
import stat
import subprocess
import sys
from pathlib import Path

from truthlens.audit import _json
from truthlens.registry import require_root

DERIVED_ONLY = (
    "warning: DERIVED_ONLY: Derived criteria stay proposed; the server pipeline has no human "
    "confirmation step. Use source=user only for criteria actually supplied by a human."
)
TEST_EXECUTABLE = (
    "warning: TEST_EXECUTABLE: Use an absolute test executable/interpreter with the runner available "
    "to tl-agent; bare names may resolve inside the TruthLens venv."
)
REPO_HEAD = "warning: REPO_HEAD: The repo must be an absolute Git repository path with a HEAD commit."


def _load(value: str) -> dict:
    if "/" not in value and not value.endswith(".json"):
        from truthlens.pipeline import load_profile

        return load_profile(value)[0]
    # Drafts need not be installed/root-owned. Never execute or install their contents.
    fd = os.open(value, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > 65536:
            raise ValueError("invalid draft")
        raw = os.read(fd, 65537)
    finally:
        os.close(fd)
    if len(raw) > 65536:
        raise ValueError("oversize draft")
    profile = _json(raw)
    if not isinstance(profile, dict):
        raise ValueError("invalid profile")
    return profile


def _has_head(repo: str) -> bool:
    if not Path(repo).is_absolute() or not Path(repo).is_dir():
        return False
    repo = str(Path(repo).resolve())
    try:
        # Ignore caller Git environment/config; never run a profile command or runner probe.
        return (
            subprocess.run(
                [
                    "/usr/bin/git",
                    "--no-optional-locks",
                    "-C",
                    repo,
                    "-c",
                    f"safe.directory={repo}",
                    "rev-parse",
                    "--verify",
                    "HEAD^{commit}",
                ],
                env={
                    "PATH": "/usr/bin:/bin",
                    "LANG": "C",
                    "HOME": "/nonexistent",
                    "GIT_CONFIG_NOSYSTEM": "1",
                    "GIT_CONFIG_GLOBAL": "/dev/null",
                    "GIT_CEILING_DIRECTORIES": str(Path(repo).parent),
                },
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
                check=False,
            ).returncode
            == 0
        )
    except (OSError, subprocess.SubprocessError):
        return False


def _warnings(profile: dict) -> list[str]:
    criteria = profile.get("criteria", {}).get("criteria", [])
    tests = profile.get("tests", [])
    if (
        not isinstance(criteria, list)
        or any(not isinstance(c, dict) for c in criteria)
        or not isinstance(tests, list)
        or any(not isinstance(t, dict) for t in tests)
    ):
        raise ValueError("invalid profile")
    warnings = []
    if criteria and all(c.get("source") == "derived" for c in criteria):
        warnings.append(DERIVED_ONLY)
    for test in tests:
        try:
            tokens = shlex.split(test["command"])
        except (KeyError, TypeError, ValueError, AttributeError):
            tokens = []
        if not tokens or not Path(tokens[0]).is_absolute():
            warnings.append(TEST_EXECUTABLE)
            break
    if not _has_head(profile.get("repo", "")):
        warnings.append(REPO_HEAD)
    return warnings


def check(name_or_path: str) -> int:
    """Print fixed operator warnings to stderr; 0 means no listed pitfall, not approval."""
    try:
        require_root()  # No sudoers entry or agent-accessible diagnostic path is added.
        warnings = _warnings(_load(name_or_path))
    except (OSError, ValueError, TypeError, AttributeError, RuntimeError):
        print("Profile check unavailable or access denied.", file=sys.stderr)
        return 2
    for warning in warnings:
        print(warning, file=sys.stderr)
    return 2 if warnings else 0
