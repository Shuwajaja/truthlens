import type { RunDoc } from '../types.ts'
import type { Lens } from '../lens.ts'
import { StatusBadge } from './ui/badge.tsx'

export function ClaimedVsProven({ doc, lens }: { doc: RunDoc; lens: Lens }) {
  const criteriaById = new Map(doc.criteria.map(criterion => [criterion.criterion_id, criterion]))
  const client = lens === 'client'
  return <section>
    <h1 className="text-2xl font-bold mb-6">{client ? 'What your agent said' : 'What your agent said vs. what we saw.'}</h1>
    {doc.claims.length === 0 && <p className="text-muted-foreground">No claims exported.</p>}
    <div className="space-y-4">
      {doc.claims.map(claim => {
        const related = claim.criterion_ids.flatMap(id => { const criterion=criteriaById.get(id); return criterion ? [criterion] : [] })
        return <article key={claim.claim_id} className="card-wrap border-border p-4">
          <p className="text-base mb-3 break-words"><span className="text-muted-foreground mr-1">Agent said</span>“{claim.text}”</p>
          <StatusBadge source="claim" finding={claim.finding} />
          {!client && related.length > 0 && <div className="mt-4 pt-3 border-t border-border">
            <h2 className="text-sm text-muted-foreground mb-3">Recorded criterion status</h2>
            <ul className="space-y-3">{related.map(criterion => <li key={criterion.criterion_id} className="flex flex-wrap items-center gap-3">
              <span className="text-sm">{criterion.text}</span><StatusBadge source="criterion" status={criterion.status} />
            </li>)}</ul>
          </div>}
        </article>
      })}
    </div>
  </section>
}
