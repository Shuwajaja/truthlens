import { useState } from 'react';
import type { WorkspaceDoc } from '../workspace.ts';
import { compositionExample, parseComposition } from '../renderkit/composition.ts';
import { ComposedView } from '../renderkit/ComposedView.tsx';
import './composed-perspective.css';

export function ComposedPerspective({ doc, project, workspace }: { doc: WorkspaceDoc; project: string; workspace: string }) {
  const [input, setInput] = useState('');
  const [value, setValue] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(true);
  return <details className="composed-perspective"><summary>Compose a view · advanced</summary>
    <p>Let an agent choose how to present existing records. This browser renders approved components; the recipe cannot supply evidence or run commands. Views stay here until you close or reload the page.</p>
    <details open={editing} onToggle={event => setEditing(event.currentTarget.open)}>
    <summary>Edit view recipe</summary>
    <label>View recipe<textarea rows={6} maxLength={20000} value={input} onChange={event => setInput(event.target.value)} /></label>
    <div className="composed-actions"><button onClick={() => setInput(JSON.stringify(compositionExample(doc, project, workspace), null, 2))}>Use this workspace as an example</button>
    <button onClick={() => { setValue(null); try { if (input.length > 20000) throw Error('View recipe is too large.'); const next: unknown = JSON.parse(input); parseComposition(next, doc, project, workspace); setValue(next); setError(''); setEditing(false); } catch (e) { setError(e instanceof SyntaxError ? 'Enter valid JSON to preview a view.' : e instanceof Error ? e.message : 'View unavailable.'); } }}>Preview view</button>
    </div>
    </details>
    {value !== null && <button onClick={() => { setValue(null); setError(''); setEditing(true); }}>Close preview</button>}
    {error && <p role="alert">{error}</p>}
    <details><summary>Allowed sections and limits</summary><p>Overview and Memory take empty props. Checks and Timeline take runId. Result takes runId and artifactId. One Perspective holds up to six sections. Memory requires All workspaces. Current project and workspace must match; unknown fields and actions are rejected. Expand the example to see the native json-render root/elements format with TruthLens scope fields.</p></details>
    {value !== null && <div className="composed-preview"><p>Current recorded data · Presentation does not verify or approve work.</p><ComposedView value={value} doc={doc} project={project} workspace={workspace} /></div>}
  </details>;
}
