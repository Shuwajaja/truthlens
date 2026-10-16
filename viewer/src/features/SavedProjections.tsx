import { useState } from 'react';
import type { WorkspaceDoc } from '../workspace.ts';
import { projectionAvailable, projectionKey, projectionViews, readProjections, validProjection, type Projection } from '../projections.ts';
import './saved-projections.css';
import { ComposedPerspective } from './ComposedPerspective.tsx';

export function SavedProjections({ doc, project, workspace, query, onOpen }: {
  doc: WorkspaceDoc; project: string; workspace: string; query: string; onOpen: (p: Projection) => void;
}) {
  const [items, setItems] = useState<Projection[]>(() => { try { return readProjections(localStorage.getItem(projectionKey)); } catch { return []; } });
  const [title, setTitle] = useState('');
  const [view, setView] = useState<Projection['view']>('Results');
  const [filter, setFilter] = useState(query);
  const [proposal, setProposal] = useState('');
  const [message, setMessage] = useState('');
  function persist(next: Projection[]) {
    try { localStorage.setItem(projectionKey, JSON.stringify(next)); setItems(next); setMessage('Saved in this browser.'); return true; }
    catch { setMessage('Browser storage is unavailable. Nothing was saved.'); return false; }
  }
  function add(p: Projection) {
    if (!projectionAvailable(p, doc, project, workspace)) { setMessage('This view does not match the selected project/workspace. Memory requires All workspaces.'); return; }
    if (items.length >= 20 || items.some(item => item.id === p.id)) { setMessage('Up to 20 unique views can be saved. Remove one or use a different ID.'); return; }
    if (persist([...items, p])) { setTitle(''); setProposal(''); }
  }
  const scoped = items.filter(p => p.project_id === project);
  return <details className="saved-projections"><summary>Saved views <span>{scoped.length ? `· ${scoped.length}` : '· create a perspective'}</span></summary>
    <div className="saved-projections-content">
      <p>Local perspectives over existing records. Saving a view does not run an agent or copy evidence.</p>
      <ul>{scoped.map(p => <li key={p.id}><button disabled={!projectionAvailable(p,doc,project,workspace)} onClick={() => onOpen(p)}>{p.title}</button><span>{p.view === 'Knowledge' ? 'Project memory' : p.view} · {p.query || 'All records'}{!projectionAvailable(p,doc,project,workspace) && ' · Select its workspace to open'}</span><button aria-label={`Delete saved view ${p.title}`} onClick={() => persist(items.filter(x => x.id !== p.id))}>Remove</button></li>)}</ul>
      <form onSubmit={event => { event.preventDefault(); const p = {schema_version:'truthlens.projection/1' as const,id:crypto.randomUUID(),title:title.trim(),project_id:project,workspace_id:workspace === 'all' ? null : workspace,view,query:filter}; if (validProjection(p)) add(p); }}>
        <label>Name<input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} required placeholder="Website" /></label>
        <label>Show<select value={view} onChange={e => setView(e.target.value as Projection['view'])}>{projectionViews.map(v => <option key={v} value={v}>{v === 'Knowledge' ? 'Project memory' : v}</option>)}</select></label>
        <label>Contains<input value={filter} onChange={e => setFilter(e.target.value)} maxLength={500} placeholder="Optional search" /></label>
        <button type="submit">Save view</button>
      </form>
      <details><summary>Agent proposal · JSON</summary><p>Paste a projection recipe from your agent. Only view selection and text filters are accepted. This does not connect or control another client.</p>
        <label>Projection JSON<textarea value={proposal} onChange={e => setProposal(e.target.value)} maxLength={10000} rows={5} /></label>
        <button onClick={() => { try { const p: unknown = JSON.parse(proposal); if (!validProjection(p)) throw Error(); add(p); } catch { setMessage('Invalid projection recipe. No view was saved.'); } }}>Import proposed view</button>
        <details><summary>Example recipe for this workspace</summary><pre>{JSON.stringify({schema_version:'truthlens.projection/1',id:'website',title:'Website',project_id:project,workspace_id:workspace === 'all' ? null : workspace,view:'Results',query:'website'},null,2)}</pre></details>
      </details>
      <ComposedPerspective doc={doc} project={project} workspace={workspace} />
      {message && <p role="status">{message}</p>}
    </div>
  </details>;
}
