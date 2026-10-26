"""Server-only launcher; privileged configuration is never supplied by chat."""

from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path

from truthlens.audit import _json, audit_run
from truthlens.audit_inputs import read_audit_key
from truthlens.registry import Registry, deny, trusted

PROFILE_ROOT = Path("/etc/truthlens/profiles")
KEY_FILE = Path("/etc/truthlens/audit.key")


def agent_argv(command: list[str]) -> list[str]:
    if (
        not isinstance(command, list)
        or not command
        or len(command) > 64
        or any(not isinstance(v, str) or "\x00" in v or len(v) > 4096 for v in command)
        or not command[0].startswith("/")
    ):
        deny()
    return [
        "/usr/bin/sudo",
        "-n",
        "-u",
        "tl-agent",
        "--",
        "/usr/bin/env",
        "-i",
        "PATH=/usr/bin:/bin",
        "LANG=C.UTF-8",
        "HOME=/var/lib/tl-agent",
        *command,
    ]


def load_profile(name: str) -> tuple[dict, str]:
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,47}", name):
        deny()
    path = PROFILE_ROOT / (name + ".json")
    trusted(path, private=True)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        raw = os.read(fd, 65537)
    finally:
        os.close(fd)
    if len(raw) > 65536:
        deny()
    value = _json(raw)
    if not isinstance(value, dict):
        deny()
    return value, hashlib.sha256(raw).hexdigest()


def check_snapshot(store: Registry, registration: dict) -> dict:
    path = store.root / "snapshots" / registration["dispatch_id"]
    trusted(path, directory=True, private=True)
    if path.stat().st_mode & 0o222:
        deny()
    for item in path.rglob("*"):
        trusted(item, directory=item.is_dir())
        if item.stat().st_mode & 0o222:
            deny()
    trusted(KEY_FILE, private=True)
    key = read_audit_key(KEY_FILE, path)
    report = audit_run(path, hmac_key=key, expected_last_hash=registration["ledger_last_hash"])
    if (
        report["authentication"] != "supported"
        or report["run_id"] != registration["run_id"]
        or report["input_digests"]["run"] != registration["input_digests"]
    ):
        deny()
    return report


def delegation(profile: dict, uid: int) -> dict:
    if profile.get("enabled") is not True or profile.get("agent") != "agent-zero":
        deny()
    callers = profile.get("callers")
    if not isinstance(callers, list) or not callers:
        deny()
    for caller in callers:
        if (
            not isinstance(caller, dict)
            or type(caller.get("uid")) is not int
            or caller["uid"] < 0
            or caller.get("name") not in ("Shu", "VPSMan", "Codex", "systemd")
            or caller.get("on_behalf_of") != "Shu"
        ):
            deny()
    readers = profile.get("status_readers", [])
    if not isinstance(readers, list) or len(readers) > 64:
        deny()
    uids = [c["uid"] for c in callers]
    names = {c["name"] for c in callers}
    if len(set(uids)) != len(uids):
        deny()
    for reader in readers:
        if (
            not isinstance(reader, dict)
            or set(reader) != {"uid", "name"}
            or type(reader["uid"]) is not int
            or not 0 < reader["uid"] < 4294967295
            or not isinstance(reader["name"], str)
            or re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,47}", reader["name"]) is None
            or reader["uid"] in uids
            or reader["name"] in names
        ):
            deny()
        uids.append(reader["uid"])
        names.add(reader["name"])
    matches = [c for c in callers if c["uid"] == uid]
    if len(matches) != 1:
        deny()
    return matches[0]


def agent_account() -> int:
    import grp
    import pwd
    import subprocess

    account = pwd.getpwnam("tl-agent")
    if account.pw_uid <= 0:
        deny()
    groups = os.getgrouplist("tl-agent", account.pw_gid)
    if any(
        grp.getgrgid(gid).gr_name
        in {"root", "sudo", "wheel", "docker", "lxd", "incus-admin", "disk", "shadow", "adm"}
        for gid in groups
    ):
        deny()
    for filename in ("/etc/subuid", "/etc/subgid"):
        path = Path(filename)
        if path.exists():
            trusted(path)
            if any(
                line.split(":", 1)[0] in {"tl-agent", str(account.pw_uid)}
                for line in path.read_text().splitlines()
                if line and not line.startswith("#")
            ):
                deny()
    result = subprocess.run(
        ["/usr/bin/sudo", "-n", "-l", "-U", "tl-agent"],
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env={"PATH": "/usr/bin:/bin", "LANG": "C", "LC_ALL": "C"},
        timeout=10,
        check=False,
    )
    # sudo versions differ on the exit status for an empty policy. Only its
    # explicit C-locale denial is proof; empty/unknown/mixed output fails closed.
    output = (result.stdout + result.stderr).strip()
    if result.returncode not in (0, 1) or not re.fullmatch(
        r"User tl-agent is not allowed to run sudo on [A-Za-z0-9_.-]+\.", output
    ):
        deny()
    return account.pw_gid


def _private_directory(path: Path) -> None:
    path.mkdir(mode=0o700, exist_ok=True)
    trusted(path, directory=True, private=True)


def finalize(store: Registry, dispatch: dict) -> dict:
    """Only a locally dispatched source can become a server registration."""
    from truthlens.audit_inputs import SafeRunReader
    from truthlens.registry import stamp

    source = store.root / "runs" / dispatch["dispatch_id"]
    trusted(source, directory=True, private=True)
    trusted(KEY_FILE, private=True)
    key = read_audit_key(KEY_FILE, source)
    report = audit_run(source, hmac_key=key)
    if report["authentication"] != "supported" or not report["run_id"] or not report["ledger_last_hash"]:
        deny()
    # No prior registration, external import or caller path is accepted here.
    target = store.root / "snapshots" / dispatch["dispatch_id"]
    _private_directory(store.root / "snapshots")
    if target.exists():
        deny()  # partial snapshot from a crash requires operator review, never overwrite it
    target.mkdir(mode=0o700)
    with SafeRunReader(source) as reader:
        for name, expected in sorted(report["input_digests"]["run"].items()):
            data = reader.read(name, limit=reader.limits.total_bytes)
            if hashlib.sha256(data).hexdigest() != expected:
                deny()
            dest = target / name
            dest.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
            fd = os.open(dest, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o400)
            try:
                view = memoryview(data)
                while view:
                    count = os.write(fd, view)
                    if count <= 0:
                        deny()
                    view = view[count:]
                os.fsync(fd)
            finally:
                os.close(fd)
        reader.finish()
    for child in sorted(target.rglob("*"), key=lambda p: len(p.parts), reverse=True):
        if child.is_dir():
            child.chmod(0o500)
    target.chmod(0o500)
    for directory in [
        *sorted((p for p in target.rglob("*") if p.is_dir()), key=lambda p: len(p.parts), reverse=True),
        target,
        target.parent,
        store.root,
    ]:
        directory_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    captured = {
        "dispatch_id": dispatch["dispatch_id"],
        "run_id": report["run_id"],
        "ledger_last_hash": report["ledger_last_hash"],
        "input_digests": report["input_digests"]["run"],
        "capture_closed_at": stamp(),
        "registration_id": __import__("uuid").uuid4().hex,
        "snapshot_id": dispatch["dispatch_id"],
        "verifier_digests": report["input_digests"]["verifier"],
        "ruleset_version": report["ruleset_version"],
    }
    check_snapshot(store, {**dispatch, **captured})
    store.append("captured", captured)
    return captured


def profile_tests(profile: dict) -> list:
    tests = profile.get("tests", [])
    if not isinstance(tests, list) or len(tests) > 1:
        deny()  # unchanged wrapper cannot safely quiesce between multiple test-copy phases
    return tests


def check_repo(repo: Path, gid: int) -> None:
    """Shared launcher/diagnosis metadata policy; never run a repository command."""
    if not repo.is_absolute() or repo.is_symlink():
        deny()
    trusted(repo.parent, directory=True)
    info = repo.stat()
    if info.st_uid != 0 or info.st_gid != gid or info.st_mode & 0o007:
        deny()


def run_profile(name: str) -> dict:
    import fcntl

    from truthlens import wrapper
    from truthlens.registry import caller_uid

    uid = caller_uid()
    # Sudoers must point at a root-installed distribution; a codex-owned checkout is refused.
    trusted(Path(__file__))
    profile, digest = load_profile(name)
    caller = delegation(profile, uid)
    agent_argv(profile.get("command"))
    trusted(Path(profile["command"][0]))
    gid = agent_account()
    tests = profile_tests(profile)
    repo = Path(profile["repo"])
    check_repo(repo, gid)
    store = Registry()
    _private_directory(store.root / "runs")
    lock = os.open(store.root / "capture.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        trusted(store.root / "capture.lock", private=True)
        dispatch = store.dispatch(
            name,
            uid,
            caller["on_behalf_of"],
            [c["uid"] for c in profile["callers"]],
            digest,
            caller["name"],
            status_reader_uids=[r["uid"] for r in profile.get("status_readers", [])],
        )
        source = store.root / "runs" / dispatch["dispatch_id"]
        source.mkdir(mode=0o700)
        trusted(KEY_FILE, private=True)
        key = read_audit_key(KEY_FILE, source)
        import pwd

        from truthlens.pipeline_agent import quiesce

        agent_uid = pwd.getpwnam("tl-agent").pw_uid
        quiesce(agent_uid)  # also cover pre-run reads, including prior crashed runs
        command = [
            "/opt/truthlens/venv/bin/truthlens",
            "pipeline",
            "_agent",
            "--dispatch",
            dispatch["dispatch_id"],
        ]
        trusted(Path(command[0]))
        wrapper.run(
            wrapper.RunConfig(
                out_dir=source,
                repo=repo,
                command=command,
                agent="agent-zero",
                hmac_key=key,
                hmac_key_id="server-v1",
                criteria=profile.get("criteria", {}),
                confirm=[],
                human="profile-delegation-not-approval",
                test_user="tl-agent",
                timeout=1800,
                tests=[wrapper.TestSpec(t["criterion_ids"], t["command"]) for t in tests],
            )
        )
        quiesce(agent_uid)  # no test descendants can survive into the next capture
        capture = finalize(store, dispatch)
        job = store.queue(capture["run_id"], uid, dispatch["session_id"])
    finally:
        os.close(lock)
    from truthlens.pipeline_jobs import drain

    drain(store)
    return {
        "run_id": capture["run_id"],
        "audit_id": job["audit_id"],
        "session_id": dispatch["session_id"],
        "connection": "not connected",
    }


def recover_captures(store: Registry) -> None:
    """Resume only already dispatched local captures after the launcher stopped."""
    import fcntl

    from truthlens.audit_inputs import AuditInputError
    from truthlens.registry import RegistryError

    fd = os.open(store.root / "capture.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        trusted(store.root / "capture.lock", private=True)
        rows = store.records()
        captured = {r["data"]["dispatch_id"] for r in rows if r["event"] == "captured"}
        for row in rows:
            if row["event"] != "dispatch" or row["data"]["dispatch_id"] in captured:
                continue
            try:
                finalize(store, row["data"])
                captured.add(row["data"]["dispatch_id"])
            except (RegistryError, AuditInputError, OSError, ValueError):
                # An incomplete run or partial snapshot remains pending for review.
                # Never repair, delete, overwrite or infer completion from agent text.
                continue
    finally:
        os.close(fd)
