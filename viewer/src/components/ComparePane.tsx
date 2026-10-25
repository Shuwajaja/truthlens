import {useState} from 'react'
import type {RunDoc} from '../types.ts'
import {IntegrityNotice} from './IntegrityNotice.tsx'
import {PageHeading} from './PageHeading.tsx'
import {StatusBadge} from './ui/badge.tsx'
import {StoredDiff} from './StoredChanges.tsx'
export type ComparisonSnapshot={sourceId:string;doc:RunDoc}
const identity=(snapshot:ComparisonSnapshot)=>JSON.stringify([snapshot.sourceId,snapshot.doc.run.run_id])
function Snapshot({snapshot,side}:{snapshot:ComparisonSnapshot;side:'Left'|'Right'}){
 const {doc,sourceId}=snapshot
 return <section className="comparison-snapshot" aria-label={`${side} snapshot`}>
  <h2>{side} snapshot</h2><h3>{doc.run.project}</h3>
  <dl className="node-properties"><div><dt>Source</dt><dd>{sourceId}</dd></div><div><dt>Run</dt><dd>{doc.run.run_id}</dd></div><div><dt>Ledger head</dt><dd>{doc.run.ledger_last_hash}</dd></div></dl>
  <IntegrityNotice label={`${side} snapshot trust boundaries`} verified={doc.verified} integrity={doc.integrity}/>
  <h3>Recorded criterion results</h3>
  {!doc.criteria.length?<p>No criteria exported.</p>:<ul className="audit-checks">{doc.criteria.map(c=><li key={c.criterion_id}><p>{c.text}</p><code>{c.criterion_id}</code> · <StatusBadge source="criterion" status={c.status}/><p>{c.plain}</p></li>)}</ul>}
  <h3>Stored diff for this snapshot</h3><StoredDiff doc={doc}/>
 </section>
}
export function ComparePane({current,choices}:{current:ComparisonSnapshot;choices:ComparisonSnapshot[]}){
 const [selected,setSelected]=useState('')
 const available=choices.filter(choice=>identity(choice)!==identity(current))
 const right=available.find(choice=>identity(choice)===selected)
 return <section className="evidence-review"><PageHeading title="Compare" description="Compare recorded results and stored diffs of two loaded snapshots."/>
  <label className="comparison-select">Comparison snapshot<select value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Choose another loaded snapshot</option>{available.map(choice=><option key={identity(choice)} value={identity(choice)}>{choice.doc.run.run_id} · {choice.sourceId}</option>)}</select></label>
  <p>Only loaded snapshots are offered. Each side keeps its own evidence and trust boundary.</p>
  {selected&&!right&&<p role="status">Comparison snapshot unavailable. Return to Runs to load it again.</p>}
  <div className="comparison-grid"><Snapshot snapshot={current} side="Left"/>{right&&<Snapshot snapshot={right} side="Right"/>}</div>
 </section>
}
