import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@modelcontextprotocol/ext-apps";
import { isRecord } from "../workspace.ts";
import { ArtifactRenderer } from "../Renderer.tsx";
import { parseWidgetResult, type WidgetSnapshot } from "./data.ts";
import "./widget.css";

export function Widget() {
  const app = useRef<App | null>(null);
  const revision = useRef(0);
  const [snapshot, setSnapshot] = useState<WidgetSnapshot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState("Evidence");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  function receive(result: unknown) {
    revision.current++;
    setBusy(false);
    try {
      const next = parseWidgetResult(result);
      setSnapshot(next);
      setSelected(next.selectedRunId ?? next.document.runs[0]?.id ?? null);
      setTab("Evidence");
      setError("");
    } catch (e) {
      setSnapshot(null);
      setSelected(null);
      setError(e instanceof Error ? e.message : "Invalid result.");
    }
  }
  useEffect(() => {
    const bridge = new App(
      { name: "TruthLens evidence", version: "1.0.0" },
      {},
    );
    app.current = bridge;
    const context = () => {
      const ctx = bridge.getHostContext();
      if (ctx?.theme) document.documentElement.dataset.theme = ctx.theme;
      setCanExpand(Boolean(ctx?.availableDisplayModes?.includes("fullscreen")));
      setExpanded(ctx?.displayMode === "fullscreen");
    };
    bridge.ontoolresult = receive;
    bridge.ontoolcancelled = () => {
      setBusy(false);
      setError("The host cancelled the request. Refresh to retry.");
    };
    bridge.onhostcontextchanged = context;
    const timeout = window.setTimeout(
      () =>
        setError(
          "No MCP host connected. Open this widget through the local MCP preview or a compatible host.",
        ),
      10000,
    );
    void bridge
      .connect(undefined, { timeout: 10000 })
      .then(() => {
        clearTimeout(timeout);
        setConnected(true);
        setCanRefresh(Boolean(bridge.getHostCapabilities()?.serverTools));
        context();
      })
      .catch(() => {
        clearTimeout(timeout);
        setError(
          "Unable to connect to the MCP host. Reopen the widget to retry.",
        );
      });
    const timer = window.setInterval(() => setClock(Date.now()), 60000);
    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
      void bridge.close();
    };
  }, []);
  async function refresh() {
    if (!snapshot || !app.current || busy) return;
    const current = ++revision.current;
    setBusy(true);
    setError("");
    try {
      const result = await app.current.callServerTool(
        {
          name: "truthlens_render_workspace_v1",
          arguments: {
            project_id: snapshot.projectId,
            run_ids: snapshot.document.runs.map((r) => r.id),
          },
        },
        { timeout: 30000 },
      );
      if (current === revision.current) receive(result);
    } catch {
      if (current === revision.current) {
        setBusy(false);
        setError(
          "Refresh failed. The previous snapshot remains visible; it may be out of date.",
        );
      }
    }
  }
  const run = snapshot?.document.runs.find((r) => r.id === selected);
  const stale =
    snapshot && clock - Date.parse(snapshot.generatedAt) > 15 * 60000;
  return (
    <main className="widget">
      <header>
        <div>
          <h1>TruthLens</h1>
          <p>Recorded evidence · read only</p>
        </div>
        <div className="actions">
          {canExpand && (
            <button
              onClick={() => {
                void app.current
                  ?.requestDisplayMode({
                    mode: expanded ? "inline" : "fullscreen",
                  })
                  .then((r) => setExpanded(r.mode === "fullscreen"))
                  .catch(() =>
                    setError("This host could not change the display mode."),
                  );
              }}
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          )}
          {canRefresh && snapshot && (
            <button disabled={busy} onClick={() => void refresh()}>
              {busy ? "Refreshing…" : "Refresh"}
            </button>
          )}
        </div>
      </header>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {!snapshot && !error && (
        <p role="status">
          {connected
            ? "Waiting for recorded workspace data…"
            : "Connecting to MCP host…"}
        </p>
      )}
      {snapshot && (
        <>
          <div className="snapshot">
            <strong>{snapshot.document.projects[0].name}</strong>
            <span>{snapshot.document.runs.length} recorded runs</span>
          </div>
          {stale && (
            <p className="notice" role="status">
              This snapshot is over 15 minutes old. Refresh to check for a newer
              catalog snapshot.
            </p>
          )}
          {!snapshot.document.runs.length && (
            <p>
              No runs in this snapshot. Ask TruthLens to find runs in this
              project.
            </p>
          )}
          {run && (
            <div className="layout">
              <nav aria-label="Recorded runs">
                {snapshot.document.runs.map((r) => (
                  <button
                    key={r.id}
                    aria-pressed={r.id === selected}
                    onClick={() => {
                      setSelected(r.id);
                      setTab("Evidence");
                    }}
                  >
                    <strong>{r.title}</strong>
                    <span>
                      {r.origin === "IMPORTED"
                        ? "Imported · reported only"
                        : "Native record"}{" "}
                      · {r.verification}
                    </span>
                  </button>
                ))}
              </nav>
              <article>
                <h2>{run.title}</h2>
                <p className="muted">
                  {run.origin === "IMPORTED"
                    ? "Imported report. Reported outcomes are not verified evidence."
                    : "Recorded checks and claims remain distinct from human acceptance."}
                </p>
                <dl className="trust">
                  {[
                    ["Origin", run.origin],
                    ["Integrity", run.integrity],
                    ["Checks", run.verification],
                    ["Review", run.review],
                    ["Acceptance", run.acceptance],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                {run.integrity === "failed" ? (
                  <p role="alert" className="notice">
                    Integrity failed. Evidence and artifact contents are
                    isolated and cannot be displayed.
                  </p>
                ) : (
                  <>
                    <div className="tabs" role="group" aria-label="Run details">
                      {["Evidence", "Artifacts", "Provenance"].map((t) => (
                        <button
                          key={t}
                          aria-pressed={tab === t}
                          onClick={() => setTab(t)}
                        >
                          {t}
                          {t === "Artifacts"
                            ? ` (${run.artifacts.length})`
                            : ""}
                        </button>
                      ))}
                    </div>
                    {tab === "Evidence" && (
                      <section aria-label="Evidence">
                        <h3>Recorded checks</h3>
                        {!run.criteria.length && (
                          <p>
                            No recorded criteria. No check outcome can be
                            inferred.
                          </p>
                        )}
                        <ul className="criteria">
                          {run.criteria.map((c, i) => (
                            <li key={i} data-status={c.status}>
                              <strong>{String(c.title ?? c.text)}</strong>
                              <span>{String(c.status)}</span>
                              {Array.isArray(c.evidence) &&
                                c.evidence.length > 0 && (
                                  <details>
                                    <summary>
                                      Recorded evidence ({c.evidence.length})
                                    </summary>
                                    {c.evidence.slice(0, 50).map((id, i) => {
                                      const event = run.events.find(
                                        (e) => e.id === id,
                                      );
                                      return (
                                        <div key={i}>
                                          <code>{String(id)}</code>
                                          {event ? (
                                            <pre>
                                              {JSON.stringify(event, null, 2)}
                                            </pre>
                                          ) : (
                                            <p>
                                              Referenced event is unavailable in
                                              this snapshot.
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </details>
                                )}
                            </li>
                          ))}
                        </ul>
                        {run.reported_summary && (
                          <>
                            <h3>Source-reported summary</h3>
                            <p>{run.reported_summary}</p>
                          </>
                        )}
                        <h3>Agent claims</h3>
                        {run.claims.length ? (
                          run.claims.map((c, i) => (
                            <blockquote key={i}>
                              {String((c as { text: string }).text)}
                              <p className="muted">
                                Finding:{" "}
                                {isRecord(c) && typeof c.finding === "string"
                                  ? c.finding
                                  : "Not recorded"}
                              </p>
                            </blockquote>
                          ))
                        ) : (
                          <p>No agent claim recorded.</p>
                        )}
                        <p className="muted">
                          Integrity checks detect record changes. They do not
                          prove that every claim is true or that a person
                          accepted the result.
                        </p>
                      </section>
                    )}
                    {tab === "Artifacts" && (
                      <section aria-label="Artifacts">
                        {!run.artifacts.length && <p>No artifacts recorded.</p>}
                        {run.artifacts.map((a) => (
                          <details key={a.id}>
                            <summary>
                              {a.path} <span className="muted">{a.kind}</span>
                            </summary>
                            <div className="artifact">
                              {a.kind.toLowerCase() === "html" ? (
                                <>
                                  <p>
                                    HTML source · nested previews are
                                    unavailable in this host.
                                  </p>
                                  <pre>
                                    {typeof a.content === "string"
                                      ? a.content
                                      : JSON.stringify(a.content, null, 2)}
                                  </pre>
                                </>
                              ) : (
                                <ArtifactRenderer artifact={a} />
                              )}
                            </div>
                          </details>
                        ))}
                      </section>
                    )}
                    {tab === "Provenance" && (
                      <section>
                        <h3>Source and snapshot</h3>
                        <dl className="provenance">
                          <dt>Source</dt>
                          <dd>
                            {String(
                              snapshot.document.sources.find(
                                (s) => s.id === run.source_id,
                              )?.name ?? run.source_id,
                            )}
                          </dd>
                          <dt>Recorded start</dt>
                          <dd>{run.started ?? "Not recorded"}</dd>
                          <dt>Catalog snapshot</dt>
                          <dd>{snapshot.generatedAt}</dd>
                          <dt>Snapshot ID</dt>
                          <dd>
                            <code>{snapshot.snapshotId}</code>
                          </dd>
                          <dt>Run ID</dt>
                          <dd>
                            <code>{run.id}</code>
                          </dd>
                          <dt>Assignment</dt>
                          <dd>{run.mapping_reason ?? "Not recorded"}</dd>
                        </dl>
                        <p className="muted">
                          Displayed from the server snapshot. Model prose cannot
                          set these trust labels.
                        </p>
                      </section>
                    )}
                  </>
                )}
              </article>
            </div>
          )}
          <footer>
            Snapshot recorded{" "}
            <time dateTime={snapshot.generatedAt}>{snapshot.generatedAt}</time>{" "}
            · Human acceptance: {run?.acceptance ?? "UNKNOWN"}
          </footer>
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Widget />);
