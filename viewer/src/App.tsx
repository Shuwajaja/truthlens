import { useEffect, useRef, useState } from "react";
import { CodexNavigator } from "./CodexNavigator.tsx";
import LegacyApp from "./LegacyApp.tsx";
import { RecordedGraph } from "./RecordedGraph.tsx";
import { ArtifactRenderer } from "./Renderer.tsx";
import {
  defaultProfile,
  isRecord,
  readProfile,
  validateProfile,
  validateWorkspace,
  validAction,
  views,
  type Action,
  type Artifact,
  type Profile,
  type Run,
  type View,
  type WorkspaceDoc,
} from "./workspace.ts";
import { rendererOptions, type RendererId } from "./registry.ts";
import "./workspace.css";
const json = (v: unknown) =>
  typeof v === "string" ? v : JSON.stringify(v, null, 2);
const stamp = (v: unknown) =>
  typeof v === "string" && !Number.isNaN(Date.parse(v))
    ? new Date(v).toISOString().replace("T", " ").replace("Z", " UTC")
    : "Not recorded";
function Badges({ run: r }: { run: Run }) {
  return (
    <div
      className="tl-badges"
      title="Values reported by the local exporter; this browser does not verify ledger signatures."
    >
      {[
        ["Origin", r.origin],
        ["Integrity", r.integrity],
        ["Check", r.verification],
        ["Review", r.review],
        ["Acceptance", r.acceptance],
      ].map(([k, v]) => (
        <span key={k}>
          {k}: {v}
        </span>
      ))}
    </div>
  );
}
function Detail({
  run,
  artifact,
  developer,
  onClose,
  initialRenderer,
  canSelect,
}: {
  run: Run;
  artifact?: Artifact;
  developer: boolean;
  onClose: () => void;
  initialRenderer?: string;
  canSelect: (id: RendererId) => boolean;
}) {
  const [renderer, setRenderer] = useState<RendererId | undefined>(
    initialRenderer === "text"
      ? "plain"
      : (initialRenderer as RendererId | undefined),
  );
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    ref.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button,a,input,select,textarea,[tabindex="0"]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      trigger?.focus();
    };
  }, []);
  return (
    <div className="tl-overlay">
      <div
        ref={ref}
        tabIndex={-1}
        className="tl-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Recorded detail"
      >
        <button onClick={onClose}>Close · Esc</button>
        <h2>{artifact ? artifact.path : run.title}</h2>
        <Badges run={run} />
        {run.integrity === "hash-only" && <p>Hash-chain consistency was checked at export. Signature authenticity has not been established.</p>}
        {run.integrity === "hmac" && <p>Signature checked at export. This does not prove factual correctness or human acceptance.</p>}
        {run.integrity === "failed" && (
          <p role="alert" className="tl-error">
            Integrity failed. Isolated diagnostic view: these contents are not
            verified evidence.
          </p>
        )}
        {run.verification === "FAILED" && run.integrity !== "failed" && (
          <p role="alert" className="tl-error">
            Recorded checks failed. Integrity is a separate dimension; recorded
            artifacts remain inspectable.
          </p>
        )}
        {run.origin === "IMPORTED" && (
          <p>
            Imported source report. This is not native TruthLens witness
            evidence.
          </p>
        )}
        {run.integrity === "failed" ? (
          <div>
            <p>Run content is isolated because integrity failed.</p>
            <h3>Diagnostics</h3>
            <pre>{json(run.errors)}</pre>
          </div>
        ) : artifact ? (
          <>
            <label>
              Renderer
              <select
                aria-label="Renderer"
                value={renderer ?? rendererOptions(artifact)[0]}
                onChange={(e) => {
                  const id = e.target.value as RendererId;
                  if (rendererOptions(artifact).includes(id) && canSelect(id))
                    setRenderer(id);
                }}
              >
                {rendererOptions(artifact).map((id) => (
                  <option key={id}>{id}</option>
                ))}
              </select>
            </label>
            <ArtifactRenderer
              artifact={renderer ? { ...artifact, kind: renderer } : artifact}
            />
          </>
        ) : (
          <>
            <p>Recorded {stamp(run.started)}</p>
            <p>Assignment: {run.mapping_reason ?? "No assignment reason recorded."}</p>
            {run.origin === "IMPORTED" && <section>
              <h3>What the source reported</h3>
              <p>Reported status: {run.reported_status || "Not recorded"}</p>
              <p>{run.reported_summary || "No source summary recorded."}</p>
              <p>These are imported statements, not a TruthLens approval.</p>
            </section>}
            <h3>Criteria</h3>
            {!run.criteria.length && <p>No criteria recorded.</p>}
            {run.criteria.map((c, i) => (
              <article
                className={`tl-criterion tl-${String(c.status)}`}
                key={i}
              >
                <h3>{String(c.title ?? c.text ?? c.id ?? "Criterion")}</h3>
                <p>Status: {String(c.status ?? "unverified")}</p>
                {developer && <pre>{json(c)}</pre>}
              </article>
            ))}
            <h3>Recorded claims</h3>
            {!run.claims.length && <p>No claims recorded.</p>}
            <ul>{run.claims.map((claim, index) => <li key={index}>{isRecord(claim)
              ? `${String(claim.text ?? "Recorded claim")} — ${String(claim.finding ?? "unverified")}`
              : "Unrecognized source claim."}</li>)}</ul>
            <h3>Diagnostics</h3>
            <pre>{json(run.errors)}</pre>
          </>
        )}
        {developer && (
          <details>
            <summary>Developer record</summary>
            <pre>
              {json(
                run.integrity === "failed"
                  ? { id: run.id, errors: run.errors, integrity: run.integrity }
                  : (artifact ?? run),
              )}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: { transcript: string }[][] }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
function Workspace({
  doc: d,
  onImport,
}: {
  doc: WorkspaceDoc;
  onImport: (d: WorkspaceDoc) => void;
}) {
  const [project, setProject] = useState(d.projects[0]?.id ?? "");
  const [workspace, setWorkspace] = useState("all");
  const [view, setView] = useState<View>(
    () =>
      views.find((v) => v.toLowerCase() === window.location.hash.slice(1)) ??
      "Overview",
  );
  const [query, setQuery] = useState("");
  const [navigatorMode, setNavigatorMode] = useState<"local" | "codex">(
    "local",
  );
  const [developer, setDeveloper] = useState(false);
  const [profile, setProfile] = useState<Profile>(readProfile);
  const [detail, setDetail] = useState<{
    run: Run;
    artifact?: Artifact;
  } | null>(null);
  const [voice, setVoice] = useState("Idle");
  const [speak, setSpeak] = useState(false);
  const [notice, setNotice] = useState("");
  const recognition = useRef<Recognition | null>(null);
  useEffect(
    () => () => {
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  useEffect(() => {
    const onPop = () => {
      setDetail(null);
      setView(
        views.find((v) => v.toLowerCase() === window.location.hash.slice(1)) ??
          "Overview",
      );
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const hash = "#" + view.toLowerCase();
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  }, [view]);
  useEffect(() => {
    try {
      localStorage.setItem("truthlens.profile", JSON.stringify(profile));
    } catch {
      /* optional preference */
    }
  }, [profile]);
  const [originFilter, setOriginFilter] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("");
  const collection = profile.collection;
  const paneOrder = profile.pane_order;
  const [selectedRenderer, setSelectedRenderer] = useState<
    string | undefined
  >();
  const [focusedEvidence, setFocusedEvidence] = useState("");
  const runs = d.runs.filter(
    (r) =>
      r.project_id === project &&
      (workspace === "all" || r.workspace_id === workspace),
  );
  const filtered = runs
    .filter(
      (r) =>
        (typeof (r as unknown as Record<string, unknown>).search_text ===
        "string"
          ? String((r as unknown as Record<string, unknown>).search_text)
          : [
              r.title,
              r.agent,
              (r as unknown as Record<string,unknown>).reported_summary,
              ...r.events.map((e) => e.summary),
              ...r.artifacts.flatMap((a) => [
                a.path,
                typeof a.content === "string" ? a.content : "",
              ]),
            ]
              .filter((x) => typeof x === "string")
              .join(" ")
        )
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!originFilter || r.origin === originFilter) &&
        (!verificationFilter || r.verification === verificationFilter),
    )
    .slice(0, 100);
  const artifacts = filtered
    .filter((r) => r.integrity !== "failed")
    .flatMap((run) => run.artifacts.map((artifact) => ({ run, artifact })))
    .slice(0, 200);
  const memory = d.memory
    .filter(
      (m) =>
        m.project_id === project &&
        (typeof m.search_text === "string"
          ? m.search_text
          : [m.text, m.source_ref].join(" ")
        )
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .slice(0, 100);

  const act = (a: Action) => {
    if (!validAction(a, d, project)) {
      setNotice(
        "Action rejected: invalid target, failed integrity, capability or project scope.",
      );
      return false;
    }
    if (a.type === "navigate")
      setView(
        a.view === "runs"
          ? "Evidence"
          : ((a.view.charAt(0).toUpperCase() + a.view.slice(1)) as View),
      );
    if (a.type === "set_filters") {
      if (a.filters.query !== undefined) setQuery(a.filters.query);
      if (a.filters.origin !== undefined) setOriginFilter(a.filters.origin);
      if (a.filters.verification !== undefined)
        setVerificationFilter(a.filters.verification);
    }
    if (a.type === "set_layout") {
      if (a.layout.density)
        setProfile((p) => ({ ...p, density: a.layout.density! }));
      if (a.layout.collection)
        setProfile((p) => ({ ...p, collection: a.layout.collection! }));
      if (a.layout.pane_order)
        setProfile((p) => ({ ...p, pane_order: a.layout.pane_order! }));
    }
    if (a.type === "open_run") {
      const run = d.runs.find(
        (r) => r.id === a.run_id && r.project_id === project,
      );
      if (run) {
        setWorkspace("all");
        setDetail({ run });
      } else return false;
    }
    if (a.type === "open_artifact" || a.type === "select_renderer") {
      const run = d.runs.find(
        (r) => r.id === a.run_id && r.project_id === project,
      );
      const artifact = run?.artifacts.find((x) => x.id === a.artifact_id);
      if (run && artifact) {
        setWorkspace("all");
        setSelectedRenderer(a.renderer);
        setDetail({ run, artifact });
      } else return false;
    }
    if (a.type === "focus_evidence") {
      setFocusedEvidence(a.evidence_id);
      setWorkspace("all");
      setView("Activity");
    }
    return true;
  };

  function navigator(text: string) {
    const q = text.trim();
    const target = views.find(
      (x) =>
        x.toLowerCase() === q.toLowerCase().replace(/^(open|show|go to) /, ""),
    );
    if (
      ["errors", "show errors", "nur fehler", "zeige nur die fehler"].includes(
        q.toLowerCase(),
      )
    ) {
      act({
        type: "set_filters",
        project_id: project,
        filters: { query: "", verification: "FAILED" },
      });
      setView("Evidence");
      setNotice("Recorded failed checks. Integrity is a separate dimension.");
    } else if (target) {
      act({
        type: "navigate",
        project_id: project,
        view: target.toLowerCase(),
      });
      setQuery("");
    } else {
      act({
        type: "set_filters",
        project_id: project,
        filters: { query: q.slice(0, 500), verification: "" },
      });
      setNotice("Local search applied. No external model or agent action.");
    }
    if (speak && "speechSynthesis" in window)
      window.speechSynthesis.speak(
        new SpeechSynthesisUtterance(
          target ? `Opened ${target}` : "Local search applied",
        ),
      );
  }
  function startVoice() {
    const browser = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const C = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!C) {
      setVoice("Unsupported — use text Navigator.");
      return;
    }
    recognition.current?.abort();
    const r = new C();
    recognition.current = r;
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      navigator(e.results[0]?.[0]?.transcript ?? "");
      setVoice("Complete — transcript not saved.");
    };
    r.onerror = (e) =>
      setVoice(
        e.error === "not-allowed"
          ? "Microphone denied — use text Navigator."
          : `Voice error: ${e.error}. Use text Navigator.`,
      );
    r.onend = () => setVoice((v) => (v === "Listening" ? "Stopped" : v));
    try {
      r.start();
      setVoice("Listening");
    } catch {
      setVoice("Unavailable — use text Navigator.");
    }
  }
  function exportProfile() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(profile, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "truthlens-profile.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const runList = (
    <section>
      <h2>Recorded runs</h2>
      <p>
        {filtered.length} of {runs.length} runs shown
      </p>
      {!filtered.length && <p>No matching runs.</p>}
      <div className={`tl-list tl-collection-${collection}`}>
        {filtered.map((r) => (
          <button
            data-testid="run-open"
            className="tl-run"
            key={r.id}
            onClick={() =>
              r.integrity === "failed"
                ? setDetail({ run: r })
                : act({ type: "open_run", project_id: project, run_id: r.id })
            }
          >
            <strong>{r.title}</strong>
            <span>{stamp(r.started)}</span>
            <Badges run={r} />
          </button>
        ))}
      </div>
    </section>
  );
  const resultList = (
    <section>
      <h2>Results</h2>
      <p>
        {artifacts.length} of {runs.reduce((n, r) => n + r.artifacts.length, 0)}{" "}
        recorded artifacts shown
      </p>
      {!artifacts.length && <p>No recorded artifacts in this selection.</p>}
      {artifacts.map(({ run, artifact: a }) => (
        <button
          data-testid="artifact-open"
          className="tl-result"
          key={`${run.id}/${a.id}`}
          onClick={() =>
            act({
              type: "open_artifact",
              project_id: project,
              run_id: run.id,
              artifact_id: a.id,
            })
          }
        >
          <strong>{a.path.split("/").at(-1)}</strong>
          <span>
            {a.kind} · {run.title}
          </span>
          <span>Open result →</span>
        </button>
      ))}
    </section>
  );
  const activity = (
    <section>
      <h2>Activity</h2>
      {filtered.every((r) => !r.events.length) && <p>No recorded events.</p>}
      {filtered.map((r) => (
        <div key={r.id}>
          <h3>{r.title}</h3>
          {r.integrity === "failed" && (
            <p role="alert">Integrity failed. Event content is isolated.</p>
          )}
          <ol>
            {(r.integrity === "failed" ? [] : r.events).map((e, i) => (
              <li key={i} data-focused={e.id === focusedEvidence}>
                <p>
                  {String(e.type ?? e.kind ?? "Recorded event")} ·{" "}
                  {stamp(e.ts ?? e.timestamp ?? e.at)}
                </p>
                {["evidence.attached", "test.reported"].includes(
                  String(e.type),
                ) && (
                  <button
                    onClick={() =>
                      act({
                        type: "focus_evidence",
                        project_id: project,
                        run_id: r.id,
                        evidence_id: `${r.id}/e/${e.id}`,
                      })
                    }
                  >
                    Focus evidence
                  </button>
                )}
                {developer ? (
                  <pre>{json(e)}</pre>
                ) : (
                  <p>
                    {String(
                      e.summary ??
                        e.message ??
                        "Open Developer Lens for recorded payload.",
                    )}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
  return (
    <div
      className={`tl-app tl-${profile.theme} tl-${profile.density} tl-accent-${profile.accent}`}
    >
      <a className="tl-skip" href="#tl-content">
        Skip to content
      </a>
      <aside className="tl-sidebar">
        <div className="tl-logo">
          <strong>
            Truth<span>Lens</span>
          </strong>
        </div>
        <nav aria-label="Workspace">
          {views.map((v) => (
            <button
              data-testid={`nav-${v.toLowerCase()}`}
              key={v}
              aria-current={view === v ? "page" : undefined}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </nav>
        <label>
          Project
          <select
            aria-label="Project"
            value={project}
            onChange={(e) => {
              recognition.current?.abort();
              window.speechSynthesis?.cancel();
              setVoice("Idle");
              setNotice("");
              setOriginFilter("");
              setVerificationFilter("");
              setProject(e.target.value);
              setWorkspace("all");
              setDetail(null);
              setQuery("");
            }}
          >
            {d.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Workspace
          <select
            aria-label="Workspace"
            value={workspace}
            onChange={(e) => {
              setWorkspace(e.target.value);
              setDetail(null);
            }}
          >
            <option value="all">All workspaces</option>
            {d.workspaces
              .filter((w) => w.project_id === project)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </select>
        </label>
        <p className="tl-bottom">
          Observe work.
          <br />
          Read-only workspace.
          <br />
          No agent execution or acceptance.
        </p>
      </aside>
      <div className="tl-body">
        <header className="tl-header">
          <span>
            Workspace /{" "}
            {d.projects.find((p) => p.id === project)?.name ?? "No project"}
          </span>
          <label className="tl-lens">
            <input
              type="checkbox"
              checked={developer}
              onChange={(e) => setDeveloper(e.target.checked)}
            />{" "}
            Developer Lens
          </label>
        </header>
        <div className="tl-sourcebar">
          Local export · Generated {stamp(d.generated_at)} · No live connection
        </div>
        <main id="tl-content">
          <h1>
            {view === "Overview" ? "A clear view of your AI work." : view}
          </h1>
          <p className="tl-muted">
            Results, activity and evidence — with recorded provenance.
          </p>
          <label>
            Navigator mode
            <select
              data-testid="navigator-mode"
              value={navigatorMode}
              onChange={(e) => {
                recognition.current?.abort();
                setVoice("Idle");
                setNavigatorMode(e.target.value as "local" | "codex");
              }}
            >
              <option value="local">Local · deterministic search</option>
              <option value="codex">Codex · your CLI account</option>
            </select>
          </label>
          {navigatorMode === "codex" ? (
            <CodexNavigator
              key={project}
              doc={d}
              project={project}
              onAction={act}
              onSource={(id) => {
                const run = d.runs.find(
                  (r) => r.id === id && r.project_id === project,
                );
                if (run) {
                  act({
                    type: "open_run",
                    project_id: project,
                    run_id: run.id,
                  });
                  return;
                }
                const memory = d.memory.find(
                  (m) => m.id === id && m.project_id === project,
                );
                if (memory) {
                  act({
                    type: "navigate",
                    project_id: project,
                    view: "knowledge",
                  });
                  act({
                    type: "set_filters",
                    project_id: project,
                    filters: { query: String(memory.text).slice(0, 500) },
                  });
                }
              }}
            />
          ) : (
            <form
              className="tl-navigator"
              onSubmit={(e) => {
                e.preventDefault();
                navigator(query);
              }}
            >
              <label>
                Navigator · local search or “open Results”
                <input
                  type="search"
                  maxLength={500}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search this project…"
                />
              </label>
              <button type="submit">Go</button>
              <button type="button" onClick={startVoice}>
                Push to talk
              </button>
              {voice === "Listening" && (
                <>
                  <button
                    type="button"
                    onClick={() => recognition.current?.stop()}
                  >
                    Stop
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      recognition.current?.abort();
                      setVoice("Cancelled");
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
              <label className="tl-lens">
                <input
                  type="checkbox"
                  checked={speak}
                  onChange={(e) => {
                    setSpeak(e.target.checked);
                    if (!e.target.checked) window.speechSynthesis?.cancel();
                  }}
                />{" "}
                Spoken replies
              </label>
            </form>
          )}
          <p role="status">
            {notice} {voice !== "Idle" ? voice : ""}
          </p>
          {view === "Overview" && (
            <>
              <section className="tl-intro">
                <h2>
                  What was done?
                  <br />
                  See the recorded results.
                </h2>
                <p>
                  {runs.length} recorded runs. Human acceptance is unknown until
                  explicitly witnessed.
                </p>
                <button onClick={() => setView("Results")}>
                  Explore results →
                </button>
                <button onClick={() => setView("Evidence")}>
                  Inspect evidence
                </button>
              </section>
              <div className="tl-columns">
                <div>
                  {profile.pane === "activity-first"
                    ? activity
                    : paneOrder.map((p) => (
                        <div key={p}>
                          {p === "runs" ? (
                            runList
                          ) : p === "results" ? (
                            resultList
                          ) : (
                            <section>
                              <h2>Knowledge</h2>
                              <p>
                                {memory.length} memory records in this
                                selection.
                              </p>
                            </section>
                          )}
                        </div>
                      ))}
                </div>
                <aside className="tl-context">
                  <h2>Your review is needed</h2>
                  <p>
                    Integrity checks and agent reports do not grant human
                    acceptance.
                  </p>
                  <h2>Where does the data come from?</h2>
                  <p>
                    Native ledgers and imported reports retain separate origin
                    and verification labels.
                  </p>
                  <button onClick={() => setView("Sources")}>
                    Inspect sources →
                  </button>
                  <h2>Knowledge with provenance</h2>
                  <p>
                    Memory is a recorded statement, not automatically a fact.
                  </p>
                  <button onClick={() => setView("Knowledge")}>
                    Explore knowledge →
                  </button>
                </aside>
              </div>
            </>
          )}
          {view === "Results" && (
            <>
              <label>
                Origin
                <select
                  value={originFilter}
                  onChange={(e) =>
                    act({
                      type: "set_filters",
                      project_id: project,
                      filters: { origin: e.target.value },
                    })
                  }
                >
                  <option value="">All origins</option>
                  <option>NATIVE</option>
                  <option>IMPORTED</option>
                </select>
              </label>
              {resultList}
            </>
          )}
          {view === "Activity" && activity}
          {view === "Evidence" && (
            <>
              {runList}
              <h2>Recorded evidence relationships</h2>
              <RecordedGraph
                data={{
                  nodes: filtered
                    .filter((r) => r.integrity !== "failed")
                    .flatMap((r) => [
                      ...r.criteria.map((c, i) => ({
                        id: `${r.id}/c/${i}`,
                        label: String(c.text ?? c.title ?? "Criterion"),
                      })),
                      ...r.events
                        .filter((e) =>
                          r.criteria.some(
                            (c) =>
                              Array.isArray(c.evidence) &&
                              c.evidence.includes(e.id),
                          ),
                        )
                        .map((e) => ({
                          id: `${r.id}/e/${e.id}`,
                          label: String(e.type),
                        })),
                    ]),
                  edges: filtered
                    .filter((r) => r.integrity !== "failed")
                    .flatMap((r) =>
                      r.criteria.flatMap((c, i) =>
                        Array.isArray(c.evidence)
                          ? c.evidence
                              .filter((id) => r.events.some((e) => e.id === id))
                              .map((id) => ({
                                source: `${r.id}/c/${i}`,
                                target: `${r.id}/e/${id}`,
                                type: "recorded evidence ref",
                                status: String(c.status),
                                source_ref: r.id,
                              }))
                          : [],
                      ),
                    ),
                }}
              />
              <p>
                Check labels report the exported verifier result. Imported
                reports do not become native proof.
              </p>
            </>
          )}
          {view === "Knowledge" && (
            <section>
              <h2>Project memory</h2>
              <RecordedGraph
                data={{
                  nodes: memory.map((m) => ({
                    id: String(m.id),
                    label: String(m.text),
                  })),
                  edges: memory
                    .filter(
                      (m) =>
                        typeof m.revision_of === "string" &&
                        memory.some((other) => other.id === m.revision_of),
                    )
                    .map((m) => ({
                      source: String(m.revision_of),
                      target: String(m.id),
                      type: "revision_of",
                      status: "OBSERVED",
                      source_ref: String(m.source_ref),
                    })),
                }}
              />
              <p>
                {memory.length} of{" "}
                {d.memory.filter((m) => m.project_id === project).length}{" "}
                records shown
              </p>
              {!memory.length && <p>No matching memory records.</p>}
              {memory.map((m) => (
                <article className="tl-memory" key={String(m.id)}>
                  <p>{String(m.text)}</p>
                  <dl>
                    {[
                      "source_ref",
                      "captured_at",
                      "valid_from",
                      "valid_to",
                      "revision_of",
                      "claim_refs",
                      "retrieval_refs",
                      "access_policy",
                    ].map((k) => (
                      <div key={k}>
                        <dt>{k.replaceAll("_", " ")}</dt>
                        <dd>{json(m[k] ?? "Not recorded")}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </section>
          )}
          {view === "Sources" && (
            <section>
              <h2>Connect a local export</h2>
              <label>
                Workspace export JSON
                <input
                  data-testid="workspace-import"
                  type="file"
                  accept="application/json,.json"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 20_000_000) {
                      setNotice("Workspace export exceeds size limit");
                      return;
                    }
                    try {
                      const data: unknown = JSON.parse(await f.text());
                      if (!validateWorkspace(data)) throw Error();
                      setNotice("Local export loaded. Nothing was uploaded.");
                      onImport(data);
                    } catch {
                      setNotice(
                        "Invalid workspace export. Existing data unchanged.",
                      );
                    }
                  }}
                />
              </label>
              <p>
                Read-only import in this browser. Nothing is uploaded or
                persisted.
              </p>
              <h2>Recorded sources</h2>
              {!d.sources.length && <p>No sources recorded.</p>}
              {d.sources
                .filter(
                  (s) =>
                    runs.some((r) => r.source_id === s.id) ||
                    d.memory.some(
                      (m) => m.project_id === project && m.source_id === s.id,
                    ),
                )
                .map((s) => (
                  <article className="tl-memory" key={String(s.id)}>
                    <h3>{String(s.name)}</h3>
                    <p>Kind: {String(s.kind)}</p>
                    {developer && <pre>{json(s)}</pre>}
                  </article>
                ))}
              <h2>Workspace mapping</h2>
              {d.workspaces
                .filter((w) => w.project_id === project)
                .map((w) => (
                  <p key={w.id}>
                    {w.name}: {w.mapping_reason ?? "No mapping reason recorded"}
                  </p>
                ))}
              <h2>Unassigned imports</h2>
              <p>
                {d.unassigned.length} records are unassigned and excluded from
                project results.
              </p>
              {developer && <pre>{json(d.unassigned)}</pre>}
            </section>
          )}
          {view === "Appearance" && (
            <section className="tl-settings">
              <h2>Appearance profile</h2>
              <label>
                Pane order
                <select
                  value={paneOrder.join(",")}
                  onChange={(e) =>
                    act({
                      type: "set_layout",
                      project_id: project,
                      layout: { pane_order: e.target.value.split(",") },
                    })
                  }
                >
                  <option value="runs,results,knowledge">
                    Runs → Results → Knowledge
                  </option>
                  <option value="results,runs,knowledge">
                    Results → Runs → Knowledge
                  </option>
                  <option value="knowledge,results,runs">
                    Knowledge → Results → Runs
                  </option>
                </select>
              </label>
              <label>
                Collection
                <select
                  value={collection}
                  onChange={(e) =>
                    act({
                      type: "set_layout",
                      project_id: project,
                      layout: {
                        collection: e.target.value as "cards" | "list",
                      },
                    })
                  }
                >
                  <option>list</option>
                  <option>cards</option>
                </select>
              </label>
              {(
                [
                  ["theme", ["dark", "light"]],
                  ["density", ["comfortable", "compact"]],
                  ["accent", ["green", "blue", "purple"]],
                  ["pane", ["results-first", "activity-first"]],
                ] as const
              ).map(([key, opts]) => (
                <label key={key}>
                  {key}
                  <select
                    aria-label={key}
                    value={profile[key]}
                    onChange={(e) => {
                      const next = { ...profile, [key]: e.target.value };
                      if (validateProfile(next)) setProfile(next);
                    }}
                  >
                    {opts.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
              ))}
              <button onClick={() => setProfile(defaultProfile)}>
                Reset profile
              </button>
              <button onClick={exportProfile}>Export profile</button>
              <label>
                Import profile
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 10000) {
                      setNotice("Profile too large");
                      return;
                    }
                    try {
                      const p: unknown = JSON.parse(await f.text());
                      if (!validateProfile(p)) throw Error();
                      setProfile(p);
                      setNotice("Profile imported");
                    } catch {
                      setNotice("Invalid profile. No settings changed.");
                    }
                  }}
                />
              </label>
              <p>
                Stored locally. Status colors remain independent of your accent.
              </p>
            </section>
          )}
        </main>
      </div>
      {detail && (
        <Detail
          canSelect={(id) =>
            validAction(
              {
                type: "select_renderer",
                project_id: project,
                run_id: detail.run.id,
                artifact_id: detail.artifact?.id,
                renderer: id,
              },
              d,
              project,
            )
          }
          initialRenderer={selectedRenderer}
          key={`${detail.run.id}/${detail.artifact?.id ?? ""}`}
          {...detail}
          developer={developer}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
export default function App() {
  const [doc, setDoc] = useState<WorkspaceDoc | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [error, setError] = useState("");
  const upload = (
    <label>
      Open a local workspace export
      <input
        data-testid="workspace-import"
        type="file"
        accept="application/json,.json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            if (f.size > 20_000_000) throw Error("Export exceeds size limit");
            const d: unknown = JSON.parse(await f.text());
            if (!validateWorkspace(d)) throw Error("Invalid workspace export");
            setDoc(d);
            setLegacy(false);
            setError("");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Import failed");
          }
        }}
      />
    </label>
  );
  useEffect(() => {
    const controller = new AbortController();
    fetch("/workspace.json", { signal: controller.signal })
      .then(async (r) => {
        if (r.status === 404) {
          setLegacy(true);
          return;
        }
        if (!r.ok) throw Error(`Workspace request failed (${r.status})`);
        const text = await r.text();
        if (text.length > 20_000_000)
          throw Error("Workspace export exceeds size limit");
        const data: unknown = JSON.parse(text);
        if (!validateWorkspace(data))
          throw Error("Invalid workspace schema. Restore a valid export.");
        setDoc(data);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, []);
  if (legacy)
    return (
      <>
        <div className="tl-load" style={{ minHeight: 0, padding: 16 }}>
          {upload}
        </div>
        <LegacyApp />
      </>
    );
  if (error)
    return (
      <main className="tl-load">
        <h1>Workspace unavailable</h1>
        <p role="alert">{error}</p>
        <p>No fallback data is displayed for an invalid workspace.</p>
        {upload}
      </main>
    );
  return doc ? (
    <Workspace
      key={`${doc.generated_at ?? ""}:${doc.projects.map((p) => p.id).join("/")}`}
      doc={doc}
      onImport={setDoc}
    />
  ) : (
    <main className="tl-load">Loading workspace…</main>
  );
}
