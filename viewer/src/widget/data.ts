import {
  validateRenderEnvelope,
  type RenderEnvelope,
} from "../renderkit/envelope.ts";
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
  view: string;
  selectedArtifactId: string | null;
  envelope: RenderEnvelope | null;
  memoryTotal: number;
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
    document.memory.some(m => m.project_id !== summary.project_id || !["project", "public"].includes(String(m.access_policy))) ||
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
  const view = summary.view ?? "workspace-overview";
  const selectedArtifactId = summary.selected_artifact_id ?? null;
  const envelope = summary.envelope ?? null;
  if (
    ![
      "workspace-overview",
      "artifact-viewer",
      "evidence-inspector",
      "run-timeline",
      "project-memory",
    ].includes(String(view))
  )
    throw new Error("Unsupported widget view.");
  const memoryTotal = summary.memory_total ?? 0;
  if (view === "project-memory") {
    if (!Number.isSafeInteger(memoryTotal) || Number(memoryTotal) < document.memory.length ||
        document.memory.length > 100 || document.runs.length ||
        summary.selected_run_id !== null || selectedArtifactId !== null || envelope !== null)
      throw new Error("Invalid project memory selection.");
  } else if (document.memory.length || memoryTotal !== 0) {
    throw new Error("Memory is only available in its dedicated view.");
  }
  if (
    selectedArtifactId !== null &&
    !document.runs.some(
      (r) =>
        r.id === summary.selected_run_id &&
        r.artifacts.some((a) => a.id === selectedArtifactId),
    )
  )
    throw new Error("Selected artifact is outside this run.");
  if (
    envelope !== null &&
    (!validateRenderEnvelope(envelope, document, summary.project_id) ||
      envelope.run_id !== summary.selected_run_id ||
      envelope.artifact_id !== selectedArtifactId)
  )
    throw new Error("Invalid render envelope. No evidence displayed.");
  if (view === "artifact-viewer" && (!selectedArtifactId || !envelope))
    throw new Error("Artifact view requires recorded artifact evidence.");
  return {
    view: String(view),
    memoryTotal: Number(memoryTotal),
    selectedArtifactId: selectedArtifactId as string | null,
    envelope: envelope as RenderEnvelope | null,
    document,
    projectId: summary.project_id,
    snapshotId: summary.snapshot_id,
    generatedAt: summary.generated_at,
    selectedRunId: summary.selected_run_id as string | null,
  };
}
