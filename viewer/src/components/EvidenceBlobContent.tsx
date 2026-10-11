import { DiffView } from './DiffView.tsx'
import { MarkdownView } from './MarkdownView.tsx'
import { blobPresentation, payloadPath, payloadSha256 } from './evidenceBlob.ts'

export function EvidenceBlobContent({
  payload,
  blobs,
}: {
  payload: Record<string, unknown>
  blobs?: Record<string, string>
}) {
  const sha = payloadSha256(payload)
  if (!sha) return null

  const blob = blobs?.[sha]
  if (blob === undefined) {
    return <p className="text-sm text-[#8b949e] mb-2">Content not exported</p>
  }

  const kind = blobPresentation(blob, payloadPath(payload))
  return (
    <div className="mb-3">
      <div className="text-xs text-[#8b949e] uppercase tracking-wider mb-1">Content</div>
      {kind === 'diff' && <DiffView text={blob} />}
      {kind === 'markdown' && <MarkdownView text={blob} />}
      {kind === 'plain' && (
        <pre className="text-xs font-mono bg-[#0d1117] p-3 rounded-lg overflow-x-auto border border-[#30363d] whitespace-pre-wrap">
          {blob}
        </pre>
      )}
    </div>
  )
}
