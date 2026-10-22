import type {EvidenceNode} from '../graph/evidence-graph.ts'
import type {DrawerTarget} from './Drawer.tsx'
import {Card} from './ui/card.tsx'
import {Badge,StatusBadge} from './ui/badge.tsx'
import {Button} from './ui/button.tsx'
import {recordedTime} from './overview-data.ts'

export function NodeDetail({node,onOpenDrawer}:{node:EvidenceNode|undefined;onOpenDrawer:(target:DrawerTarget)=>void}){
 const target=node?.target
 const fields: Array<[string,string|number]>=!target?[]:target.kind==='criterion'?[
  ['Kriterium',target.criterion.criterion_id],['Status',target.criterion.status],['Beleg-Ereignisse',target.matched.length],['Claimed',String(target.criterion.claimed)],
 ]:target.kind==='claim'?[
  ['Claim',target.claim.claim_id],['Finding',target.claim.finding],['Kriterien',target.claim.criterion_ids.join(', ')||'Keine exportiert'],
 ]:target.kind==='event'?[
  ['Ereignis',target.event.id],['Seq',target.event.seq],['Typ',target.event.type],['Actor',`${target.event.actor.kind} / ${target.event.actor.id}`],['Zeit',recordedTime(target.event.ts)],['Hash',target.event.hash],
 ]:[['Artefakt',target.artifact.artifact_id],['SHA-256',target.artifact.sha256],['Provenance',target.artifact.provenance]]
 return <Card className="panel node-detail" role="region" aria-label="Datensatz-Detail"><div className="panel-heading"><h2>Datensatz-Detail</h2><Badge>{node?.kind??'Keine Auswahl'}</Badge></div>
  {!node||!target?<p className="text-2">Kein Datensatz exportiert.</p>:<>
   <p className="node-title">{node.label}</p>
   {target.kind==='claim'?<StatusBadge source="claim" finding={target.claim.finding}/>:target.kind==='criterion'&&node.tone!=='open'?<StatusBadge source="criterion" status={target.criterion.status}/>:<Badge>{target.kind==='criterion'?`${target.criterion.status} · kein eindeutiger Prüfnachweis`:'Aufgezeichneter Datensatz'}</Badge>}
   <dl className="node-properties">{fields.map(([key,value])=><div key={key}><dt>{key}</dt><dd title={String(value)}>{value}</dd></div>)}</dl>
   {target.kind==='criterion'&&<p className="text-2">{target.criterion.plain}</p>}
   <Button variant="outline" size="sm" onClick={()=>onOpenDrawer(target)}>Aufgezeichneten Datensatz öffnen</Button>
  </>}
 </Card>
}
