import type { RunDoc } from '../types.ts'
import type { Lens } from '../lens.ts'

function badgeLabel(finding: string): { text: string; color: string } {
  if (finding === 'supported') return { text: 'Proven', color: '#3fb950' }
  if (finding === 'claim_unwitnessed') return { text: 'Claimed only', color: '#d29922' }
  return { text: finding, color: '#8b949e' }
}

function clientClaimVerdict(finding: string): { text: string; color: string } {
  if (finding === 'supported') return { text: 'proven', color: '#3fb950' }
  if (finding === 'claim_unwitnessed') return { text: 'not proven', color: '#d29922' }
  return { text: finding, color: '#8b949e' }
}

function criterionBadge(card: string, claimed: boolean): { text: string; color: string } {
  if (card === 'green') return { text: 'Proven', color: '#3fb950' }
  if (card === 'yellow' && claimed) return { text: 'Claimed only', color: '#d29922' }
  if (card === 'red') return { text: 'Failed', color: '#f85149' }
  return { text: 'Claimed only', color: '#d29922' }
}

export function ClaimedVsProven({ doc, lens }: { doc: RunDoc; lens: Lens }) {
  const criteriaById = new Map(doc.criteria.map(c => [c.criterion_id, c]))
  const client = lens === 'client'

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">
        {client ? 'What your agent said' : 'What your agent said vs. what we saw.'}
      </h2>

      <div className="space-y-6">
        {doc.claims.map(claim => {
          const badge = client ? clientClaimVerdict(claim.finding) : badgeLabel(claim.finding)
          const relatedCriteria = claim.criterion_ids.map(id => criteriaById.get(id)).filter(Boolean) as RunDoc['criteria']

          if (client) {
            return (
              <div key={claim.claim_id} className="card-wrap p-4" style={{ borderColor: '#30363d' }}>
                <p className="text-base">
                  <span className="text-[#8b949e]">Agent said </span>
                  &ldquo;{claim.text}&rdquo;
                  <span className="text-[#8b949e]"> &ndash; </span>
                  <span style={{ color: badge.color }}>{badge.text}</span>
                </p>
              </div>
            )
          }

          return (
            <div key={claim.claim_id} className="card-wrap p-4" style={{ borderColor: '#30363d' }}>
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="text-xs text-[#8b949e] uppercase tracking-wider mb-1">Your agent said</div>
                  <div className="text-base">{claim.text}</div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2 py-1 text-xs rounded-[4px]" style={{ color: badge.color, border: '1px solid ' + badge.color }}>
                    {badge.text}
                  </span>
                </div>
              </div>

              {relatedCriteria.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#30363d]">
                  <div className="text-xs text-[#8b949e] uppercase tracking-wider mb-2">We actually saw</div>
                  <div className="space-y-2">
                    {relatedCriteria.map(c => {
                      const cb = criterionBadge(c.card, c.claimed)
                      return (
                        <div key={c.criterion_id} className="flex items-center gap-3">
                          <span className="text-sm">{c.text}</span>
                          <span className="inline-flex items-center px-2 py-1 text-xs rounded-[4px]" style={{ color: cb.color, border: '1px solid ' + cb.color }}>
                            {cb.text}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
