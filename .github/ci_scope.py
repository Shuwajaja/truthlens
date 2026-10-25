"""Conservative, dependency-free CI scope and required-check evaluation."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

FAST_TESTS = [
    f"tests/test_{name}.py"
    for name in (
        "canonical",
        "redaction",
        "ledger",
        "manifest",
        "audit",
        "audit_inputs",
        "registry",
        "pipeline",
        "pipeline_agent",
        "pipeline_jobs",
        "registry_view",
        "ci_scope",
    )
]


def classify(paths: list[str]) -> tuple[bool, bool]:
    viewer = python = False
    for path in paths:
        name = Path(path).name
        if (
            path.startswith(".github/")
            or "lock" in name.lower()
            or name.endswith((".toml", ".json", ".yaml", ".yml"))
            or "config" in name.lower()
        ):
            return True, True
        if path.endswith(".md") and ("/" not in path or path.startswith(("docs/", "viewer/"))):
            continue
        if path.startswith(("viewer/", "integrations/agent-zero-acp/")):
            viewer = True
        elif path.startswith(("src/", "tests/")):
            python = True
        else:
            return True, True
    return viewer, python


def changed_paths(base: str, cwd: Path = Path(".")) -> list[str]:
    if not re.fullmatch(r"[0-9a-fA-F]{40}", base) or set(base) == {"0"}:
        raise ValueError("missing or invalid base SHA")
    raw = (
        subprocess.check_output(["git", "diff", "--name-status", "-z", "-M", base, "HEAD", "--"], cwd=cwd)
        .decode("utf-8", errors="strict")
        .split("\0")
    )
    paths = []
    index = 0
    while index < len(raw) - 1:
        status = raw[index]
        count = 2 if status.startswith(("R", "C")) else 1
        if not status or index + count >= len(raw):
            raise ValueError("invalid git diff output")
        paths.extend(raw[index + 1 : index + 1 + count])
        index += count + 1
    return paths


def extra_tests(paths: list[str], root: Path = Path(".")) -> list[str]:
    selected = {p for p in paths if p.startswith("tests/test_") and p.endswith(".py")}
    related = {
        "read_projection": ["test_read_projection.py", "test_read_service.py"],
        "read_service": ["test_read_service.py", "test_read_projection.py"],
        "wrapper": [
            "test_wrapper.py",
            "test_cli.py",
            "test_redaction_r5.py",
            "test_round5.py::test_r7_sibling_dir_of_repo_is_not_mapped_into_copy",
        ],
        "gate": [
            "test_gate_r5.py",
            "test_gate_delivery.py",
            "test_wrapper.py",
            "test_round5.py::test_r8_gate_bundled_short_c_refused",
        ],
        "redaction": ["test_redaction_r5.py"],
        "manifest": ["test_manifest_r5.py", "test_export_integrity.py"],
        "cli": ["test_cli.py"],
    }
    for source in ("status_broker", "status_wire", "status_client", "mcp_status", "status_projection", "cli"):
        related.setdefault(source, []).extend(
            ["test_status_broker.py", "test_mcp_status.py", "test_status_projection.py"]
        )
    for source in ("cli", "agent_status", "agent_setup", "demo_status", "status_client", "status_wire", "mcp_status"):
        related.setdefault(source, []).extend(
            ["test_agent_setup.py", "test_status_broker.py", "test_mcp_status.py"]
        )
    for source, tests in related.items():
        if f"src/truthlens/{source}.py" in paths:
            selected.update(f"tests/{test}" for test in tests)
    # Missing/deleted files are omitted; failures in existing tests always propagate.
    return sorted(p for p in selected if p not in FAST_TESTS and (root / p.split("::", 1)[0]).is_file())


def detect(base: str, cwd: Path = Path(".")) -> tuple[bool, bool, list[str], bool]:
    try:
        paths = changed_paths(base, cwd)
        viewer, python = classify(paths)
        return viewer, python, extra_tests(paths, cwd), True
    except (ValueError, UnicodeError, OSError, subprocess.CalledProcessError) as error:
        print(f"Scope detection failed; require both jobs: {error}", file=sys.stderr)
        return True, True, [], False


def aggregate(
    scope: str, docs: str, viewer_needed: str, python_needed: str, viewer: str, python: str
) -> bool:
    ok = scope == docs == "success"
    print(f"scope={scope or 'missing'}; docs={docs or 'missing'}")
    for name, needed, result in (("viewer", viewer_needed, viewer), ("test", python_needed, python)):
        print(f"{name}: required={needed or 'unknown'}; result={result or 'missing'}")
        if (
            needed not in ("true", "false")
            or (needed == "true" and result != "success")
            or (needed == "false" and result not in ("skipped", "success"))
        ):
            ok = False
    return ok


def main() -> int:
    if sys.argv[1] == "baseline-tests":
        return subprocess.call([sys.executable, "-m", "pytest", "-q", *FAST_TESTS])
    if sys.argv[1] == "detect":
        viewer, python, tests, ok = detect(os.environ.get("BASE_SHA", ""))
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write(f"viewer={str(viewer).lower()}\npython={str(python).lower()}\n")
            output.write(f"extra_tests={json.dumps(tests)}\n")
        return 0 if ok else 1
    if sys.argv[1] == "check":
        return (
            0
            if aggregate(
                *(
                    os.environ.get(key, "")
                    for key in (
                        "SCOPE_RESULT",
                        "DOCS_RESULT",
                        "VIEWER_NEEDED",
                        "PYTHON_NEEDED",
                        "VIEWER_RESULT",
                        "PYTHON_RESULT",
                    )
                )
            )
            else 1
        )
    if sys.argv[1] == "extra-tests":
        tests = json.loads(os.environ.get("EXTRA_TESTS", "[]"))
        if not isinstance(tests, list) or any(
            not isinstance(p, str)
            or not p.startswith("tests/test_")
            or not p.split("::", 1)[0].endswith(".py")
            or ".." in Path(p.split("::", 1)[0]).parts
            or not Path(p.split("::", 1)[0]).is_file()
            for p in tests
        ):
            raise ValueError("invalid extra test selection")
        if not tests:
            print("No additional changed/related tests selected.")
            return 0
        return subprocess.call([sys.executable, "-m", "pytest", "-q", *tests])
    raise ValueError("unknown command")


if __name__ == "__main__":
    raise SystemExit(main())
