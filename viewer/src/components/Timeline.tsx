import { recordedTime } from './overview-data.ts'
import type { RunEvent } from '../types.ts'
import type { Lens } from '../lens.ts'
import type { DrawerTarget } from './Drawer.tsx'


export function Timeline({ events, lens, onOpenDrawer }: {
  events: readonly RunEvent[]
  lens: Lens
  onOpenDrawer: (t: DrawerTarget) => void
}) {
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  const client = lens === 'client'

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Timeline</h1>

      <div className="w-full overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
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
                className="timeline-row border-b border-border"
                onClick={() => onOpenDrawer({ kind: 'event', event: evt })}
              >
                {!client && <td className="py-2 px-3 text-xs text-muted-foreground">{evt.seq}</td>}
                <td className="py-2 px-3 text-xs text-muted-foreground">{recordedTime(evt.ts)}</td>
                {!client && (
                  <td className="py-2 px-3">
                    <span className="inline-flex items-center px-2 py-1 text-xs rounded-[4px] bg-secondary text-muted-foreground border border-border">
                      {evt.actor.kind}
                    </span>
                  </td>
                )}
                <td className="py-2 px-3 text-sm"><button type="button" className="text-left underline decoration-transparent hover:decoration-current" onClick={e => { e.stopPropagation(); onOpenDrawer({ kind: 'event', event: evt }) }}>{evt.summary}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
