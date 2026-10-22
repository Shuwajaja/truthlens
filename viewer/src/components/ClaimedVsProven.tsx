import type { RunDoc } from '../types.ts'
import type { Lens } from '../lens.ts'
import type { DrawerTarget } from './Drawer.tsx'
import { StatusBadge } from './ui/badge.tsx'
import {CriterionResult} from './CriterionDetail.tsx'

export function ClaimedVsProven({ doc, lens, onOpenDrawer }: { doc: RunDoc; lens: Lens; onOpenDrawer:(target:DrawerTarget)=>void }) {
  const criteriaById = new Map(doc.criteria.map(criterion => [criterion.criterion_id, criterion]))
  const eventsById = new Map(doc.events.map(event=>[event.id,event]))
  return <section>
    <h1 className="text-2xl font-semibold mb-6">{lens==='client' ? 'Claims and recorded results' : 'What your agent said vs. what we saw.'}</h1>
    {doc.claims.length === 0 && <p className="text-muted-foreground">No claims exported.</p>}
    <div className="space-y-4">
      {doc.claims.map(claim => {
        const related = claim.criterion_ids.flatMap(id => { const criterion=criteriaById.get(id); return criterion ? [criterion] : [] })
        return <article key={claim.claim_id} className="card-wrap border-border p-4">
          <p className="text-base mb-4 break-words"><span className="text-muted-foreground mr-2">Agent said</span><span>“{claim.text}”</span></p>
          <StatusBadge source="claim" finding={claim.finding} />
          {related.length===0&&<p className="section-note mt-4">No matching criterion exported for this claim.</p>}
          {related.length<claim.criterion_ids.length&&related.length>0&&<p className="section-note mt-4">Some referenced criteria were not exported.</p>}
          {related.map(criterion=><section key={criterion.criterion_id} className="mt-4 pt-4 border-t border-border">
            <h2 className="text-base mb-4">{criterion.text}</h2>
            <CriterionResult criterion={criterion} matched={criterion.evidence.flatMap(id=>{const event=eventsById.get(id);return event?[event]:[]})} onOpenDrawer={onOpenDrawer}/>
          </section>)}
        </article>
      })}
    </div>
  </section>
}
