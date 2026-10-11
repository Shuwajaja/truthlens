import type { Card, Criterion, RunDoc } from './types.ts'

const VALID_STATUSES = new Set(['met', 'unmet', 'unverified', 'proposed'])
const CARD_KEYS: Card[] = ['green', 'yellow', 'red', 'gray', 'outline']

/** Card colour rules from src/truthlens/export.py (must match a verified export). */
function expectedCard(c: Pick<Criterion, 'status' | 'claimed'>): Card {
  if (c.status === 'met') return 'green'
  if (c.status === 'unmet') return 'red'
  if (c.status === 'proposed') return 'outline'
  if (c.claimed) return 'yellow'
  return 'gray'
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Fail-closed: only docs that match a verified export shape and internal consistency are trusted. */
export function validateRunDoc(data: unknown): data is RunDoc {
  if (!isRecord(data)) return false
  if (data.verified !== true) return false

  const criteria = data.criteria
  if (!Array.isArray(criteria)) return false

  for (const row of criteria) {
    if (!isRecord(row)) return false
    const status = row.status
    if (typeof status !== 'string' || !VALID_STATUSES.has(status)) return false
    if (typeof row.claimed !== 'boolean') return false
    if (typeof row.card !== 'string') return false
    if (row.card !== expectedCard({ status, claimed: row.claimed })) return false
  }

  const counts = data.counts
  if (!isRecord(counts)) return false
  for (const key of CARD_KEYS) {
    const n = counts[key]
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) return false
    const actual = criteria.filter(
      (c) => isRecord(c) && c.card === key,
    ).length
    if (n !== actual) return false
  }

  return true
}
