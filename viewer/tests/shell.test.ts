import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  addTab,
  readRoute,
  routeHash,
  scopeKey,
  tabKey,
  type Route,
} from "../src/app/tabs.ts";
import type { WorkspaceDoc } from "../src/workspace.ts";
const doc = JSON.parse(
  readFileSync(new URL("../public/workspace.json", import.meta.url), "utf8"),
) as WorkspaceDoc;
const run = doc.runs.find((r) => r.artifacts.length)!;
const route: Route = {
  project: run.project_id!,
  workspace: "all",
  view: "Results",
  run: run.id,
  artifact: run.artifacts[0].id,
};
assert.deepEqual(
  readRoute(routeHash(route), doc),
  route,
  "known canonical references roundtrip",
);
const foreign = doc.projects.find((p) => p.id !== run.project_id)!;
const isolated = readRoute(routeHash({ ...route, project: foreign.id }), doc);
assert.equal(isolated.run, undefined, "URL cannot retain foreign run");
assert.equal(
  isolated.artifact,
  undefined,
  "URL cannot retain foreign artifact",
);
assert.equal(readRoute("#view=Unknown&project=missing", doc).view, "Overview");
let tabs: Route[] = [];
for (const view of [
  "Overview",
  "Projects",
  "Results",
  "Activity",
  "Evidence",
  "Knowledge",
  "Sources",
] as const)
  tabs = addTab(tabs, { project: route.project, workspace: "all", view });
assert.equal(tabs.length, 5, "at most five tabs");
assert.deepEqual(addTab(tabs, tabs[0]), tabs, "tab deduplication");
assert.notEqual(
  tabKey(route),
  tabKey({ ...route, workspace: "other" }),
  "workspace participates in stable tab ID",
);
assert.notEqual(scopeKey(route), scopeKey({ ...route, project: foreign.id }));
assert.equal(
  addTab(tabs, { ...route, project: foreign.id }).length,
  1,
  "foreign scope never retained in active tabs",
);
console.log("Shell routing: 9 acceptance checks passed.");
