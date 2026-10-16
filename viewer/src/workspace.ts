import { rendererOptions } from "./registry.ts";
export type RecordValue = Record<string, unknown>;
export type Artifact = {
  id: string;
  path: string;
  kind: string;
  content?: unknown;
  sha256?: string;
};
export type Run = {
  id: string;
  project_id: string | null;
  workspace_id: string | null;
  source_id: string;
  title: string;
  origin: string;
  integrity: string;
  verification: string;
  review: string;
  acceptance: string;
  started?: string;
  agent?: string;
  mapping_reason?: string;
  reported_status?: string;
  reported_summary?: string;
  errors: unknown[];
  criteria: RecordValue[];
  claims: unknown[];
  events: RecordValue[];
  artifacts: Artifact[];
};
export type WorkspaceDoc = {
  schema_version: string;
  generated_at?: string;
  projects: { id: string; name: string }[];
  workspaces: {
    id: string;
    project_id: string;
    name: string;
    mapping_reason?: string;
  }[];
  runs: Run[];
  memory: RecordValue[];
  sources: RecordValue[];
  unassigned: unknown[];
};
export const isRecord = (v: unknown): v is RecordValue =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => typeof v === "string" && v.length <= 2_000_000;
const list = (v: unknown): v is unknown[] =>
  Array.isArray(v) && v.length <= 10000;
const unique = (v: RecordValue[]) =>
  new Set(v.map((x) => x.id)).size === v.length;
export function validateWorkspace(v: unknown): v is WorkspaceDoc {
  if (!isRecord(v) || v.schema_version !== "truthlens.workspace/1")
    return false;
  for (const key of [
    "projects",
    "workspaces",
    "runs",
    "memory",
    "sources",
    "unassigned",
  ])
    if (!list(v[key])) return false;
  const d = v as unknown as WorkspaceDoc;
  if (
    !d.projects.every((p) => isRecord(p) && str(p.id) && str(p.name)) ||
    !unique(d.projects)
  )
    return false;
  if (
    !d.workspaces.every(
      (w) =>
        isRecord(w) &&
        str(w.id) &&
        str(w.name) &&
        d.projects.some((p) => p.id === w.project_id),
    ) ||
    !unique(d.workspaces)
  )
    return false;
  if (
    !d.sources.every(
      (s) => isRecord(s) && str(s.id) && str(s.kind) && str(s.name),
    ) ||
    !unique(d.sources)
  )
    return false;
  if (
    !d.runs.every(
      (r) =>
        isRecord(r) &&
        str(r.id) &&
        str(r.title) &&
        ["agent", "mapping_reason", "reported_status", "reported_summary", "started"].every(
          (key) => (r as RecordValue)[key] === undefined || (r as RecordValue)[key] === null || str((r as RecordValue)[key]),
        ) &&
        (r.project_id === null ||
          d.projects.some((p) => p.id === r.project_id)) &&
        (r.workspace_id === null ||
          d.workspaces.some(
            (w) => w.id === r.workspace_id && w.project_id === r.project_id,
          )) &&
        d.sources.some((s) => s.id === r.source_id) &&
        ["NATIVE", "IMPORTED"].includes(r.origin) &&
        ["hmac", "hash-only", "failed", "unknown"].includes(r.integrity) &&
        ["VERIFIED", "FAILED", "UNKNOWN"].includes(r.verification) &&
        ["REQUIRED", "UNKNOWN"].includes(r.review) &&
        r.acceptance === "UNKNOWN" &&
        !(
          r.origin === "IMPORTED" &&
          (r.integrity === "hmac" || r.verification === "VERIFIED")
        ) &&
        !(r.integrity === "failed" && r.verification === "VERIFIED") &&
        ["errors", "criteria", "claims", "events", "artifacts"].every((k) =>
          list((r as unknown as RecordValue)[k]),
        ) &&
        r.errors.every((e) => str(e) || isRecord(e)) &&
        r.claims.every(
          (c) =>
            isRecord(c) &&
            str(c.text) &&
            list(c.criterion_ids) &&
            c.criterion_ids.every(str),
        ) &&
        r.criteria.every(
          (c) =>
            isRecord(c) &&
            str(c.text ?? c.title) &&
            ["met", "unmet", "unverified", "proposed"].includes(
              String(c.status),
            ),
        ) &&
        r.events.every(
          (e) =>
            isRecord(e) &&
            str(e.id) &&
            str(e.type) &&
            (e.payload === undefined || isRecord(e.payload)) &&
            (e.ts === undefined || str(e.ts)),
        ) &&
        r.artifacts.every(
          (a) =>
            isRecord(a) &&
            str(a.id) &&
            str(a.path) &&
            str(a.kind) &&
            (a.content === undefined ||
              str(a.content) ||
              isRecord(a.content) ||
              list(a.content)),
        ) &&
        unique(r.artifacts),
    )
  )
    return false;
  if (!unique(d.runs)) return false;
  return (
    d.memory.every(
      (m) =>
        isRecord(m) &&
        str(m.id) &&
        str(m.text) &&
        str(m.source_ref) &&
        (m.source_id === undefined ||
          d.sources.some((s) => s.id === m.source_id)) &&
        ["captured_at", "valid_from", "valid_to", "revision_of"].every(
          (k) => m[k] === undefined || m[k] === null || str(m[k]),
        ) &&
        (m.access_policy === undefined || str(m.access_policy)) &&
        (m.project_id === null || d.projects.some((p) => p.id === m.project_id)) &&
        ["claim_refs", "retrieval_refs"].every(
          (k) => list(m[k]) && (m[k] as unknown[]).every(str),
        ),
    ) && unique(d.memory)
  );
}
export type View =
  | "Overview"
  | "Results"
  | "Activity"
  | "Evidence"
  | "Knowledge"
  | "Sources"
  | "Appearance";
export const views: View[] = [
  "Overview",
  "Results",
  "Activity",
  "Evidence",
  "Knowledge",
  "Sources",
  "Appearance",
];
export type Action =
  | { type: "navigate"; project_id: string; view: string }
  | { type: "open_run"; project_id: string; run_id: string }
  | {
      type: "open_artifact" | "select_renderer";
      project_id: string;
      run_id: string;
      artifact_id: string;
      renderer?: string;
    }
  | {
      type: "set_filters";
      project_id: string;
      filters: { query?: string; origin?: string; verification?: string };
    }
  | {
      type: "set_layout";
      project_id: string;
      layout: {
        density?: "comfortable" | "compact";
        collection?: "list" | "cards";
        pane_order?: string[];
      };
    }
  | {
      type: "focus_evidence";
      project_id: string;
      run_id: string;
      evidence_id: string;
    };
export function validAction(
  a: unknown,
  d: WorkspaceDoc,
  project: string,
): a is Action {
  if (
    !isRecord(a) ||
    a.project_id !== project ||
    !d.projects.some((p) => p.id === project)
  )
    return false;
  const keys: Record<string, string[]> = {
    navigate: ["type", "project_id", "view"],
    open_run: ["type", "project_id", "run_id"],
    open_artifact: ["type", "project_id", "run_id", "artifact_id"],
    select_renderer: [
      "type",
      "project_id",
      "run_id",
      "artifact_id",
      "renderer",
    ],
    set_filters: ["type", "project_id", "filters"],
    set_layout: ["type", "project_id", "layout"],
    focus_evidence: ["type", "project_id", "run_id", "evidence_id"],
  };
  if (
    typeof a.type !== "string" ||
    !Object.hasOwn(keys, a.type) ||
    Object.keys(a).some((k) => !keys[a.type as string].includes(k))
  )
    return false;
  if (a.type === "navigate")
    return [
      "overview",
      "runs",
      "results",
      "activity",
      "knowledge",
      "evidence",
      "sources",
    ].includes(typeof a.view === "string" ? a.view : "");
  if (a.type === "set_filters")
    return (
      isRecord(a.filters) &&
      Object.keys(a.filters).every((k) =>
        ["query", "origin", "verification"].includes(k),
      ) &&
      Object.values(a.filters).every(
        (v) => typeof v === "string" && v.length <= 2048,
      ) &&
      (a.filters.origin === undefined || ["", "NATIVE", "IMPORTED"].includes(String(a.filters.origin))) &&
      (a.filters.verification === undefined || ["", "VERIFIED", "FAILED", "UNKNOWN"].includes(String(a.filters.verification)))
    );
  if (a.type === "set_layout") {
    const l = a.layout;
    return (
      isRecord(l) &&
      Object.keys(l).every((k) =>
        ["density", "collection", "pane_order"].includes(k),
      ) &&
      (l.density === undefined ||
        (typeof l.density === "string" && ["comfortable", "compact"].includes(l.density))) &&
      (l.collection === undefined ||
        (typeof l.collection === "string" && ["list", "cards"].includes(l.collection))) &&
      (l.pane_order === undefined ||
        (Array.isArray(l.pane_order) &&
          JSON.stringify([...l.pane_order].sort()) ===
            JSON.stringify(["knowledge", "results", "runs"])))
    );
  }
  const r = d.runs.find((r) => r.id === a.run_id && r.project_id === project);
  if (!r || r.integrity === "failed") return false;
  if (a.type === "open_run") return true;
  if (a.type === "focus_evidence")
    return r.events.some(
      (e) =>
        e.id === a.evidence_id &&
        ["evidence.attached", "test.reported"].includes(String(e.type)),
    );
  const artifact = r.artifacts.find((x) => x.id === a.artifact_id);
  if (!artifact) return false;
  if (a.type === "open_artifact") return true;
  return (
    typeof a.renderer === "string" &&
    rendererOptions(artifact).some((id) => id === a.renderer)
  );
}
export type Profile = {
  schema_version: "truthlens.profile/1";
  theme: "dark" | "light";
  density: "comfortable" | "compact";
  accent: "green" | "blue" | "purple";
  pane: "results-first" | "activity-first";
  collection: "list" | "cards";
  pane_order: string[];
};
export const defaultProfile: Profile = {
  schema_version: "truthlens.profile/1",
  theme: "light",
  density: "comfortable",
  accent: "blue",
  pane: "results-first",
  collection: "list",
  pane_order: ["runs", "results", "knowledge"],
};
export function validateProfile(v: unknown): v is Profile {
  return (
    isRecord(v) &&
    Object.keys(v).length === 7 &&
    v.schema_version === "truthlens.profile/1" &&
    typeof v.theme === "string" &&
    ["dark", "light"].includes(v.theme) &&
    typeof v.density === "string" &&
    ["comfortable", "compact"].includes(v.density) &&
    typeof v.accent === "string" &&
    ["green", "blue", "purple"].includes(v.accent) &&
    typeof v.pane === "string" &&
    ["results-first", "activity-first"].includes(v.pane) &&
    typeof v.collection === "string" &&
    ["list", "cards"].includes(v.collection) &&
    Array.isArray(v.pane_order) &&
    JSON.stringify([...v.pane_order].sort()) ===
      JSON.stringify(["knowledge", "results", "runs"])
  );
}
export function readProfile(): Profile {
  try {
    const v = JSON.parse(localStorage.getItem("truthlens.profile") || "null");
    return validateProfile(v) ? v : defaultProfile;
  } catch {
    return defaultProfile;
  }
}
