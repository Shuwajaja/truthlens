import type { Card, Criterion, RunDoc } from './run-doc.ts'

const VALID_STATUSES = new Set(['met', 'unmet', 'unverified', 'proposed'])
const CARD_KEYS: Card[] = ['green', 'yellow', 'red', 'gray', 'outline']

/** Card colour rules from src/truthlens/export.py. */
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

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(item => typeof item === 'string')
}

function hasStrings(v: Record<string, unknown>, fields: string[]): boolean {
  return fields.every(field => typeof v[field] === 'string')
}

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0
}

function isRun(v: unknown): boolean {
  return isRecord(v)
    && hasStrings(v, ['run_id', 'project', 'agent', 'command', 'started', 'ledger_last_hash'])
    && (v.finished === null || typeof v.finished === 'string')
    && (v.exit_code === null || (typeof v.exit_code === 'number' && Number.isInteger(v.exit_code)))
    && isCount(v.events)
}

function isClaim(v: unknown): boolean {
  return isRecord(v)
    && hasStrings(v, ['claim_id', 'text'])
    && isStringArray(v.criterion_ids)
    && (v.finding === 'supported' || v.finding === 'claim_unwitnessed')
}

function isArtifact(v: unknown): boolean {
  return isRecord(v) && hasStrings(v, ['artifact_id', 'path', 'sha256', 'provenance'])
    && (v.kind === null || typeof v.kind === 'string')
}

function isEvent(v: unknown): boolean {
  return isRecord(v)
    && isCount(v.seq) && v.seq > 0
    && hasStrings(v, ['id', 'ts', 'type', 'summary', 'hash'])
    && isRecord(v.actor) && hasStrings(v.actor, ['kind', 'id'])
    && isRecord(v.payload)
}

/** Reject incomplete or internally inconsistent run exports before rendering. */
export function validateRunDoc(data: unknown): data is RunDoc {
  if (!isRecord(data)) return false
  if (!((data.integrity === 'hmac' && data.verified === true)
    || (data.integrity === 'hash-only' && data.verified === false))) return false
  if (!isStringArray(data.headline) || typeof data.review_required !== 'boolean') return false
  if (!isRun(data.run)) return false
  if (!Array.isArray(data.claims) || !data.claims.every(isClaim)) return false
  if (!Array.isArray(data.artifacts) || !data.artifacts.every(isArtifact)) return false
  if (!Array.isArray(data.events) || !data.events.every(isEvent)) return false
  if (data.blobs !== undefined
    && (!isRecord(data.blobs) || !Object.values(data.blobs).every(value => typeof value === 'string'))) return false

  const criteria = data.criteria
  if (!Array.isArray(criteria)) return false

  for (const row of criteria) {
    if (!isRecord(row)) return false
    if (!hasStrings(row, ['criterion_id', 'text', 'plain']) || !isStringArray(row.evidence)) return false
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
