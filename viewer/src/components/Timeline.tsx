import type { RunEvent } from '../types.ts'
import type { Lens } from '../lens.ts'
import type { DrawerTarget } from './Drawer.tsx'

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    const s = d.getSeconds().toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  } catch {
    return ts
  }
}

export function Timeline({ events, lens, onOpenDrawer }: {
  events: RunEvent[]
  lens: Lens
  onOpenDrawer: (t: DrawerTarget) => void
}) {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const client = lens === 'client'

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Timeline</h2>

      <div className="w-full">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-[#8b949e] uppercase tracking-wider border-b border-[#30363d]">
              {!client && <th className="text-left py-2 px-3">Seq</th>}
              <th className="text-left py-2 px-3">Time</th>
              {!client && <th className="text-left py-2 px-3">Actor</th>}
              <th className="text-left py-2 px-3">{client ? 'What happened' : 'Summary'}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(evt => (
              <tr
                key={evt.id}
                className="timeline-row border-b border-[#30363d]"
                onClick={() => onOpenDrawer({ kind: 'event', event: evt })}
              >
                {!client && <td className="py-2 px-3 text-xs text-[#8b949e]">{evt.seq}</td>}
                <td className="py-2 px-3 text-xs text-[#8b949e]">{formatTime(evt.ts)}</td>
                {!client && (
                  <td className="py-2 px-3">
                    <span className="inline-flex items-center px-2 py-1 text-xs rounded-[4px] bg-[#21262d] text-[#8b949e] border border-[#30363d]">
                      {evt.actor.kind}
                    </span>
                  </td>
                )}
                <td className="py-2 px-3 text-sm">{evt.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
