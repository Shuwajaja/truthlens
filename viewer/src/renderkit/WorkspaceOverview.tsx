import {
  ArrowUpRight,
  CircleAlert,
  FileText,
  Layers,
  Plug,
  ArrowRight,
} from "lucide-react";
import type { Artifact, Run, WorkspaceDoc } from "../workspace.ts";
import { stamp } from "../app/format.ts";
import "./workspace-overview.css";

export type WorkspaceOverviewProps = {
  doc: WorkspaceDoc;
  projectId: string;
  workspaceId?: string;
  onRun?: (run: Run) => void;
  onArtifact?: (run: Run, artifact: Artifact) => void;
  onConnect?: () => void;
  onResults?: () => void;
};
const key = (run: Run) =>
  JSON.stringify([run.project_id, run.workspace_id, run.id]);
const date = (run: Run) => Date.parse(run.started ?? "") || 0;
export function WorkspaceOverview({
  doc,
  projectId,
  workspaceId,
  onRun,
  onArtifact,
  onConnect,
  onResults,
}: WorkspaceOverviewProps) {
  const runs = doc.runs.filter(
    (run) =>
      run.project_id === projectId &&
      (!workspaceId ||
        workspaceId === "all" ||
        run.workspace_id === workspaceId),
  );
  const safe = runs.filter((run) => run.integrity !== "failed");
  const isolated = runs.length - safe.length;
  const criteria = safe.flatMap((run) => run.criteria);
  const passed = criteria.filter((item) => item.status === "met").length;
  const failed = criteria.filter((item) => item.status === "unmet").length;
  const unchecked = criteria.length - passed - failed;
  const results = safe.reduce((total, run) => total + run.artifacts.length, 0);
  const attention = [...runs]
    .sort((a, b) => date(b) - date(a))
    .filter(
      (run) =>
        run.integrity === "failed" ||
        run.verification === "FAILED" ||
        run.criteria.some((item) => item.status === "unmet"),
    );
  const latest = [...runs].sort((a, b) => date(b) - date(a)).slice(0, 4);
  const sourceIds = new Set(runs.map((run) => run.source_id));
  const sources = doc.sources.filter((source) =>
    sourceIds.has(String(source.id)),
  );
  const title =
    doc.workspaces.find(
      (w) => w.id === workspaceId && w.project_id === projectId,
    )?.name ??
    doc.projects.find((p) => p.id === projectId)?.name ??
    "All projects";
  const priority = attention[0];
  return (
    <section className="wo" aria-label="Workspace summary">
      <header className="wo-heading">
        <div>
          <p className="wo-eyebrow">{title}</p>
          <h2>Your work at a glance.</h2>
          <p>What was created, what was checked, and what needs you.</p>
        </div>
        {onConnect && (
          <button onClick={onConnect}>
            <Plug size={16} aria-hidden="true" /> Add work
          </button>
        )}
      </header>
      <dl className="wo-totals" aria-label="Totals in this snapshot">
        <div>
          <dt>Recorded work</dt>
          <dd>{runs.length}</dd>
        </div>
        <div>
          <dt>Results</dt>
          <dd>{results}</dd>
        </div>
        <div>
          <dt>Needs attention</dt>
          <dd>{attention.length}</dd>
        </div>
      </dl>
      <p className="wo-snapshot">
        In this snapshot · Updated {stamp(doc.generated_at)}
        {isolated > 0 &&
          ` · ${isolated} damaged ${isolated === 1 ? "record excluded" : "records excluded"} from result and check totals`}
      </p>
      {priority && (
        <section
          className="wo-attention tl-review-focus"
          aria-label="Needs your attention"
        >
          <CircleAlert size={23} aria-hidden="true" />
          <div>
            <h3>
              {priority.integrity === "failed"
                ? "One record needs inspection."
                : "Start with the open points."}
            </h3>
            <p>
              {priority.integrity === "failed"
                ? "Content is withheld because its integrity check failed."
                : `${attention.length} ${attention.length === 1 ? "piece of work needs" : "pieces of work need"} a closer look.`}
            </p>
            <strong>{priority.title}</strong>
          </div>
          {onRun && (
            <button
              data-testid="review-open-points"
              onClick={() => onRun(priority)}
            >
              {priority.integrity === "failed"
                ? "Inspect record"
                : "Review open points"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          )}
        </section>
      )}
      {!runs.length ? (
        <div className="wo-empty">
          <Layers size={30} aria-hidden="true" />
          <h3>Your workspace starts with your work.</h3>
          <p>
            Add a report or connect your tools to bring results and checks into
            one place.
          </p>
          {onConnect && (
            <button onClick={onConnect}>
              Add your first work <ArrowRight size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <div className="wo-columns">
          <section className="wo-recent">
            <header>
              <h3>Latest work</h3>
              {onResults && (
                <button onClick={onResults}>
                  All results <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </header>
            <ul>
              {latest.map((run) => {
                const isolated = run.integrity === "failed";
                const artifact = isolated ? undefined : run.artifacts[0];
                const failing = run.criteria.filter(
                  (item) => item.status === "unmet",
                ).length;
                const status = isolated
                  ? "Content withheld"
                  : failing
                    ? `${failing} ${failing === 1 ? "check failed" : "checks failed"}`
                    : run.verification === "FAILED"
                      ? "Verification failed"
                      : run.criteria.length === 0
                        ? "No checks recorded"
                        : run.criteria.some((item) => item.status !== "met")
                          ? "Checks still open"
                          : "Recorded checks passed";
                return (
                  <li key={key(run)}>
                    <span className="wo-work-icon">
                      <FileText size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <h4>{run.title}</h4>
                      <p>{status}</p>
                      <small>{stamp(run.started)}</small>
                    </div>
                    {artifact && onArtifact ? (
                      <button
                        aria-label={`Open result: ${run.title}`}
                        onClick={() => onArtifact(run, artifact)}
                      >
                        Open <ArrowUpRight size={16} aria-hidden="true" />
                      </button>
                    ) : (
                      onRun && (
                        <button
                          aria-label={`Review: ${run.title}`}
                          data-testid={
                            !priority && run === latest[0]
                              ? "review-open-points"
                              : undefined
                          }
                          onClick={() => onRun(run)}
                        >
                          Review <ArrowUpRight size={16} aria-hidden="true" />
                        </button>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          <aside className="wo-checks">
            <h3>Checks, explained</h3>
            <dl>
              <div>
                <dt>
                  <span className="wo-dot passed" />
                  Passed
                </dt>
                <dd>{passed}</dd>
              </div>
              <div>
                <dt>
                  <span className="wo-dot failed" />
                  Failed
                </dt>
                <dd>{failed}</dd>
              </div>
              <div>
                <dt>
                  <span className="wo-dot" />
                  Not confirmed
                </dt>
                <dd>{unchecked}</dd>
              </div>
            </dl>
            <p>
              {safe.filter((run) => !run.criteria.length).length} pieces of work
              have no individual checks recorded.
            </p>
            <p>Recorded checks do not establish human acceptance.</p>
          </aside>
        </div>
      )}
      <footer className="wo-sources">
        <div>
          <h3>Where this work comes from</h3>
          {sources.length ? <ul className="wo-source-list">
            {sources.slice(0, 6).map((source) => <li key={String(source.id)}>
              <strong>{String(source.name)}</strong>
              <span>{Array.isArray(source.errors) && source.errors.length ? "Source unavailable" : "Recorded snapshot"}</span>
            </li>)}
            {sources.length > 6 && <li>{sources.length - 6} more recorded sources</li>}
          </ul> : <p>No recorded source in this view.</p>}
          <small>
            Sources describe this snapshot. They do not indicate a live
            connection.
          </small>
        </div>
        {onConnect && (
          <button onClick={onConnect}>
            Manage connections <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        )}
      </footer>
    </section>
  );
}
