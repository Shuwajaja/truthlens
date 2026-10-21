import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { RunDoc } from '../src/types.ts'
import { validateRunDoc } from '../src/validateRunDoc.ts'

const fixture: RunDoc = JSON.parse(readFileSync(new URL('../public/run.json', import.meta.url), 'utf8'))

function changeField(path: string, value: unknown, remove = false): unknown {
  const doc = structuredClone(fixture)
  const keys = path.split('.')
  let parent: object = doc
  for (const key of keys.slice(0, -1)) parent = Reflect.get(parent, key) as object
  const key = keys[keys.length - 1]
  if (remove) Reflect.deleteProperty(parent, key)
  else Reflect.set(parent, key, value)
  return doc
}

const requiredFields = [
  'verified', 'integrity', 'headline', 'review_required', 'run', 'counts', 'criteria', 'claims', 'artifacts', 'events',
  'run.run_id', 'run.project', 'run.agent', 'run.command', 'run.started', 'run.finished',
  'run.exit_code', 'run.ledger_last_hash', 'run.events',
  'counts.green', 'counts.yellow', 'counts.red', 'counts.gray', 'counts.outline',
  'criteria.0.criterion_id', 'criteria.0.text', 'criteria.0.status', 'criteria.0.evidence',
  'criteria.0.claimed', 'criteria.0.card', 'criteria.0.plain',
  'claims.0.claim_id', 'claims.0.text', 'claims.0.criterion_ids', 'claims.0.finding',
  'artifacts.0.artifact_id', 'artifacts.0.path', 'artifacts.0.sha256', 'artifacts.0.kind', 'artifacts.0.provenance',
  'events.0.seq', 'events.0.id', 'events.0.ts', 'events.0.type', 'events.0.actor',
  'events.0.actor.kind', 'events.0.actor.id', 'events.0.summary', 'events.0.hash', 'events.0.payload',
]

describe('validateRunDoc', () => {
  it('accepts the public run.json export', () => {
    expect(validateRunDoc(fixture)).toBe(true)
  })

  it.each([
    [false, 'hash-only', true],
    [true, 'hmac', true],
    [false, 'hmac', false],
    [true, 'hash-only', false],
    [false, 'failed', false],
    [true, 'failed', false],
    [false, 'unknown', false],
  ])('checks verified=%s against integrity=%s', (verified, integrity, accepted) => {
    expect(validateRunDoc({ ...fixture, verified, integrity })).toBe(accepted)
  })

  it('rejects an incomplete document with consistent empty counts', () => {
    expect(validateRunDoc({
      verified: true,
      criteria: [],
      counts: { green: 0, yellow: 0, red: 0, gray: 0, outline: 0 },
    })).toBe(false)
  })

  it.each(requiredFields)('rejects a missing or malformed %s', path => {
    expect(validateRunDoc(changeField(path, undefined, true))).toBe(false)
    expect(validateRunDoc(changeField(path, path === 'events.0.payload' ? [] : {}))).toBe(false)
  })

  it.each([
    ['headline.0', 0],
    ['criteria.0.evidence', [null]],
    ['claims.0.criterion_ids', [0]],
    ['claims.0.finding', 'unknown'],
    ['events.0.seq', 0],
    ['run.events', -1],
    ['run.exit_code', 0.5],
    ['counts.green', 0.5],
    ['blobs', { example: 0 }],
    ['blobs', []],
    ['blobs', null],
  ])('rejects invalid values in %s', (path, value) => {
    expect(validateRunDoc(changeField(path as string, value))).toBe(false)
  })

  it('keeps optional blobs optional', () => {
    expect(validateRunDoc(changeField('blobs', undefined, true))).toBe(true)
  })

  it('accepts a null artifact kind emitted when the optional manifest kind is omitted', () => {
    expect(validateRunDoc(changeField('artifacts.0.kind', null))).toBe(true)
  })

  it('accepts empty collections and nullable run results', () => {
    const doc = structuredClone(fixture)
    doc.headline = []
    doc.criteria = []
    doc.claims = []
    doc.artifacts = []
    doc.events = []
    doc.run.events = 0
    doc.run.finished = null
    doc.run.exit_code = null
    doc.counts = { green: 0, yellow: 0, red: 0, gray: 0, outline: 0 }
    expect(validateRunDoc(doc)).toBe(true)
  })

  it('preserves card and count consistency checks', () => {
    expect(validateRunDoc(changeField('criteria.0.card', 'red'))).toBe(false)
    expect(validateRunDoc(changeField('counts.green', 99))).toBe(false)
    expect(validateRunDoc(changeField('verified', !fixture.verified))).toBe(false)
  })
})
