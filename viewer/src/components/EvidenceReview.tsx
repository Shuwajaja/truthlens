import type {RunDoc} from '../types.ts'
import {checkSummary,outcomeLabels,type AuditCheck,type AuditReport} from '../audit-report.ts'
import type {DrawerTarget} from './Drawer.tsx'
import {Button} from './ui/button.tsx'
import {PageHeading} from './PageHeading.tsx'
import {StatusDeck} from './StatusDeck.tsx'
import {unavailableStatus,type StatusResult} from '../status-result.ts'
export type AuditView='chain'|'coverage'|'gated-actions'
const titles={chain:'Chain',coverage:'Coverage','gated-actions':'Gated actions'}
function Checks({checks,doc,onOpenDrawer}:{checks:AuditCheck[];doc:RunDoc;onOpenDrawer:(target:DrawerTarget)=>void}){
 return <ul className="audit-checks">{checks.map((check,index)=><li key={`${check.rule_id}-${index}`}>
  <p><code>{check.rule_id}</code> · <span className="audit-outcome" data-outcome={check.outcome}>{outcomeLabels[check.outcome]}</span> · {check.required?'Required':'Optional'}</p>
  <p className="recorded-text">{check.message}</p>
  {(check.expected!=null||check.actual!=null)&&<dl className="node-properties"><div><dt>Expected</dt><dd>{check.expected??'Not recorded'}</dd></div><div><dt>Actual</dt><dd>{check.actual??'Not recorded'}</dd></div></dl>}
  {check.event_ids.map(id=>{const event=doc.events.find(e=>e.id===id);return event?<Button key={id} variant="outline" size="sm" onClick={()=>onOpenDrawer({kind:'event',event})}>Open event {id}</Button>:<p key={id}>Event not exported: {id}</p>})}
  {check.criterion_ids.map(id=>{const criterion=doc.criteria.find(c=>c.criterion_id===id);return criterion?<Button key={id} variant="outline" size="sm" onClick={()=>onOpenDrawer({kind:'criterion',criterion,matched:criterion.evidence.flatMap(id=>{const event=doc.events.find(e=>e.id===id);return event?[event]:[]})})}>Open criterion {id}</Button>:<p key={id}>Criterion not exported: {id}</p>})}
 </li>)}</ul>
}
export function EvidenceReview({doc,view,report,status=unavailableStatus,onOpenDrawer}:{doc:RunDoc;view:AuditView;report:AuditReport|null;status?:StatusResult;onOpenDrawer:(target:DrawerTarget)=>void}){
 const checks=report?.checks.filter(check=>view==='chain'?check.rule_id==='TL-AUD-001':view==='gated-actions'?check.rule_id==='TL-AUD-012':!['TL-AUD-001','TL-AUD-003','TL-AUD-012'].includes(check.rule_id))??[]
 const result=checkSummary(checks)
 const gateEvents=doc.events.filter(event=>event.type.startsWith('action.')||event.type.startsWith('approval.')).toSorted((a,b)=>a.seq-b.seq)
 return <section className="evidence-review">
  <PageHeading title={titles[view]} description="Stored audit results for this snapshot. Reading does not run a new check."/>
  <StatusDeck result={status}/>
  <p className="audit-outcome" data-testid="review-outcome" data-outcome={result.outcome}>{result.label}</p>
  {view==='chain'&&<p>No individual chain-link diagnosis is inferred from these recorded checks.</p>}
  {view==='coverage'&&<p>Recorded content, claim and test evidence checks. Code coverage is not established.</p>}
  {view==='gated-actions'&&<p>A recorded gate check does not grant human approval or establish uncaptured effects.</p>}
  {view==='gated-actions'&&<section><h2>Recorded gate events</h2><p>Original records do not establish human approval.</p>{!gateEvents.length?<p>No gate events exported.</p>:<ul className="audit-checks">{gateEvents.map(event=><li key={event.id}><p><code>#{event.seq} · {event.type}</code></p><p>{event.summary}</p><p>{event.actor.kind} · {event.actor.id}</p>{event.payload.simulated===true&&<p>Simulated record</p>}<Button variant="outline" onClick={()=>onOpenDrawer({kind:'event',event})}>Open gate event {event.id}</Button></li>)}</ul>}</section>}
  {!report?<p>No stored audit report available. Not checked.</p>:<>
   {!checks.length?<p>No checks recorded for this view.</p>:<Checks checks={checks} doc={doc} onOpenDrawer={onOpenDrawer}/>}
   {view==='chain'&&<details><summary>Recorded authentication checks</summary><p>The browser does not check signatures.</p><Checks checks={report.checks.filter(check=>check.rule_id==='TL-AUD-003')} doc={doc} onOpenDrawer={onOpenDrawer}/></details>}
   <details><summary>Stored report limitations</summary><ul>{report.limitations.map((text,i)=><li key={i}>{text}</li>)}</ul></details>
  </>}
 </section>
}
