import { RenderView } from '../renderkit/RenderView.tsx'
import { payloadPath, payloadSha256 } from './evidenceBlob.ts'

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
    return <p className="text-sm text-2 mb-2">Content not exported</p>
  }

  return (
    <div className="mb-3">
      <div className="text-xs text-2 uppercase tracking-wider mb-1">Content</div>
      <RenderView input={{ kind: 'blob', mediaType: 'text/plain', path: payloadPath(payload), text: blob }} />
    </div>
  )
}
