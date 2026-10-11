export function payloadSha256(payload: Record<string, unknown>): string | undefined {
  const v = payload.sha256
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

export function payloadPath(payload: Record<string, unknown>): string | undefined {
  const v = payload.path
  return typeof v === 'string' ? v : undefined
}

export function isUnifiedDiff(text: string): boolean {
  if (text.includes('diff --git')) return true
  return text.split(/\r?\n/).some(line => line.startsWith('@@'))
}

export type BlobPresentation = 'diff' | 'markdown' | 'plain'

export function blobPresentation(text: string, path: string | undefined): BlobPresentation {
  if (isUnifiedDiff(text)) return 'diff'
  if (path?.endsWith('.md')) return 'markdown'
  return 'plain'
}
