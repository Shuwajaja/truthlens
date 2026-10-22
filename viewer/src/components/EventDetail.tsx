import type { RunEvent } from '../types.ts'
import { recordedTime } from './overview-data.ts'
import type { Lens } from '../lens.ts'
import { EvidenceBlobContent } from './EvidenceBlobContent.tsx'

export function EventDetail({
  evt,
  blobs,
  lens,
}: {
  evt: RunEvent
  blobs?: Record<string, string>
  lens: Lens
}) {
  if (lens === 'client') {
    return (
      <div className="space-y-4">
        <p className="text-sm">{evt.summary}</p>
        {evt.payload && Object.keys(evt.payload).length > 0 && (
          <EvidenceBlobContent payload={evt.payload} blobs={blobs} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="developer-only"><p className="developer-label text-xs mb-2">Developer details</p><div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
        <span className="text-xs text-2">Type</span>
        <span>{evt.type}</span>
        <span className="text-xs text-2">Actor</span>
        <span>{evt.actor.kind} / {evt.actor.id}</span>
        <span className="text-xs text-2">Timestamp</span>
        <time dateTime={evt.ts}>{recordedTime(evt.ts)}</time>
        <span className="text-xs text-2">Hash</span>
        <span className="font-mono text-xs break-all">{evt.hash}</span>
        <span className="text-xs text-2">ID</span>
        <span className="font-mono text-xs break-all">{evt.id}</span>
      </div>
      </div>
      {evt.payload && Object.keys(evt.payload).length > 0 && (
        <div className="developer-only">
          <EvidenceBlobContent payload={evt.payload} blobs={blobs} />
          <div className="text-xs text-2 uppercase tracking-wider mb-2 mt-4"><span className="developer-label">Developer</span> · Event data</div>
          <pre tabIndex={0} className="text-xs font-mono bg-bg p-4 rounded-lg overflow-x-auto border border-border">
            {JSON.stringify(evt.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
