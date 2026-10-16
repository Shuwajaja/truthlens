import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArtifactCanvas, RunEvidence, RunStory, RunTimeline, SourceTrust } from '../renderkit/index.ts';
import { validateWorkspace, type WorkspaceDoc } from '../workspace.ts';
import wordmark from '../assets/truthlens-wordmark.jpg';
import './widget.css';
import './demo-preview.css';

const views = [
  ['summary', 'Overview', 'Understand what was recorded.'],
  ['result', 'Result', 'Explore the actual files.'],
  ['checks', 'Checks', 'See what passed and what needs attention.'],
  ['timeline', 'History', 'Follow the recorded steps.'],
] as const;
type View = typeof views[number][0];

export function DemoWidgets() {
  const [workspace, setWorkspace] = useState<WorkspaceDoc | null>(null);
  const [error, setError] = useState('');
  const [projectId, setProjectId] = useState('');
  const [runId, setRunId] = useState('');
  const [artifactId, setArtifactId] = useState('');
  const [view, setView] = useState<View>('summary');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const controller = new AbortController();
    void fetch('./workspace.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('The examples could not be loaded.');
        return response.json();
      })
      .then((data: unknown) => {
        if (!validateWorkspace(data)) throw new Error('The example data is invalid. No content displayed.');
        setWorkspace(data);
        setProjectId(data.projects[0]?.id ?? '');
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load examples.');
      });
    return () => controller.abort();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const runs = workspace?.runs.filter((run) => run.project_id === projectId) ?? [];
  const run = runs.find((item) => item.id === runId) ?? runs[0];
  const artifact = run?.artifacts.find((item) => item.id === artifactId) ?? run?.artifacts[0];

  return <main className="widget demo-gallery">
    <header>
      <div>
        <div className="widget-brand"><img src={wordmark} alt="TruthLens" /></div>
        <h1>Small views. The whole story.</h1>
        <p>Explore the views you can open alongside a conversation.</p>
      </div>
      <div className="actions">
        <a href="/">Back to your workspace</a>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</button>
      </div>
    </header>
    <p className="notice">Widget component preview · recorded examples, including synthetic examples. These are the shared TruthLens views; this page is not connected to a live MCP server or ChatGPT.</p>
    {error && <p role="alert">{error}</p>}
    {!workspace && !error && <p role="status">Loading examples…</p>}
    {workspace && <>
      <div className="demo-selectors">
        <label htmlFor="demo-project">Project<select id="demo-project" value={projectId} onChange={(event) => { setProjectId(event.target.value); setRunId(''); setArtifactId(''); }}>
          {workspace.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select></label>
        <label htmlFor="demo-run">Example<select id="demo-run" value={run?.id ?? ''} disabled={!runs.length} onChange={(event) => { setRunId(event.target.value); setArtifactId(''); }}>
          {runs.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.title}</option>)}
        </select></label>
      </div>
      <div className="demo-view-picker" role="group" aria-label="Widget view">
        {views.map(([id, title, description]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}><strong>{title}</strong><span>{description}</span></button>)}
      </div>
      {!run ? <p>No recorded work in this project.</p> : <article className="demo-widget-frame" aria-label="Selected widget preview">
        <p className="demo-eyebrow">{views.find(([id]) => id === view)?.[1]} · recorded example</p>
        <h2>{run.title}</h2>
        {run.integrity === 'failed' ? <p role="alert" className="notice">This record could not be verified. Its contents are isolated and cannot be displayed.</p> : <>
          {view === 'summary' && <RunStory run={run} />}
          {view === 'checks' && <RunEvidence run={run} />}
          {view === 'timeline' && <RunTimeline run={run} />}
          {view === 'result' && (artifact ? <>
            <label className="demo-artifact-label" htmlFor="demo-file">File<select id="demo-file" value={artifact.id} onChange={(event) => setArtifactId(event.target.value)}>
              {run.artifacts.map((item) => <option key={item.id} value={item.id}>{item.path}</option>)}
            </select></label>
            <ArtifactCanvas key={`${run.id}/${artifact.id}`} doc={workspace} run={run} artifact={artifact} mode="mcp-app" />
          </> : <p>No files were recorded for this example.</p>)}
        </>}
        <details><summary>Technical details and source</summary><SourceTrust run={run} doc={workspace} /><p>Recorded snapshot: {workspace.generated_at ?? 'Time not recorded'}</p><p>Run: <code>{run.id}</code></p></details>
      </article>}
      <footer>Read-only examples. No model calls, uploads or connection setup required.</footer>
    </>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<DemoWidgets />);
