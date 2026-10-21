import type { RunDoc } from '../types.ts'

/** Select an exported diff body, never JSON that merely quotes a diff marker. */
export function recordedDiff(doc: RunDoc) {
  for (const event of doc.events) {
    const sha = event.payload.sha256
    const text = typeof sha === 'string' ? doc.blobs?.[sha] : undefined
    if (text !== undefined && /^(diff --git |--- [^\n]+\r?\n\+\+\+ [^\n]+\r?\n@@ )/.test(text)) return { event, text }
  }
  return undefined
}

export function recordedTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString().replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC')
}
