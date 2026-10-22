import type {Claim,Criterion,RunEvent} from '../types.ts'
import type {DrawerTarget} from './Drawer.tsx'
import {Card} from './ui/card.tsx'
import {Button} from './ui/button.tsx'
import {StatusBadge} from './ui/badge.tsx'
import {recordedTime} from './overview-data.ts'

type ResultProps={criterion:Criterion;matched:RunEvent[];onOpenDrawer:(target:DrawerTarget)=>void}
export function CriterionResult({criterion,matched,onOpenDrawer}:ResultProps){
 return <div className="space-y-4">
  <h3 className="text-sm">Recorded result</h3>
  <StatusBadge source="criterion" status={criterion.status}/>
  <p className="text-2">{criterion.plain}</p>
  {criterion.status==='unverified'&&<p className="section-note">Not checked — no confirmed result exported.</p>}
  {matched.length<criterion.evidence.length&&<p className="section-note">Some referenced evidence events were not exported.</p>}
  {matched.length===0?<p className="section-note">No evidence events exported for this criterion.</p>:<ul className="criterion-evidence">{matched.map(event=><li key={event.id}>
   <h3>{event.summary}</h3><time dateTime={event.ts}>{recordedTime(event.ts)}</time>
   <details><summary>Recorded payload</summary><pre tabIndex={0} className="criterion-payload">{JSON.stringify(event.payload,null,2)}</pre></details>
   <Button variant="outline" size="sm" onClick={()=>onOpenDrawer({kind:'event',event})}>Open event record</Button>
  </li>)}</ul>}
  <Button variant="outline" size="sm" onClick={()=>onOpenDrawer({kind:'criterion',criterion,matched})}>Open criterion record</Button>
 </div>
}

export function CriterionDetail({criterion,claims,matched,onOpenDrawer}:{criterion:Criterion|undefined;claims:readonly Claim[];matched:RunEvent[];onOpenDrawer:(target:DrawerTarget)=>void}){
 return <Card id="criterion-detail" className="panel criterion-detail" role="region" aria-label="Criterion detail">
  <div className="panel-heading"><h2>Criterion detail</h2></div>
  {!criterion?<p className="text-2">Select a recorded criterion to see its evidence.</p>:<>
   <h3 className="node-title">{criterion.text}</h3>
   <div className="space-y-4"><h3 className="text-sm">Agent said</h3>
    {claims.length===0?<p className="section-note">No agent claim exported for this criterion.</p>:claims.map(claim=><div key={claim.claim_id}><p className="mb-4 break-words">“{claim.text}”</p><StatusBadge source="claim" finding={claim.finding}/></div>)}
   </div>
   <dl className="node-properties"><div><dt>Criterion</dt><dd>{criterion.criterion_id}</dd></div><div><dt>Claimed</dt><dd>{String(criterion.claimed)}</dd></div><div><dt>Evidence events</dt><dd>{matched.length}</dd></div></dl>
   <CriterionResult criterion={criterion} matched={matched} onOpenDrawer={onOpenDrawer}/>
  </>}
 </Card>
}
