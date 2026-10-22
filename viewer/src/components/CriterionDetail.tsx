import type {Criterion,RunEvent} from '../types.ts'
import type {DrawerTarget} from './Drawer.tsx'
import {Card} from './ui/card.tsx'
import {Button} from './ui/button.tsx'
import {StatusBadge} from './ui/badge.tsx'
import {recordedTime} from './overview-data.ts'

export function CriterionDetail({criterion,matched,onOpenDrawer}:{criterion:Criterion|undefined;matched:RunEvent[];onOpenDrawer:(target:DrawerTarget)=>void}){
 return <Card id="criterion-detail" className="panel criterion-detail" role="region" aria-label="Criterion detail">
  <div className="panel-heading"><h2>Criterion detail</h2>{criterion&&<StatusBadge source="criterion" status={criterion.status}/>}</div>
  {!criterion?<p className="text-2">Select a recorded criterion to see its evidence.</p>:<>
   <h3 className="node-title">{criterion.text}</h3>
   <p className="text-2">{criterion.plain}</p>
   <dl className="node-properties"><div><dt>Criterion</dt><dd>{criterion.criterion_id}</dd></div><div><dt>Claimed</dt><dd>{String(criterion.claimed)}</dd></div><div><dt>Evidence events</dt><dd>{matched.length}</dd></div></dl>
   {matched.length===0?<p className="section-note">No evidence events exported for this criterion.</p>:<ul className="criterion-evidence">{matched.map(event=><li key={event.id}>
    <h3>{event.summary}</h3><time dateTime={event.ts}>{recordedTime(event.ts)}</time>
    <details><summary>Recorded payload</summary><pre tabIndex={0} className="criterion-payload">{JSON.stringify(event.payload,null,2)}</pre></details>
    <Button variant="outline" size="sm" onClick={()=>onOpenDrawer({kind:'event',event})}>Open event record</Button>
   </li>)}</ul>}
   <Button variant="outline" size="sm" onClick={()=>onOpenDrawer({kind:'criterion',criterion,matched})}>Open criterion record</Button>
  </>}
 </Card>
}
