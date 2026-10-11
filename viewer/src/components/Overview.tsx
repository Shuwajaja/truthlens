import type { Criterion, Claim, RunEvent } from '../types.ts'
import type { DrawerTarget } from './Drawer.tsx'

const CARD_ACCENT: Record<string, string> = { green: '#3fb950', yellow: '#d29922', red: '#f85149', gray: '#8b949e', outline: '#8b949e' }
const STATUS_LABEL: Record<string, string> = { met: 'met', unmet: 'unmet', unverified: 'unverified', proposed: 'proposed' }
const STATUS_COUNT_ORDER = ['met', 'unmet', 'unverified', 'proposed'] as const

function statusCountSummary(criteria: Criterion[]): string {
  const counts = new Map<string, number>()
  for (const c of criteria) {
    counts.set(c.status, (counts.get(c.status) ?? 0) + 1)
  }
  const parts: string[] = []
  for (const status of STATUS_COUNT_ORDER) {
    const n = counts.get(status) ?? 0
    if (n > 0) parts.push(`${n} ${status}`)
  }
  for (const [status, n] of counts) {
    if (!(STATUS_COUNT_ORDER as readonly string[]).includes(status)) {
      parts.push(`${n} ${status}`)
    }
  }
  return parts.join(', ')
}

function criterionIcon(c: Criterion): string {
  if (c.claimed && c.card === 'yellow') return '?'
  if (c.card === 'green') return '\u2713'
  if (c.card === 'red') return '\u2715'
  return '\u2013'
}

export function Overview({ doc, onOpenDrawer }: {
  doc: { verified: boolean; headline: string[]; review_required: boolean; run: { project: string }; counts: Record<string, number>; criteria: Criterion[]; claims: Claim[]; events: RunEvent[] }
  onOpenDrawer: (t: DrawerTarget) => void
}) {
  const firstUnwitnessed = doc.claims.find(c => c.finding === 'claim_unwitnessed')
  const eventsById = new Map(doc.events.map(e => [e.id, e]))
  const summaryLine = statusCountSummary(doc.criteria)

  return (
    <div>
      <h1 className="text-4xl font-bold leading-tight mb-2">
        {doc.headline.map((l, i) => <span key={i} className="block">{l}</span>)}
      </h1>
      <p className="text-[#8b949e] text-base mb-4">Project: {doc.run.project}</p>
      <p className="text-base mb-6">{summaryLine}</p>

      <div className="space-y-4">
        {doc.criteria.map(c => {
          const accent = CARD_ACCENT[c.card] || '#8b949e'
          const icon = criterionIcon(c)
          const label = STATUS_LABEL[c.status] || c.status
          const isOutline = c.card === 'outline'
          const evts = c.evidence.map(id => eventsById.get(id)).filter(Boolean) as RunEvent[]

          return (
            <button
              key={c.criterion_id}
              type="button"
              className={`card-wrap w-full text-left p-4 ${isOutline ? 'card-outline' : ''}`}
              style={{ borderColor: accent }}
              onClick={() => onOpenDrawer({ kind: 'criterion', criterion: c, matched: evts })}
            >
              <div className="flex items-start gap-4">
                <span className="icon-circle" style={{ backgroundColor: accent }}>{icon}</span>
                <div className="flex-1">
                  <div className="text-base font-medium">{c.text}</div>
                  <div className="text-[#8b949e] text-sm mt-1">{c.plain}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-[6px] py-[1px] rounded-[4px]" style={{ color: accent }}>
                      {label}
                    </span>
                    {c.claimed && (
                      <span className="text-xs text-[#d29922]">claimed</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {firstUnwitnessed && (
        <div className="callout-wrap mt-8">
          <p className="text-sm text-[#e6edf3]">
            Your agent said &lsquo;{firstUnwitnessed.text}&rsquo;. Not everything in it was proven.
          </p>
        </div>
      )}
    </div>
  )
}