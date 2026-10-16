import {
  isRecord,
  validateWorkspace,
  type WorkspaceDoc,
} from "../workspace.ts";
export type WidgetSnapshot = {
  document: WorkspaceDoc;
  projectId: string;
  snapshotId: string;
  selectedRunId: string | null;
  generatedAt: string;
};
/** Business state only comes from validated server tool results, never tool inputs. */
export function parseWidgetResult(result: unknown): WidgetSnapshot {
  if (!isRecord(result) || result.isError)
    throw new Error(
      "The server could not return this snapshot. Refresh to retry.",
    );
  const summary = result.structuredContent;
  const meta = result._meta;
  if (
    !isRecord(summary) ||
    summary.schema_version !== "truthlens.widget/1" ||
    !isRecord(meta)
  )
    throw new Error(
      "Unsupported widget response. Ask TruthLens to render the workspace again.",
    );
  const document = meta["truthlens/workspace"];
  if (
    !validateWorkspace(document) ||
    document.runs.length > 10 ||
    typeof summary.project_id !== "string" ||
    typeof summary.snapshot_id !== "string" ||
    !summary.snapshot_id ||
    typeof summary.generated_at !== "string" ||
    !Number.isFinite(Date.parse(summary.generated_at))
  )
    throw new Error("Invalid workspace snapshot. No evidence displayed.");
  if (
    document.projects.length !== 1 ||
    document.projects[0].id !== summary.project_id ||
    document.runs.some((r) => r.project_id !== summary.project_id) ||
    document.workspaces.some((w) => w.project_id !== summary.project_id) ||
    document.memory.length ||
    document.unassigned.length
  )
    throw new Error("Project scope mismatch. No evidence displayed.");
  const rows = summary.summary;
  if (
    !Array.isArray(rows) ||
    rows.length !== document.runs.length ||
    new Set(rows.map((r) => (isRecord(r) ? r.id : null))).size !==
      rows.length ||
    !rows.every(
      (r) =>
        isRecord(r) &&
        document.runs.some((run) =>
          [
            "id",
            "title",
            "origin",
            "integrity",
            "verification",
            "review",
            "acceptance",
          ].every((k) => r[k] === run[k as keyof typeof run]),
        ),
    )
  )
    throw new Error("Snapshot summary differs from recorded data.");
  if (
    summary.selected_run_id !== null &&
    !document.runs.some((r) => r.id === summary.selected_run_id)
  )
    throw new Error("Selected run is outside this snapshot.");
  return {
    document,
    projectId: summary.project_id,
    snapshotId: summary.snapshot_id,
    generatedAt: summary.generated_at,
    selectedRunId: summary.selected_run_id as string | null,
  };
}
