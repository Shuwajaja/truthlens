import { useEffect, useRef, useState } from "react";
import type { WorkspaceDoc } from "../workspace.ts";
import { Brand } from "./Brand.tsx";
import { Icon } from "./Icon.tsx";
import { tabKey, viewLabel, type Route, type ShellView } from "./tabs.ts";
const primary: ShellView[] = ["Overview", "Results", "Evidence", "Sources"];
const secondary: ShellView[] = ["Knowledge", "Renderers", "Appearance"];

type Props = {
  doc: WorkspaceDoc;
  project: string;
  workspace: string;
  view: ShellView;
  onView: (v: ShellView) => void;
  onProject: (v: string) => void;
  onWorkspace: (v: string) => void;
};
function ProjectTree({
  doc,
  project,
  workspace,
  onProject,
  onWorkspace,
}: Props) {
  return (
    <>
      <label>
        Project
        <select
          aria-label="Project"
          value={project}
          onChange={(e) => onProject(e.target.value)}
        >
          {doc.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="tl-project-tree">
        <strong>Workspaces</strong>
        <button
          aria-current={workspace === "all" ? "true" : undefined}
          onClick={() => onWorkspace("all")}
        >
          All workspaces
        </button>
        {doc.workspaces
          .filter((w) => w.project_id === project)
          .map((w) => (
            <button
              key={w.id}
              aria-current={workspace === w.id ? "true" : undefined}
              onClick={() => onWorkspace(w.id)}
            >
              <Icon name="Projects" />
              {w.name}
            </button>
          ))}
      </div>
      <p className="tl-bottom">
        Your original files stay unchanged
        <br />
        Browse saved work and its sources.
      </p>
    </>
  );
}
export function ShellNavigation(props: Props) {
  const [mobile, setMobile] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!mobile) return;
    const trigger = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => {
      requestAnimationFrame(() => {
        if (trigger.isConnected) trigger.focus();
      });
    };
  }, [mobile]);
  const nav = (v: ShellView) => {
    props.onView(v);
    setMobile(false);
    if (menu.current) menu.current.open = false;
  };
  return (
    <>
      <nav className="tl-iconrail" aria-label="Primary navigation">
        <Brand />
        <button
          className="tl-project-switch"
          aria-label="Choose project and workspace"
          onClick={() => setMobile(true)}
        >
          <Icon name="Projects" />
          <span>
            {props.doc.projects.find((p) => p.id === props.project)?.name ??
              "Choose project"}
          </span>
        </button>
        {primary.map((v) => (
          <button
            key={v}
            data-testid={`nav-${v.toLowerCase()}`}
            title={viewLabel(v)}
            aria-label={viewLabel(v)}
            aria-current={props.view === v ? "page" : undefined}
            onClick={() => nav(v)}
          >
            <Icon name={v} />
            <span>{viewLabel(v)}</span>
          </button>
        ))}
        <details
          ref={menu}
          className="tl-secondary-menu"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.currentTarget.open = false;
              e.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary aria-label="More views" title="More views">
            <Icon name="More" />
            <span>More</span>
          </summary>
          <div>
            <button
              className="tl-mobile-nav"
              aria-label="Choose project and workspace"
              onClick={() => {
                if (menu.current) {
                  menu.current.open = false;
                  menu.current.querySelector("summary")?.focus();
                }
                setMobile(true);
              }}
            >
              <Icon name="Projects" />
              Choose project
            </button>
            {(["Projects", "Activity", ...secondary] as ShellView[]).map(
              (v) => (
                <button
                  key={v}
                  data-testid={`nav-${v.toLowerCase()}`}
                  onClick={() => nav(v)}
                  aria-current={props.view === v ? "page" : undefined}
                >
                  <Icon name={v} />
                  {viewLabel(v)}
                </button>
              ),
            )}
          </div>
        </details>
      </nav>
      {mobile && (
        <dialog
          ref={dialog}
          className="tl-project-dialog"
          aria-label="Project and workspace"
          onCancel={() => setMobile(false)}
          onClose={() => setMobile(false)}
        >
          <button onClick={() => setMobile(false)}>Close · Esc</button>
          <ProjectTree
            {...props}
            onProject={(p) => {
              props.onProject(p);
              setMobile(false);
            }}
            onWorkspace={(w) => {
              props.onWorkspace(w);
              setMobile(false);
            }}
          />
        </dialog>
      )}
    </>
  );
}
export function Worktabs({
  tabs,
  route,
  doc,
  onSelect,
  onClose,
}: {
  tabs: Route[];
  route: Route;
  doc: WorkspaceDoc;
  onSelect: (r: Route) => void;
  onClose: (r: Route) => void;
}) {
  return (
    <div className="tl-worktabs-shell">
      <div
        className="tl-worktabs"
        role="tablist"
        aria-label="Open views"
        onKeyDown={(e) => {
          if (e.key === "Delete") {
            e.preventDefault();
            onClose(route);
            return;
          }
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            return;
          const index = tabs.findIndex((t) => tabKey(t) === tabKey(route));
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? tabs.length - 1
                : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                  tabs.length;
          e.preventDefault();
          onSelect(tabs[next]);
          requestAnimationFrame(() =>
            document
              .getElementById("tab-" + encodeURIComponent(tabKey(tabs[next])))
              ?.focus(),
          );
        }}
      >
        {tabs.map((tab) => {
          const run = doc.runs.find((r) => r.id === tab.run);
          const title =
            run?.artifacts
              .find((a) => a.id === tab.artifact)
              ?.path.split("/")
              .at(-1) ??
            run?.title ??
            viewLabel(tab.view);
          const selected = tabKey(tab) === tabKey(route);
          return (
            <div className="tl-worktab" role="presentation" key={tabKey(tab)}>
              <button
                id={"tab-" + encodeURIComponent(tabKey(tab))}
                role="tab"
                aria-selected={selected}
                aria-controls="tl-content"
                tabIndex={selected ? 0 : -1}
                title={title}
                onClick={() => onSelect(tab)}
              >
                {title}
              </button>
            </div>
          );
        })}
      </div>
      <button
        className="tl-close-active"
        aria-label="Close current view"
        title="Close current view (Delete)"
        onClick={() => onClose(route)}
      >
        <Icon name="Close" />
      </button>
    </div>
  );
}
