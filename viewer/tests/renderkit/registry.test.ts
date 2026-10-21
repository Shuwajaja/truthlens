import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createRegistry } from '../../src/renderkit/registry.ts'
import type { Renderer, RenderInput } from '../../src/renderkit/types.ts'
import type { RunDoc } from '../../src/types.ts'

const doc: RunDoc = JSON.parse(readFileSync(new URL('../../public/run.json', import.meta.url), 'utf8'))
const blob: RenderInput = { kind: 'blob', mediaType: 'text/plain', text: 'original text' }

function renderer(id: string, score: number): Renderer {
  return { id, label: id, match: () => score, Component: () => null }
}

describe('renderer registry', () => {
  it('selects the highest positive score without depending on an earlier selection', () => {
    const registry = createRegistry([renderer('low', 1), renderer('high', 9), renderer('middle', 3)])
    expect(registry.select(blob).id).toBe('high')
    expect(registry.select(blob).id).toBe('high')
  })

  it('breaks ties by registration order and snapshots that order', () => {
    const entries = [renderer('first', 5), renderer('second', 5)]
    const registry = createRegistry(entries)
    entries.reverse()
    expect(registry.select(blob).id).toBe('first')
    const listed = registry.listRenderers()
    expect(listed.map(entry => entry.id)).toEqual(['first', 'second', 'raw'])
    listed.reverse()
    expect(registry.listRenderers().map(entry => entry.id)).toEqual(['first', 'second', 'raw'])
  })

  it('uses the raw fallback for an empty registry or zero matches', () => {
    expect(createRegistry([]).select(blob).id).toBe('raw')
    expect(createRegistry([renderer('no-match', 0)]).select(blob).id).toBe('raw')
  })

  it.each([-1, NaN, Infinity, -Infinity])('ignores an invalid match score: %s', score => {
    expect(createRegistry([renderer('invalid', score)]).select(blob).id).toBe('raw')
  })

  it('isolates a throwing matcher and still considers later renderers', () => {
    const broken: Renderer = { ...renderer('broken', 0), match() { throw new Error('bad matcher') } }
    expect(createRegistry([broken]).select(blob).id).toBe('raw')
    expect(createRegistry([broken, renderer('healthy', 2)]).select(blob).id).toBe('healthy')
  })

  it.each([
    null, undefined, 12, 'unknown', [], { kind: 'unknown' },
    { kind: 'blob', mediaType: 'text/plain', text: 12 },
    { kind: 'blob', mediaType: 'text/plain', path: 12, text: 'text' },
    { kind: 'event', event: {} }, { kind: 'events', events: [null] },
    { kind: 'run', doc: {} },
  ])('routes malformed input to raw even when a renderer matches everything: %j', input => {
    expect(createRegistry([renderer('eager', 100)]).select(input).id).toBe('raw')
  })

  it.each<RenderInput>([
    blob, { kind: 'event', event: doc.events[0] },
    { kind: 'events', events: doc.events }, { kind: 'run', doc },
  ])('accepts the $kind input variant and preserves the recorded data', input => {
    const before = structuredClone(input)
    const registry = createRegistry([{ ...renderer('chosen', 1), match: candidate => candidate.kind === input.kind ? 1 : 0 }])
    expect(registry.select(input).id).toBe('chosen')
    expect(input).toEqual(before)
  })
})
