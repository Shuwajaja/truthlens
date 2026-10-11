import type { RunEvent } from '../types.ts'
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
      <div className="space-y-3">
        <p className="text-sm">{evt.summary}</p>
        {evt.payload && Object.keys(evt.payload).length > 0 && (
          <EvidenceBlobContent payload={evt.payload} blobs={blobs} />
        )}
      </div>
    )
  }

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
          <EvidenceBlobContent payload={evt.payload} blobs={blobs} />
          <div className="text-xs text-[#8b949e] uppercase tracking-wider mb-1 mt-3">Payload</div>
          <pre className="text-xs font-mono bg-[#0d1117] p-3 rounded-lg overflow-x-auto border border-[#30363d]">
            {JSON.stringify(evt.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
