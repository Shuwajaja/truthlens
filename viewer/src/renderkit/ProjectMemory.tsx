import { useState } from 'react';
import { RecordedGraph } from '../RecordedGraph.tsx';
import type { RecordValue } from '../workspace.ts';
import './project-memory.css';

const value = (v: unknown) => typeof v === 'string' && v.trim() ? v : 'Not recorded';
export function ProjectMemory({ records, projectId, total }: { records: RecordValue[]; projectId: string; total: number }) {
  const [showGraph, setShowGraph] = useState(false);
  const visible = records.filter(item => item.project_id === projectId).slice(0, 100);
  return <section className="rk-memory" aria-label="Project memory">
    <header><div><h2>What this project remembers</h2><p>Recorded notes and their sources. These statements are not automatically verified.</p></div>
      <button onClick={() => setShowGraph(!showGraph)} aria-expanded={showGraph}>{showGraph ? 'Hide connections' : 'Show connections'}</button></header>
    <p className="rk-memory-scope">Project-wide · {visible.length} of {total} notes shown. Workspace selection does not narrow memory.</p>
    {showGraph && <RecordedGraph data={{ nodes: visible.map(m => ({ id: String(m.id), label: String(m.text) })), edges: visible.filter(m => visible.some(other => other.id === m.revision_of)).map(m => ({ source: String(m.revision_of), target: String(m.id), type: 'revision_of', status: 'OBSERVED', source_ref: value(m.source_ref) })) }} />}
    {!visible.length && <p>No matching notes. Import a memory snapshot to bring recorded knowledge into this project.</p>}
    <ol>{visible.map((note, index) => {
      const previous = visible.find(item => item.id === note.revision_of);
      return <li key={String(note.id)} id={`memory-note-${index}`} tabIndex={-1}>
        <p className="rk-memory-statement">{value(note.text)}</p>
        <p className="rk-memory-source">Source: {value(note.source_ref)}</p>
        <details><summary>Source and history</summary><dl>
          <div><dt>Recorded</dt><dd>{value(note.captured_at)}</dd></div>
          <div><dt>Valid from</dt><dd>{value(note.valid_from)}</dd></div>
          <div><dt>Valid until</dt><dd>{value(note.valid_to)}</dd></div>
        </dl>
        {note.revision_of ? previous ? <button onClick={() => document.getElementById(`memory-note-${visible.indexOf(previous)}`)?.focus()}>Read the earlier note</button> : <p>Earlier note is not available in this selection.</p> : <p>No earlier version recorded.</p>}
        <details><summary>Technical record</summary><pre>{JSON.stringify(note, null, 2)}</pre></details>
        </details>
      </li>;
    })}</ol>
  </section>;
}
