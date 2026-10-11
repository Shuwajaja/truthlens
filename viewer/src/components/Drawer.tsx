import type { Criterion, RunEvent } from '../types.ts'
import type { Lens } from '../lens.ts'
import { EventDetail } from './EventDetail.tsx'

export type DrawerTarget =
  | { kind: 'criterion'; criterion: Criterion; matched: RunEvent[] }
  | { kind: 'event'; event: RunEvent }

export function Drawer({ target, blobs, lens, onClose }: {
  target: DrawerTarget
  blobs?: Record<string, string>
  lens: Lens
  onClose: () => void
}) {
  if (target.kind === 'criterion') {
    const { criterion, matched } = target
    return (
      <>
        <div className="drawer-backdrop" onClick={onClose} />
        <div className="drawer-pane" role="dialog" aria-label="Evidence detail" onKeyDown={(e) => { if (e.key === 'Escape') onClose() }} tabIndex={0}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
            <h3 className="text-base font-medium">{lens === 'client' ? 'Details' : 'Evidence'}</h3>
            <button type="button" className="text-[#8b949e] text-lg leading-none px-2" onClick={onClose} aria-label="Close">&times;</button>
          </div>
          <div className="px-4 py-4">
            <div className="mb-4">
              {lens === 'developer' && (
                <div className="text-xs text-[#8b949e] uppercase tracking-wider mb-1">Criterion</div>
              )}
              <div className="text-sm">{lens === 'client' ? criterion.plain : criterion.text}</div>
              {lens === 'client' && (
                <div className="text-[#8b949e] text-sm mt-1">{criterion.text}</div>
              )}
            </div>
            {matched.length === 0 ? (
              <p className="text-sm text-[#8b949e]">No evidence events for this criterion.</p>
            ) : (
              <div className="space-y-4">
                {matched.map(e => (
                  <EventDetail key={e.id} evt={e} blobs={blobs} lens={lens} />
                ))}
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
          <h3 className="text-base font-medium">{lens === 'client' ? 'Details' : 'Event'}</h3>
          <button type="button" className="text-[#8b949e] text-lg leading-none px-2" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="px-4 py-4">
          <EventDetail evt={event} blobs={blobs} lens={lens} />
        </div>
      </div>
    </>
  )
}
