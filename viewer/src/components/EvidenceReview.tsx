import type {RunDoc} from '../types.ts'
import {checkSummary,outcomeLabels,type AuditCheck,type AuditReport} from '../audit-report.ts'
import type {DrawerTarget} from './Drawer.tsx'
import {Button} from './ui/button.tsx'
import {PageHeading} from './PageHeading.tsx'
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
export function EvidenceReview({doc,view,report,onOpenDrawer}:{doc:RunDoc;view:AuditView;report:AuditReport|null;onOpenDrawer:(target:DrawerTarget)=>void}){
 const checks=report?.checks.filter(check=>view==='chain'?check.rule_id==='TL-AUD-001':view==='gated-actions'?check.rule_id==='TL-AUD-012':!['TL-AUD-001','TL-AUD-003','TL-AUD-012'].includes(check.rule_id))??[]
 const result=checkSummary(checks)
 return <section className="evidence-review">
  <PageHeading title={titles[view]} description="Stored audit results for this snapshot. Reading does not run a new check."/>
  <p className="audit-outcome" data-testid="review-outcome" data-outcome={result.outcome}>{result.label}</p>
  {view==='chain'&&<p>No individual chain-link diagnosis is inferred from these recorded checks.</p>}
  {view==='coverage'&&<p>Recorded content, claim and test evidence checks. Code coverage is not established.</p>}
  {view==='gated-actions'&&<p>A recorded gate check does not grant human approval or establish uncaptured effects.</p>}
  {!report?<p>No stored audit report available. Not checked.</p>:<>
   {!checks.length?<p>No checks recorded for this view.</p>:<Checks checks={checks} doc={doc} onOpenDrawer={onOpenDrawer}/>}
   {view==='chain'&&<details><summary>Recorded authentication checks</summary><p>The browser does not check signatures.</p><Checks checks={report.checks.filter(check=>check.rule_id==='TL-AUD-003')} doc={doc} onOpenDrawer={onOpenDrawer}/></details>}
   <details><summary>Stored report limitations</summary><ul>{report.limitations.map((text,i)=><li key={i}>{text}</li>)}</ul></details>
  </>}
 </section>
}
