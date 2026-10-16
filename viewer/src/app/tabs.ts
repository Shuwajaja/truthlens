import type { WorkspaceDoc, View } from "../workspace.ts";
import { views } from "../workspace.ts";
export type ShellView = View | "Projects" | "Renderers";
export const viewLabel = (view: ShellView) =>
  (
    ({
      Overview: "Home",
      Activity: "History",
      Evidence: "Checks",
      Sources: "Connections",
      Knowledge: "Notes",
      Renderers: "Supported formats",
    }) as Partial<Record<ShellView, string>>
  )[view] ?? view;

export type Route = {
  project: string;
  workspace: string;
  view: ShellView;
  run?: string;
  artifact?: string;
};
export const shellViews: readonly ShellView[] = [
  ...views,
  "Projects",
  "Renderers",
];
export const scopeKey = (r: Route) => JSON.stringify([r.project, r.workspace]);
export const tabKey = (r: Route) =>
  JSON.stringify([
    r.project,
    r.workspace,
    r.view,
    r.run ?? "",
    r.artifact ?? "",
  ]);
export function routeHash(r: Route): string {
  return (
    "#" +
    new URLSearchParams({
      project: r.project,
      workspace: r.workspace,
      view: r.view,
      ...(r.run ? { run: r.run } : {}),
      ...(r.artifact ? { artifact: r.artifact } : {}),
    })
  );
}
export function readRoute(hash: string, doc: WorkspaceDoc): Route {
  const params = new URLSearchParams(hash.slice(1));
  const project =
    doc.projects.find((p) => p.id === params.get("project"))?.id ??
    doc.projects[0]?.id ??
    "";
  const workspace =
    doc.workspaces.find(
      (w) => w.id === params.get("workspace") && w.project_id === project,
    )?.id ?? "all";
  const view =
    shellViews.find(
      (v) =>
        v.toLowerCase() === (params.get("view") ?? hash.slice(1)).toLowerCase(),
    ) ?? "Overview";
  const run = doc.runs.find(
    (r) =>
      r.id === params.get("run") &&
      r.project_id === project &&
      (workspace === "all" || r.workspace_id === workspace),
  );
  const artifact = run?.artifacts.find((a) => a.id === params.get("artifact"));
  return {
    project,
    workspace,
    view,
    ...(run ? { run: run.id } : {}),
    ...(artifact ? { artifact: artifact.id } : {}),
  };
}
export function addTab(tabs: Route[], route: Route): Route[] {
  if (tabs.some((t) => tabKey(t) === tabKey(route))) return tabs;
  return [
    ...tabs.filter((t) => scopeKey(t) === scopeKey(route)).slice(-4),
    route,
  ];
}
