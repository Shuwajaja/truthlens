import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseWidgetResult } from "../src/widget/data.ts";
const all = JSON.parse(
  readFileSync(new URL("../public/workspace.json", import.meta.url), "utf8"),
);
const projectId = all.projects[0].id;
const document = {
  ...all,
  projects: all.projects.filter((p: { id: string }) => p.id === projectId),
  workspaces: all.workspaces.filter(
    (w: { project_id: string }) => w.project_id === projectId,
  ),
  runs: all.runs
    .filter((r: { project_id: string }) => r.project_id === projectId)
    .slice(0, 10),
  memory: [],
  unassigned: [],
};
const result = {
  structuredContent: {
    schema_version: "truthlens.widget/1",
    project_id: projectId,
    snapshot_id: "recorded-snapshot",
    generated_at: "2026-10-16T12:00:00Z",
    selected_run_id: document.runs[0].id,
    summary: document.runs.map((r: Record<string, unknown>) =>
      Object.fromEntries(
        [
          "id",
          "title",
          "origin",
          "integrity",
          "verification",
          "review",
          "acceptance",
        ].map((k) => [k, r[k]]),
      ),
    ),
  },
  _meta: { "truthlens/workspace": document },
};
assert.equal(
  parseWidgetResult(result).document.runs.length,
  document.runs.length,
);
const forged = structuredClone(result);
forged.structuredContent.summary[0].verification = "INVENTED";
assert.throws(() => parseWidgetResult(forged), /differs/);
assert.throws(() => parseWidgetResult({ ...result, _meta: {} }), /Invalid/);
assert.throws(
  () =>
    parseWidgetResult({
      ...result,
      structuredContent: { ...result.structuredContent, project_id: "foreign" },
    }),
  /scope mismatch/,
);
assert.throws(
  () =>
    parseWidgetResult({
      ...result,
      structuredContent: {
        ...result.structuredContent,
        selected_run_id: "foreign",
      },
    }),
  /outside/,
);
const duplicate = structuredClone(result);
duplicate.structuredContent.summary = Array(document.runs.length).fill(
  result.structuredContent.summary[0],
);
if (document.runs.length > 1)
  assert.throws(() => parseWidgetResult(duplicate), /differs/);
assert.throws(
  () => parseWidgetResult({ ...result, isError: true }),
  /could not return/,
);
console.log(
  "Widget boundary checks passed: server data required, summary parity, project scope, selection, duplicate IDs, error isolation.",
);

assert.throws(() => parseWidgetResult({...result, structuredContent: {...result.structuredContent, view: "invented"}}), /Unsupported widget view/);
assert.throws(() => parseWidgetResult({...result, structuredContent: {...result.structuredContent, view: "artifact-viewer"}}), /requires recorded/);
assert.throws(() => parseWidgetResult({...result, structuredContent: {...result.structuredContent, selected_artifact_id: "foreign"}}), /outside this run/);
assert.throws(() => parseWidgetResult({...result, structuredContent: {...result.structuredContent, envelope: {schema_version: "truthlens.render/1", project_id: "foreign"}}}), /Invalid render envelope/);

const memoryNote = { id: "note", text: "Recorded statement", project_id: projectId,
  source_ref: "notes.md", access_policy: "project", claim_refs: [], retrieval_refs: [] };
const memoryResult = {
  structuredContent: { ...result.structuredContent, view: "project-memory", selected_run_id: null,
    summary: [], memory_total: 101 },
  _meta: { "truthlens/workspace": {...document, runs: [], memory: [memoryNote]} },
};
assert.equal(parseWidgetResult(memoryResult).memoryTotal, 101);
assert.throws(() => parseWidgetResult({...result, _meta: {"truthlens/workspace": {...document, memory: [memoryNote]}}}), /dedicated view/);
for (const patch of [{project_id: "foreign"}, {access_policy: "private"}, {project_id: null}]) {
  assert.throws(() => parseWidgetResult({...memoryResult, _meta: {"truthlens/workspace": {
    ...memoryResult._meta["truthlens/workspace"], memory: [{...memoryNote, ...patch}],
  }}}));
}
for (const total of [-1, 0, 1.5, "101"]) {
  assert.throws(() => parseWidgetResult({...memoryResult, structuredContent: {...memoryResult.structuredContent, memory_total: total}}), /Invalid project memory/);
}
assert.throws(() => parseWidgetResult({...memoryResult, _meta: {"truthlens/workspace": {
  ...memoryResult._meta["truthlens/workspace"], memory: Array.from({length:101}, (_, i) => ({...memoryNote, id:String(i)})),
}}}), /Invalid project memory/);
console.log("Memory widget checks passed: explicit view, project/policy scope, total and count bounds.");
