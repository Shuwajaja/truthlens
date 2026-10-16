import { isRecord, type WorkspaceDoc } from "../workspace.ts";
import { rendererFor, rendererOptions, type RendererId } from "../registry.ts";
export type RenderEnvelope = {
  schema_version: "truthlens.render/1";
  project_id: string;
  workspace_id?: string | null;
  run_id: string;
  artifact_id: string;
  kind: string;
  payload_ref: string;
  presentation: {
    preferred_renderer: RendererId;
    supported_renderers: RendererId[];
  };
  provenance: {
    source_id: string;
    source_run_id?: string | null;
    event_refs?: string[];
  };
  trust: {
    origin: string;
    integrity: string;
    verification: string;
    review: string;
    acceptance: string;
  };
  limitations?: string[];
  data_status:
    | "available"
    | "missing"
    | "malformed"
    | "isolated"
    | "unauthorized";
};
const closed = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).every((k) => keys.includes(k));
const bounded = (v: unknown, max = 400): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
/** Resolve every identity against the scoped snapshot; a presentation never authorizes access. */
export function validateRenderEnvelope(
  value: unknown,
  doc: WorkspaceDoc,
  projectId: string,
): value is RenderEnvelope {
  if (
    !isRecord(value) ||
    !closed(value, [
      "schema_version",
      "project_id",
      "workspace_id",
      "run_id",
      "artifact_id",
      "kind",
      "payload_ref",
      "presentation",
      "provenance",
      "trust",
      "limitations",
      "data_status",
    ]) ||
    value.schema_version !== "truthlens.render/1" ||
    value.project_id !== projectId ||
    !bounded(value.project_id, 200) ||
    !bounded(value.run_id) ||
    !bounded(value.artifact_id) ||
    value.payload_ref !== value.artifact_id
  )
    return false;
  const run = doc.runs.find(
      (r) => r.id === value.run_id && r.project_id === projectId,
    ),
    a = run?.artifacts.find((a) => a.id === value.artifact_id);
  if (
    !run ||
    !a ||
    (value.workspace_id ?? null) !== run.workspace_id ||
    value.kind !== rendererFor(a.kind)
  )
    return false;
  const { presentation: p, provenance: s, trust: t } = value;
  if (
    !isRecord(p) ||
    !closed(p, ["preferred_renderer", "supported_renderers"]) ||
    !Array.isArray(p.supported_renderers) ||
    !p.supported_renderers.length ||
    p.supported_renderers.length > 16 ||
    new Set(p.supported_renderers).size !== p.supported_renderers.length ||
    !p.supported_renderers.includes(p.preferred_renderer)
  )
    return false;
  if (
    !p.supported_renderers.every((id) =>
      rendererOptions(a).includes(id as RendererId),
    )
  )
    return false;
  if (
    !isRecord(s) ||
    !closed(s, ["source_id", "source_run_id", "event_refs"]) ||
    s.source_id !== run.source_id
  )
    return false;
  const original = run as unknown as Record<string, unknown>;
  if ((s.source_run_id ?? null) !== (original.source_run_id ?? null))
    return false;
  const refs = s.event_refs ?? [];
  if (
    !Array.isArray(refs) ||
    refs.length > 200 ||
    new Set(refs).size !== refs.length ||
    !refs.every((ref) => bounded(ref) && run.events.some((e) => e.id === ref))
  )
    return false;
  const ar = a as unknown as Record<string, unknown>,
    expected = run.events.some((e) => e.id === ar.evidence_ref)
      ? [ar.evidence_ref]
      : [];
  if (
    refs.length !== expected.length ||
    refs.some((ref) => !expected.includes(ref))
  )
    return false;
  const axes = ["origin", "integrity", "verification", "review", "acceptance"];
  if (
    !isRecord(t) ||
    !closed(t, axes) ||
    !axes.every((k) => t[k] === original[k])
  )
    return false;
  if (
    run.origin === "IMPORTED" &&
    (run.integrity === "hmac" || run.verification === "VERIFIED")
  )
    return false;
  if (
    !["available", "missing", "malformed", "isolated", "unauthorized"].includes(
      String(value.data_status),
    )
  )
    return false;
  if (run.integrity === "failed" && value.data_status !== "isolated")
    return false;
  if (
    value.data_status === "available" &&
    (typeof a.content !== "string" ||
      new TextEncoder().encode(a.content).length > 262144)
  )
    return false;
  if (
    value.data_status === "available" &&
    ["json", "chart", "timeline", "graph"].includes(String(value.kind))
  ) {
    try {
      const parsed: unknown = JSON.parse(a.content as string);
      if (
        value.kind !== "json" &&
        (parsed === null || typeof parsed !== "object")
      )
        return false;
    } catch {
      return false;
    }
  }
  if (
    value.data_status === "missing" &&
    a.content !== undefined &&
    a.content !== null
  )
    return false;
  if (value.data_status === "isolated" && run.integrity !== "failed")
    return false;
  if (
    value.data_status !== "available" &&
    (p.preferred_renderer !== "plain" ||
      p.supported_renderers.length !== 1 ||
      p.supported_renderers[0] !== "plain")
  )
    return false;
  if (
    value.limitations !== undefined &&
    (!Array.isArray(value.limitations) ||
      value.limitations.length > 20 ||
      !value.limitations.every((x) => typeof x === "string" && x.length <= 500))
  )
    return false;
  return true;
}
