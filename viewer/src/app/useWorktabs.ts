import { useEffect, useRef, useState } from "react";
import type { Artifact, Run, WorkspaceDoc } from "../workspace.ts";
import {
  addTab,
  readRoute,
  routeHash,
  scopeKey,
  tabKey,
  type Route,
  type ShellView,
} from "./tabs.ts";
export function useWorktabs(doc: WorkspaceDoc) {
  const [route, setRoute] = useState(() =>
    readRoute(window.location.hash, doc),
  );
  const [groups, setGroups] = useState<Record<string, Route[]>>(() => ({
    [scopeKey(route)]: [route],
  }));
  const positions = useRef(new Map<string, number>());
  const current = useRef(route);
  function go(next: Route, history = true) {
    positions.current.set(tabKey(current.current), window.scrollY);
    current.current = next;
    setRoute(next);
    setGroups((g) => ({
      ...g,
      [scopeKey(next)]: addTab(g[scopeKey(next)] ?? [], next),
    }));
    if (history && window.location.hash !== routeHash(next))
      window.history.pushState(null, "", routeHash(next));
  }
  useEffect(() => {
    const pop = () => go(readRoute(window.location.hash, doc), false);
    window.addEventListener("popstate", pop);
    window.addEventListener("hashchange", pop);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("hashchange", pop);
    };
  }, [doc]);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      window.scrollTo(0, positions.current.get(tabKey(route)) ?? 0),
    );
    return () => cancelAnimationFrame(frame);
  }, [route]);
  const tabs = groups[scopeKey(route)] ?? [route];
  const run = doc.runs.find(
    (r) =>
      r.id === route.run &&
      r.project_id === route.project &&
      (route.workspace === "all" || r.workspace_id === route.workspace),
  );
  const detail = run
    ? { run, artifact: run.artifacts.find((a) => a.id === route.artifact) }
    : null;
  return {
    route,
    tabs,
    detail,
    project: route.project,
    workspace: route.workspace,
    view: route.view,
    setView: (view: ShellView) =>
      go({ ...current.current, view, run: undefined, artifact: undefined }),
    setProject: (project: string) =>
      go({ project, workspace: "all", view: "Overview" }),
    setWorkspace: (workspace: string) =>
      go({
        ...current.current,
        workspace,
        run: undefined,
        artifact: undefined,
      }),
    setDetail: (detail: { run: Run; artifact?: Artifact } | null) =>
      go({
        ...current.current,
        run: detail?.run.id,
        artifact: detail?.artifact?.id,
      }),
    selectTab: (tab: Route) => go(tab),
    closeTab: (tab: Route) => {
      const remaining = tabs.filter((t) => tabKey(t) !== tabKey(tab));
      if (!remaining.length)
        remaining.push({
          ...route,
          view: "Overview",
          run: undefined,
          artifact: undefined,
        });
      const next = tabKey(tab) === tabKey(route) ? remaining.at(-1)! : route;
      setGroups((g) => ({ ...g, [scopeKey(route)]: remaining }));
      if (next !== route) {
        current.current = next;
        setRoute(next);
        window.history.pushState(null, "", routeHash(next));
      }
      requestAnimationFrame(() =>
        document
          .getElementById("tab-" + encodeURIComponent(tabKey(next)))
          ?.focus(),
      );
    },
  };
}
