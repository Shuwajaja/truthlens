"""Conservative mapping from registrations and recorded metadata only."""

from __future__ import annotations

from pathlib import Path


def normalize_remote(value: str) -> str:
    value = value.strip().removesuffix("/").removesuffix(".git")
    if value.startswith("git@") and ":" in value:
        value = value[4:].replace(":", "/", 1)
    for prefix in ("https://", "http://", "ssh://git@"):
        value = value.removeprefix(prefix)
    return value


def assign(config: dict, source: dict, local_id: str, metadata: dict | None = None) -> dict:
    overrides = [
        item
        for item in config.get("overrides", [])
        if item.get("source_id") == source["id"] and item.get("source_run_id") == local_id
    ]
    mapping = overrides[-1] if overrides else source
    project = mapping.get("project_id")
    workspace = mapping.get("workspace_id")
    known_projects = {item["id"] for item in config["projects"]}
    known_workspaces = {item["id"]: item for item in config.get("workspaces", [])}
    if project is not None and project not in known_projects:
        raise ValueError("unknown project mapping")
    if workspace:
        if workspace not in known_workspaces:
            raise ValueError("unknown workspace mapping")
        owner = known_workspaces[workspace]["project_id"]
        if project and project != owner:
            raise ValueError("workspace project mismatch")
        project = owner
    if overrides and not mapping.get("reason", "").strip():
        raise ValueError("override requires reason")
    reason = (
        "override: " + mapping["reason"]
        if overrides
        else "registered source"
        if project
        else "UNASSIGNED: no explicit project mapping"
    )
    candidates = []
    if not project and metadata:
        for item in known_workspaces.values():
            remote = metadata.get("repo_remote")
            if not remote or normalize_remote(remote) != normalize_remote(item.get("repo_remote", "")):
                continue
            root = metadata.get("root")
            exact_root = root and item.get("root") and Path(root).absolute() == Path(item["root"]).absolute()
            historical = (
                metadata.get("commit")
                and metadata.get("task_ref")
                and metadata.get("commit") == item.get("commit")
                and metadata.get("task_ref") == item.get("task_ref")
            )
            if exact_root or historical:
                if metadata.get("branch") and item.get("branch") != metadata["branch"]:
                    continue
                candidates.append(item["id"])
        if len(candidates) == 1:
            workspace = candidates[0]
            project = known_workspaces[workspace]["project_id"]
            reason = "source-reported remote and registered root/worktree or commit/task (not witnessed)"
        elif candidates:
            reason = "UNASSIGNED: ambiguous recorded workspace metadata"
    return {
        "project_id": project,
        "workspace_id": workspace,
        "mapping_reason": reason,
        "mapping_candidates": candidates,
    }
