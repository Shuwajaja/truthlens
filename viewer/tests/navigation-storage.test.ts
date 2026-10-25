import { describe, expect, it } from 'vitest'
import { initialNavigationState, navigationReducer } from '../src/workspace/navigation-reducer.ts'
import { readNavigation, serializeNavigation, writeNavigation, NAVIGATION_STORAGE_KEY } from '../src/workspace/navigation-storage.ts'

const openRun = () => navigationReducer(initialNavigationState(), {
  type: 'open-run', ref: { kind: 'run', sourceId: 'local-fixture', runId: 'run-1' }, view: 'overview',
})

function memoryStorage(seed?: string): Storage {
  let value = seed ?? null
  return {
    get length() { return value === null ? 0 : 1 },
    clear() { value = null },
    getItem(key) { return key === NAVIGATION_STORAGE_KEY ? value : null },
    key() { return null },
    removeItem() { value = null },
    setItem(_key, next) { value = next },
  }
}

describe('navigation storage', () => {
  it('binds metadata to one workspace without creating unbounded storage keys', () => {
    const storage = memoryStorage()
    const state = openRun()
    expect(writeNavigation(storage, state, 'reader-one').status).toBe('saved')
    expect(readNavigation(storage, 'reader-one').state).toEqual(state)
    expect(readNavigation(storage, 'reader-two').state).toEqual(initialNavigationState())
    expect(readNavigation(storage, 'reader-two').status).toBe('invalid')
    expect(writeNavigation(storage, state, 'reader-two').status).toBe('saved')
    expect(storage.length).toBe(1)
    expect(readNavigation(storage, 'reader-one').state.tabs).toHaveLength(0)
  })

  it('does not attribute legacy unscoped metadata to a connected workspace', () => {
    expect(readNavigation(memoryStorage(serializeNavigation(openRun())), 'reader').status).toBe('invalid')
  })
  it('round trips only allowlisted metadata', () => {
    const state = openRun()
    const enriched = { ...state, tabs: state.tabs.map(tab => ({ ...tab, evidence: 'private content', runDoc: { secret: true } })) }
    const serialized = serializeNavigation(enriched as typeof state)
    expect(serialized).not.toContain('private content')
    expect(serialized).not.toContain('runDoc')
    const result = readNavigation(memoryStorage(serialized))
    expect(result.status).toBe('saved')
    expect(result.state).toEqual(state)
  })

  it('handles missing, malformed and oversized values without trusting partial records', () => {
    expect(readNavigation(memoryStorage()).status).toBe('empty')
    expect(readNavigation(memoryStorage('{')).status).toBe('invalid')
    expect(readNavigation(memoryStorage(' '.repeat(65 * 1024))).status).toBe('invalid')
  })

  it('reports memory-only status when storage access throws', () => {
    const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('quota') } } as unknown as Storage
    expect(readNavigation(blocked).status).toBe('memory-only')
    expect(writeNavigation(blocked, openRun()).status).toBe('memory-only')
  })
})
