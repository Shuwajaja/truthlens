/** Presentation only. Stored criterion statuses and the D34 wire stay unchanged. */
export type DisplayWord = 'TRUE' | 'FALSE' | 'UNKNOWN'

/** HMAC at export is the only pair the loader treats as signature-checked. */
export function exportAuthenticated(doc: {verified: boolean; integrity: string}) {
  return doc.verified === true && doc.integrity === 'hmac'
}

/** ``met`` without that pair is never shown as proven. */
export function criterionWord(status: string, authenticated: boolean): DisplayWord {
  if (!authenticated) return 'UNKNOWN'
  if (status === 'met') return 'TRUE'
  if (status === 'unmet') return 'FALSE'
  return 'UNKNOWN'
}

/**
 * Run documents have no protected audit result. Counts, claims, exit codes
 * and any extra field are ignored so the audit card cannot be inferred.
 */
export function auditWord(_ignored?: unknown): DisplayWord {
  return 'UNKNOWN'
}
