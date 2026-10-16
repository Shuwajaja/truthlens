import { ImageComparison } from "../renderkit/ImageComparison.tsx";
import { SavedProjections } from "../features/SavedProjections.tsx";
import { RendererExplorer } from "../features/RendererExplorer.tsx";
import { tabKey, viewLabel } from "./tabs.ts";
import { Overview } from "../features/Overview.tsx";
import { Brand } from "./Brand.tsx";
import { SecondaryPanels } from "../features/SecondaryPanels.tsx";
import { useEffect, useRef, useState } from "react";
import { CodexNavigator } from "../CodexNavigator.tsx";
import { RecordedGraph } from "../RecordedGraph.tsx";
import {
  readProfile,
  validAction,
  views,
  type Action,
  type Profile,
  type View,
  type WorkspaceDoc,
} from "../workspace.ts";

import { useWorktabs } from "./useWorktabs.ts";
import { ShellNavigation, Worktabs } from "./ShellNavigation.tsx";
import {
  ArtifactCanvas,
  RunStory,
  RunEvidence,
  SourceTrust,
} from "../renderkit/index.ts";
import { type RendererId } from "../registry.ts";
import { Detail } from "../features/Detail.tsx";
import { json, stamp } from "./format.ts";
import { Badges } from "../features/Badges.tsx";
import "./workspace-tabs.css";
const workspaceViews = [
  { key: "overview", label: "Overview", view: "Overview" },
  { key: "work", label: "Work", view: "Overview" },
  { key: "results", label: "Results", view: "Results" },
  { key: "history", label: "History", view: "Activity" },
] as const;
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
export function Workspace({
  doc: d,
  onImport,
}: {
  doc: WorkspaceDoc;
  onImport: (d: WorkspaceDoc) => void;
}) {
  const {
    project,
    setProject,
    workspace,
    setWorkspace,
    view,
    setView,
    detail,
    setDetail,
    tabs,
    route,
    selectTab,
    closeTab,
  } = useWorktabs(d);
  const [askOpen, setAskOpen] = useState(false);
  const [homeView, setHomeView] = useState<"overview" | "explore">("overview");
  const viewSwipe = useRef<{ x: number; y: number; at: number } | null>(null);
  const activeWorkspaceView = view === "Overview" ? (homeView === "overview" ? "overview" : "work") : view === "Results" ? "results" : view === "Activity" ? "history" : null;
  const selectWorkspaceView = (index: number) => {
    const target = workspaceViews[index];
    if (!target) return;
    if (target.view === "Overview") setHomeView(target.key === "work" ? "explore" : "overview");
    setView(target.view);
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorRef, setInspectorRef] = useState<string>();
  const [query, setQuery] = useState("");
  const [navigatorMode, setNavigatorMode] = useState<"local" | "codex">(
    "local",
  );
  const [developer, setDeveloper] = useState(false);
  const [profile, setProfile] = useState<Profile>(readProfile);
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
    try {
      localStorage.setItem("truthlens.profile", JSON.stringify(profile));
    } catch {
      /* optional preference */
    }
  }, [profile]);
  const [originFilter, setOriginFilter] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("");
  const collection = profile.collection;
  const [selectedRenderer, setSelectedRenderer] = useState<
    string | undefined
  >();
  const [focusedEvidence, setFocusedEvidence] = useState<{
    run_id: string;
    evidence_id: string;
  } | null>(null);
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
              (r as unknown as Record<string, unknown>).reported_summary,
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
    .sort(
      (a, b) =>
        Number(b.id === focusedEvidence?.run_id) -
        Number(a.id === focusedEvidence?.run_id),
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
        if (workspace !== "all" && run.workspace_id !== workspace)
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
        if (workspace !== "all" && run.workspace_id !== workspace)
          setWorkspace("all");
        setSelectedRenderer(a.renderer);
        setDetail({ run, artifact });
      } else return false;
    }
    if (a.type === "focus_evidence") {
      setFocusedEvidence({ run_id: a.run_id, evidence_id: a.evidence_id });
      setDetail(null);
      setQuery("");
      setOriginFilter("");
      setVerificationFilter("");
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
      <ImageComparison key={`${project}/${workspace}`} runs={filtered} project={project} />
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
              <li
                key={i}
                data-focused={
                  r.id === focusedEvidence?.run_id &&
                  e.id === focusedEvidence.evidence_id
                }
              >
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
                        evidence_id: String(e.id),
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
      <a
        className="tl-skip"
        href="#tl-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("tl-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <ShellNavigation
        doc={d}
        project={project}
        workspace={workspace}
        view={view}
        onView={(next) => { if (next === "Overview") setHomeView("overview"); setView(next); }}
        onProject={(id) => {
          recognition.current?.abort();
          window.speechSynthesis?.cancel();
          setVoice("Idle");
          setNotice("");
          setQuery("");
          setOriginFilter("");
          setVerificationFilter("");
          setFocusedEvidence(null);
          setSelectedRenderer(undefined);
          setHomeView("overview");
          setInspectorOpen(false);
          setProject(id);
        }}
        onWorkspace={(id) => {
          recognition.current?.abort();
          window.speechSynthesis?.cancel();
          setVoice("Idle");
          setInspectorOpen(false);
          setWorkspace(id);
          setFocusedEvidence(null);
          setSelectedRenderer(undefined);
        }}
      />
      <div className="tl-body">
        <header className="tl-header">
          <span className="tl-project-heading">
            <span className="tl-mobile-brand">
              <Brand compact />
            </span>
            {d.projects.find((p) => p.id === project)?.name ?? "No project"}
          </span>
          <button
            className="tl-search-toggle"
            aria-expanded={searchOpen}
            aria-controls="workspace-search"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            Search
          </button>
          <form
            id="workspace-search"
            className={`tl-command-search${searchOpen ? " is-open" : ""}`}
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              navigator(query);
            }}
          >
            <label>
              <span className="tl-visually-hidden">Search recorded work</span>
              <input
                type="search"
                aria-label="Search recorded work"
                maxLength={500}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recorded work…"
              />
            </label>
          </form>
          <button
            className="tl-ask-toggle"
            aria-expanded={askOpen}
            onClick={() => setAskOpen(!askOpen)}
          >
            Ask TruthLens
          </button>
        </header>
        <div className="tl-sourcebar">
          <span>Saved work · Not connected live</span>
          <details className="tl-technical-details">
            <summary>Technical details</summary>
            <div>
              <p>Local export · Generated {stamp(d.generated_at)}</p>
              <label className="tl-lens">
                <input
                  type="checkbox"
                  checked={developer}
                  onChange={(e) => setDeveloper(e.target.checked)}
                />
                Developer Lens
              </label>
            </div>
          </details>
        </div>
        {detail && tabs.length > 1 && (
          <Worktabs
            tabs={tabs}
            route={route}
            doc={d}
            onSelect={selectTab}
            onClose={closeTab}
          />
        )}
        {!detail && <nav className="workspace-view-tabs" aria-label="Workspace views">
          {workspaceViews.map((item, index) => <button key={item.key} data-testid={`workspace-view-${item.key}`} aria-pressed={activeWorkspaceView === item.key} onClick={() => selectWorkspaceView(index)}>{item.label}</button>)}
          <span>Swipe to switch views on mobile</span>
        </nav>}
        {!detail && <SavedProjections key={`${project}/${workspace}`} doc={d} project={project} workspace={workspace} query={query} onOpen={p => {
          setQuery(p.query); setOriginFilter(""); setVerificationFilter("");
          setFocusedEvidence(null); setSelectedRenderer(undefined); setView(p.view);
          setNotice(`Saved view: ${p.title} · current snapshot`);
        }} />}
        <main
          onTouchStart={(event) => {
            viewSwipe.current = null;
            if (detail || !activeWorkspaceView || innerWidth > 900 || event.touches.length !== 1 || (event.target as HTMLElement).closest("button,a,input,select,textarea,summary,pre,table,iframe,.feed-carousel,.feed-stories,.tl-graph,.rk-canvas")) return;
            const touch = event.touches[0];
            viewSwipe.current = { x: touch.clientX, y: touch.clientY, at: Date.now() };
          }}
          onTouchCancel={() => { viewSwipe.current = null; }}
          onTouchEnd={(event) => {
            const start = viewSwipe.current;
            viewSwipe.current = null;
            if (!start || !event.changedTouches.length || Date.now() - start.at > 1000) return;
            const touch = event.changedTouches[0];
            const dx = touch.clientX - start.x;
            if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(touch.clientY - start.y) * 2) return;
            const index = workspaceViews.findIndex((item) => item.key === activeWorkspaceView);
            selectWorkspaceView(index + (dx < 0 ? 1 : -1));
          }}
          id="tl-content"
          role={tabs.length > 1 ? "tabpanel" : undefined}
          aria-labelledby={
            tabs.length > 1
              ? "tab-" + encodeURIComponent(tabKey(route))
              : "workspace-title"
          }
          tabIndex={-1}
        >
          <h1 id="workspace-title" className={!detail && view === "Overview" ? "tl-feed-page-title" : undefined}>
            {detail
              ? (detail.artifact?.path.split("/").at(-1) ?? detail.run.title)
              : view === "Overview"
                ? "Workspace overview"
                : view === "Sources"
                  ? "Connections"
                  : viewLabel(view)}
          </h1>
          {view !== "Overview" || detail ? (
            <p className="tl-muted">
              {detail
                ? "Inspect the recorded result, then trace its source."
                : view === "Sources"
                  ? "Open your work or set up a connection."
                  : view === "Appearance"
                    ? "Make this workspace comfortable to read."
                    : view === "Renderers"
                      ? "Explore the views with clearly labelled fictional examples."
                    : view === "Results"
                      ? "Open the files produced by recorded work."
                      : "Open a run. Compare its claims with the recorded evidence."}
            </p>
          ) : null}
          {askOpen && (
            <section className="tl-ask-panel" aria-label="Ask TruthLens">
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
                  key={`${project}/${workspace}`}
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
            </section>
          )}
          <p className="tl-workspace-notice" role="status">
            {notice} {voice !== "Idle" ? voice : ""}
          </p>
          {detail && (
            <section className="tl-primary-canvas" aria-label="Recorded result">
              <div className="tl-canvas-toolbar">
                <button onClick={() => setDetail(null)}>Back to {view}</button>
                {detail.artifact && <button onClick={() => setDetail({ run: detail.run })}>Checks for this work</button>}
                <button
                  onClick={() => {
                    setInspectorRef(undefined);
                    setInspectorOpen(true);
                  }}
                >
                  Inspect source & trust
                </button>
              </div>
              {detail.artifact ? (
                <ArtifactCanvas
                  key={detail.artifact.id}
                  doc={d}
                  run={detail.run}
                  artifact={detail.artifact}
                  renderer={selectedRenderer as RendererId | undefined}
                />
              ) : (
                <>
                  <details className="tl-run-provenance">
                    <summary>
                      Technical record details ·{" "}
                      {detail.run.origin === "IMPORTED"
                        ? "Imported report"
                        : "Native recording"}{" "}

                    </summary>
                    <SourceTrust run={detail.run} doc={d} />
                  </details>
                  <RunEvidence
                    run={detail.run}
                    onOpenSource={(ref) => {
                      setInspectorRef(ref);
                      setInspectorOpen(true);
                    }}
                  />
                  {detail.run.integrity !== "failed" &&
                    detail.run.artifacts.length > 0 && (
                      <section className="tl-output-shelf">
                        <h2>Files from this work</h2>
                        <div className="tl-output-items">
                          {detail.run.artifacts.map((artifact) => (
                            <button
                              key={artifact.id}
                              onClick={() =>
                                setDetail({ run: detail.run, artifact })
                              }
                            >
                              {artifact.path.split("/").at(-1)}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                  <details className="tl-run-activity">
                    <summary>
                      Recorded activity ·{" "}
                      {detail.run.integrity === "failed"
                        ? "isolated"
                        : `${detail.run.events.length} events`}
                    </summary>
                    <RunStory
                      run={detail.run}
                      onOpenSource={(ref) => {
                        setInspectorRef(ref);
                        setInspectorOpen(true);
                      }}
                    />
                  </details>
                </>
              )}
            </section>
          )}
          {!detail && view === "Overview" && (
            <Overview
              doc={d}
              projectId={project}
              workspaceId={workspace}
              homeView={homeView}
              memoryCount={memory.length}
              onKnowledge={() => setView("Knowledge")}
              paneOrder={profile.pane_order}
              activity={profile.pane === "activity-first" ? activity : null}
              runs={filtered}
              total={runs.length}
              artifacts={artifacts}
              onRun={(run) => setDetail({ run })}
              onArtifact={(run, artifact) =>
                act({
                  type: "open_artifact",
                  project_id: project,
                  run_id: run.id,
                  artifact_id: artifact.id,
                })
              }
              onConnect={() => setView("Sources")}
              onResults={() => setView("Results")}
            />
          )}
          {!detail && view === "Projects" && (
            <section>
              <h2>Available projects</h2>
              <p>Select a project to inspect only its recorded work.</p>
              <div className="tl-list">
                {d.projects.map((p) => (
                  <button
                    className="tl-run"
                    key={p.id}
                    onClick={() => {
                      setProject(p.id);
                      setQuery("");
                      setOriginFilter("");
                      setVerificationFilter("");
                    }}
                  >
                    <strong>{p.name}</strong>
                    <span>
                      {d.workspaces.filter((w) => w.project_id === p.id).length}{" "}
                      workspaces ·{" "}
                      {d.runs.filter((r) => r.project_id === p.id).length}{" "}
                      recorded runs
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {!detail && view === "Renderers" && <RendererExplorer />}
          {!detail && view === "Results" && (
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
          {!detail && view === "Activity" && activity}
          {!detail && view === "Evidence" && (
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
          {!detail && (
            <SecondaryPanels
              view={view}
              d={d}
              project={project}
              runs={runs}
              memory={memory}
              developer={developer}
              profile={profile}
              setProfile={setProfile}
              act={act}
              setNotice={setNotice}
              onImport={onImport}
              exportProfile={exportProfile}
            />
          )}
        </main>
      </div>
      {detail && inspectorOpen && (
        <Detail
          key={`${detail.run.id}/${detail.artifact?.id ?? ""}`}
          {...detail}
          sourceRef={inspectorRef}
          onClose={() => setInspectorOpen(false)}
        />
      )}
    </div>
  );
}
