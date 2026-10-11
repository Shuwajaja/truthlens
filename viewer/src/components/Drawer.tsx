import type { Criterion, RunEvent } from '../types.ts'

export type DrawerTarget =
  | { kind: 'criterion'; criterion: Criterion; matched: RunEvent[] }
  | { kind: 'event'; event: RunEvent }

export function Drawer({ target, onClose }: {
  target: DrawerTarget
  onClose: () => void
}) {
  if (target.kind === 'criterion') {
    const { criterion, matched } = target
    return (
      <>
        <div className="drawer-backdrop" onClick={onClose} />
        <div className="drawer-pane" role="dialog" aria-label="Evidence detail" onKeyDown={(e) => { if (e.key === 'Escape') onClose() }} tabIndex={0}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
            <h3 className="text-base font-medium">Evidence</h3>
            <button type="button" className="text-[#8b949e] text-lg leading-none px-2" onClick={onClose} aria-label="Close">&times;</button>
          </div>
          <div className="px-4 py-4">
            <div className="mb-4">
              <div className="text-xs text-[#8b949e] uppercase tracking-wider mb-1">Criterion</div>
              <div className="text-sm">{criterion.text}</div>
            </div>
            {matched.length === 0 ? (
              <p className="text-sm text-[#8b949e]">No evidence events for this criterion.</p>
            ) : (
              <div className="space-y-4">
                {matched.map(e => renderEventDetail(e))}
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  const { event } = target
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-pane" role="dialog" aria-label="Event detail" onKeyDown={(e) => { if (e.key === 'Escape') onClose() }} tabIndex={0}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
          <h3 className="text-base font-medium">Event</h3>
          <button type="button" className="text-[#8b949e] text-lg leading-none px-2" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="px-4 py-4">
          {renderEventDetail(event)}
        </div>
      </div>
    </>
  )
}

function renderEventDetail(evt: RunEvent) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[100px_1fr] gap-1 text-sm">
        <span className="text-xs text-[#8b949e]">Type</span>
        <span>{evt.type}</span>
        <span className="text-xs text-[#8b949e]">Actor</span>
        <span>{evt.actor.kind} / {evt.actor.id}</span>
        <span className="text-xs text-[#8b949e]">Timestamp</span>
        <span>{evt.ts}</span>
        <span className="text-xs text-[#8b949e]">Hash</span>
        <span className="font-mono text-xs break-all">{evt.hash}</span>
        <span className="text-xs text-[#8b949e]">ID</span>
        <span className="font-mono text-xs break-all">{evt.id}</span>
      </div>
      {evt.payload && Object.keys(evt.payload).length > 0 && (
        <div>
          <div className="text-xs text-[#8b949e] uppercase tracking-wider mb-1">Payload</div>
          <pre className="text-xs font-mono bg-[#0d1117] p-3 rounded-lg overflow-x-auto border border-[#30363d]">
            {JSON.stringify(evt.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}