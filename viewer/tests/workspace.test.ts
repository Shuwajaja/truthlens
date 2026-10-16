import assert from "node:assert/strict";
import { rendererFor, rendererOptions, registry } from "../src/registry.ts";
import {
  validateWorkspace,
  validAction,
  validateProfile,
  defaultProfile,
} from "../src/workspace.ts";
const d = {
  schema_version: "truthlens.workspace/1",
  projects: [{ id: "p", name: "Project" }],
  workspaces: [{ id: "w", project_id: "p", name: "Local" }],
  sources: [{ id: "s", name: "Source", kind: "native" }],
  runs: [
    {
      id: "r",
      project_id: "p",
      workspace_id: "w",
      source_id: "s",
      title: "Run",
      origin: "NATIVE",
      integrity: "hash-only",
      verification: "UNKNOWN",
      review: "REQUIRED",
      acceptance: "UNKNOWN",
      errors: [],
      criteria: [],
      claims: [],
      events: [],
      artifacts: [
        { id: "a", path: "result.txt", kind: "plain", content: "text" },
      ],
    },
  ],
  memory: [],
  unassigned: [],
};
assert.ok(validateWorkspace(d));
assert.ok(!validateWorkspace({ ...d, schema_version: "wrong" }));
assert.ok(
  !validateWorkspace({ ...d, runs: [{ ...d.runs[0], project_id: "other" }] }),
);
assert.ok(
  !validateWorkspace({
    ...d,
    runs: [{ ...d.runs[0], acceptance: "ACCEPTED" }],
  }),
);
assert.ok(
  !validateWorkspace({ ...d, runs: [{ ...d.runs[0], artifacts: [null] }] }),
);
assert.ok(
  validAction(
    { type: "open_artifact", project_id: "p", run_id: "r", artifact_id: "a" },
    d,
    "p",
  ),
);
assert.ok(
  !validAction(
    { type: "open_artifact", project_id: "p", run_id: "r", artifact_id: "a" },
    d,
    "other",
  ),
);
assert.ok(
  !validAction(
    {
      type: "open_artifact",
      project_id: "p",
      run_id: "r",
      artifact_id: "missing",
    },
    d,
    "p",
  ),
);
assert.ok(!validAction({ type: "execute", id: "r" }, d, "p"));
assert.ok(validateProfile(defaultProfile));
assert.ok(!validateProfile({ ...defaultProfile, script: "evil" }));
assert.ok(
  validAction(
    { type: "set_filters", project_id: "p", filters: { query: "test" } },
    d,
    "p",
  ),
);
assert.ok(
  validAction(
    {
      type: "set_layout",
      project_id: "p",
      layout: {
        collection: "cards",
        pane_order: ["results", "runs", "knowledge"],
      },
    },
    d,
    "p",
  ),
);
assert.ok(
  validAction(
    {
      type: "select_renderer",
      project_id: "p",
      run_id: "r",
      artifact_id: "a",
      renderer: "plain",
    },
    d,
    "p",
  ),
);
assert.ok(
  !validAction(
    {
      type: "select_renderer",
      project_id: "p",
      run_id: "r",
      artifact_id: "a",
      renderer: "html",
    },
    d,
    "p",
  ),
);
assert.ok(
  !validAction(
    { type: "open_run", project_id: "p", run_id: "r", shell: "rm" },
    d,
    "p",
  ),
);
assert.ok(
  !validAction(
    { type: "open_run", project_id: "p", run_id: "r" },
    { ...d, runs: [{ ...d.runs[0], integrity: "failed" }] },
    "p",
  ),
);
assert.ok(
  validateWorkspace({ ...d, runs: [{ ...d.runs[0], workspace_id: null }] }),
);
assert.ok(
  !validateWorkspace({
    ...d,
    runs: [
      {
        ...d.runs[0],
        origin: "IMPORTED",
        integrity: "hmac",
        verification: "VERIFIED",
      },
    ],
  }),
);
console.log(
  "19 workspace contract, isolation, action and profile checks passed",
);

assert.equal(rendererFor("executable-untrusted"), "plain");
assert.equal(rendererFor("MD"), "markdown");
assert.deepEqual(
  rendererOptions({ id: "a", path: "absent.html", kind: "html" }),
  ["plain"],
);
assert.ok(
  registry.find((x) => x.id === "html")?.sandbox_policy ===
    "opaque-origin-no-network",
);
console.log("4 deterministic renderer/fallback/security policy checks passed");

// Reject hostile JSON discriminants without throwing or coercing their types.
for (const name of ["__proto__", "constructor", "toString"]) {
  assert.equal(validAction({ type: name, project_id: "p" }, d, "p"), false);
  assert.equal(validAction({ type: "select_renderer", project_id: "p", run_id: "r", artifact_id: "a", renderer: name }, d, "p"), false);
}
assert.equal(validAction({ type: "navigate", project_id: "p", view: ["overview"] }, d, "p"), false);
assert.equal(validAction({ type: "set_layout", project_id: "p", layout: { density: ["compact"] } }, d, "p"), false);
assert.equal(validateProfile({ ...defaultProfile, theme: ["dark"] }), false);
const absent = { ...d, runs: [{ ...d.runs[0], artifacts: [{ id: "a", path: "absent.html", kind: "html" }] }] };
assert.equal(validAction({ type: "select_renderer", project_id: "p", run_id: "r", artifact_id: "a", renderer: "html" }, absent, "p"), false);
const upper = { ...d, runs: [{ ...d.runs[0], artifacts: [{ id: "a", path: "readme.md", kind: "MD", content: "# Recorded" }] }] };
assert.equal(validAction({ type: "select_renderer", project_id: "p", run_id: "r", artifact_id: "a", renderer: "markdown" }, upper, "p"), true);
console.log("11 hostile action/profile and renderer capability regression checks passed");
