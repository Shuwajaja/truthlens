import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateRenderEnvelope } from "../src/renderkit/envelope.ts";
import {
  diffLines,
  recordedEvents,
  embeddedRaster,
} from "../src/renderkit/recorded.ts";
import { rendererFor, rendererOptions } from "../src/registry.ts";
import type { WorkspaceDoc } from "../src/workspace.ts";
const doc = JSON.parse(
  readFileSync(new URL("../public/workspace.json", import.meta.url), "utf8"),
) as WorkspaceDoc;
const run = doc.runs.find((r) => r.artifacts.length && r.project_id)!;
const artifact = run.artifacts[0];
const sourceRun =
  (run as unknown as Record<string, unknown>).source_run_id ?? null;
const ref = (artifact as unknown as Record<string, unknown>).evidence_ref;
const envelope = {
  schema_version: "truthlens.render/1",
  project_id: run.project_id,
  workspace_id: run.workspace_id,
  run_id: run.id,
  artifact_id: artifact.id,
  kind: rendererFor(artifact.kind),
  payload_ref: artifact.id,
  presentation: {
    preferred_renderer: rendererOptions(artifact)[0],
    supported_renderers: rendererOptions(artifact),
  },
  provenance: {
    source_id: run.source_id,
    source_run_id: sourceRun,
    event_refs: run.events.some((e) => e.id === ref) ? [ref] : [],
  },
  trust: {
    origin: run.origin,
    integrity: run.integrity,
    verification: run.verification,
    review: run.review,
    acceptance: run.acceptance,
  },
  data_status: "available",
};
assert(validateRenderEnvelope(envelope, doc, run.project_id!));
for (const changed of [
  { ...envelope, project_id: "foreign" },
  { ...envelope, payload_ref: "../../private" },
  { ...envelope, run_id: "foreign" },
  { ...envelope, trust: { ...envelope.trust, acceptance: "APPROVED" } },
  { ...envelope, provenance: { ...envelope.provenance, source_id: "forged" } },
  {
    ...envelope,
    provenance: { ...envelope.provenance, event_refs: ["invented"] },
  },
  {
    ...envelope,
    presentation: { preferred_renderer: "html", supported_renderers: ["html"] },
  },
  { ...envelope, script: "malicious" },
  { ...envelope, data_status: "missing" },
])
  assert(!validateRenderEnvelope(changed, doc, run.project_id!));
assert(!validateRenderEnvelope(envelope, doc, "wrong-scope"));
assert.deepEqual(recordedEvents({ ...run, integrity: "failed" }), []);
assert.equal(recordedEvents(run)[0].timestamp, run.events[0]?.ts ?? null);
const lines = diffLines("@@ -8,2 +8,2 @@\n-old\n+new\n same");
assert.deepEqual(
  lines.map((l) => [l.old, l.next]),
  [
    [null, null],
    [8, null],
    [null, 8],
    [9, 9],
  ],
);
assert(!embeddedRaster("https://example.com/x.png"));
assert(!embeddedRaster("data:image/svg+xml;base64,AAAA"));
assert(embeddedRaster("data:image/png;base64,AAAA"));
console.log(
  "RenderKit: fixture provenance, scope, trust, isolation, diff coordinates and media checks passed.",
);
