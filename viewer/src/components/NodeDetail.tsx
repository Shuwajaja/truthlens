import type {EvidenceNode} from '../graph/evidence-graph.ts'
import type {DrawerTarget} from './Drawer.tsx'
import {Card} from './ui/card.tsx'
import {Badge,StatusBadge} from './ui/badge.tsx'
import {Button} from './ui/button.tsx'
import {recordedTime} from './overview-data.ts'

export function NodeDetail({node,onOpenDrawer}:{node:EvidenceNode|undefined;onOpenDrawer:(target:DrawerTarget)=>void}){
 const target=node?.target
 const fields: Array<[string,string|number]>=!target?[]:target.kind==='criterion'?[
  ['Criterion',target.criterion.criterion_id],['Status',target.criterion.status],['Evidence events',target.matched.length],['Claimed',String(target.criterion.claimed)],
 ]:target.kind==='claim'?[
  ['Claim',target.claim.claim_id],['Finding',target.claim.finding],['Criteria',target.claim.criterion_ids.join(', ')||'None exported'],
 ]:target.kind==='event'?[
  ['Event',target.event.id],['Sequence',target.event.seq],['Type',target.event.type],['Actor',`${target.event.actor.kind} / ${target.event.actor.id}`],['Time',recordedTime(target.event.ts)],['Hash',target.event.hash],
 ]:[['File',target.artifact.artifact_id],['SHA-256',target.artifact.sha256],['Source',target.artifact.provenance]]
 return <Card className="panel node-detail" role="region" aria-label="Record details"><div className="panel-heading"><h2>Record details</h2><Badge>{node?.kind??'No selection'}</Badge></div>
  {!node||!target?<p className="text-2">No record exported.</p>:<>
   <p className="node-title">{node.label}</p>
   {target.kind==='claim'?<StatusBadge source="claim" finding={target.claim.finding}/>:target.kind==='criterion'&&node.tone!=='open'?<StatusBadge source="criterion" status={target.criterion.status}/>:<Badge>{target.kind==='criterion'?`${target.criterion.status} · no clear proof`:'Recorded item'}</Badge>}
   <dl className="node-properties">{fields.map(([key,value])=><div key={key}><dt>{key}</dt><dd title={String(value)}>{value}</dd></div>)}</dl>
   {target.kind==='criterion'&&<p className="text-2">{target.criterion.plain}</p>}
   <Button variant="outline" size="sm" onClick={()=>onOpenDrawer(target)}>Open record</Button>
  </>}
 </Card>
}
