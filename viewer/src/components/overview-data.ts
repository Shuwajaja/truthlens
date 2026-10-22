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

const localTime=new Intl.DateTimeFormat('de-DE',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',fractionalSecondDigits:3,timeZoneName:'short',hour12:false})
export function recordedTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : localTime.format(date)
}

export function recordedDuration(start: string, end: string | null) {
  const ms=end===null?NaN:Date.parse(end)-Date.parse(start)
  return !Number.isFinite(ms)||ms<0?'Nicht exportiert':`${new Intl.NumberFormat('de-DE',{maximumFractionDigits:3}).format(ms/1000)} s`
}
