import { describe, expect, it } from 'vitest'
import {
  initialNavigationState,
  MAX_CLOSED_REFERENCES,
  MAX_OPEN_TABS,
  navigationReducer,
  normalizePersistedNavigation,
} from '../src/workspace/navigation-reducer.ts'
import type { NavigationAction, RunReference, WorkspaceTab } from '../src/workspace/navigation-types.ts'

const run = (sourceId: string, runId: string): RunReference => ({ kind: 'run', sourceId, runId })
const open = (ref: RunReference, view: 'overview' | 'timeline' = 'overview'): NavigationAction => ({ type: 'open-run', ref, view })
const openTab = (state = initialNavigationState(), ref = run('source', 'run'), view: 'overview' | 'timeline' = 'overview') => navigationReducer(state, open(ref, view))

describe('navigationReducer', () => {
  it('dedupes by source, target and every renderer including ClaimedVsProven', () => {
    let state = initialNavigationState()
    for (const sourceId of ['source-one', 'source-two']) {
      for (const runId of ['run-one', 'run-two']) {
        for (const view of ['overview', 'claimed-vs-proven', 'timeline', 'agent-story'] as const) {
          const action: NavigationAction = { type: 'open-run', ref: run(sourceId, runId), view }
          state = navigationReducer(navigationReducer(state, action), action)
        }
      }
      const action: NavigationAction = { type: 'open-runs', sourceId }
      state = navigationReducer(navigationReducer(state, action), action)
    }
    expect(state.tabs).toHaveLength(18)
    expect(new Set(state.tabs.map(tab => tab.tabId)).size).toBe(18)
  })

  it('restores an already reopened target at capacity by selecting it', () => {
    let state = openTab()
    state = navigationReducer(state, { type: 'close-tab', tabId: state.activeTabId!, closedAt: 1 })
    state = openTab(state)
    for (let index = 1; index < MAX_OPEN_TABS; index++) state = openTab(state, run('s', String(index)))
    state = navigationReducer(state, { type: 'restore-closed' })
    expect(state.tabs).toHaveLength(MAX_OPEN_TABS)
    expect(state.activeTabId).toBe(state.tabs[0].tabId)
    expect(state.closed).toHaveLength(0)
    expect(state.capacityError).toBeNull()
  })
  it('keeps source identity and tuple boundaries distinct', () => {
    const first = openTab(initialNavigationState(), run('a|b', 'c'))
    const second = openTab(first, run('a', 'b|c'))
    const third = openTab(second, run('other-source', 'c'))
    expect(third.tabs).toHaveLength(3)
    expect(new Set(third.tabs.map(tab => tab.tabId)).size).toBe(3)
  })

  it('focuses an existing reference and gives each view a separate tab', () => {
    const ref = run('source', 'run')
    const first = openTab(initialNavigationState(), ref)
    const focused = openTab(first, ref)
    const otherView = openTab(focused, ref, 'timeline')
    expect(focused.tabs).toHaveLength(1)
    expect(otherView.tabs).toHaveLength(2)
    expect(otherView.activeTabId).toBe(otherView.tabs[1].tabId)
  })

  it('closes the active tab to its next neighbor and then previous, or null', () => {
    let state = initialNavigationState()
    state = openTab(state, run('s', 'one'))
    state = openTab(state, run('s', 'two'))
    state = openTab(state, run('s', 'three'))
    const [one, two, three] = state.tabs
    state = navigationReducer(state, { type: 'select-tab', tabId: two.tabId })
    state = navigationReducer(state, { type: 'close-tab', tabId: two.tabId, closedAt: 1 })
    expect(state.activeTabId).toBe(three.tabId)
    state = navigationReducer(state, { type: 'close-tab', tabId: three.tabId, closedAt: 2 })
    expect(state.activeTabId).toBe(one.tabId)
    state = navigationReducer(state, { type: 'close-tab', tabId: one.tabId, closedAt: 3 })
    expect(state.activeTabId).toBeNull()
  })

  it('preserves pin metadata when closing and restoring', () => {
    let state = openTab()
    const tab = state.tabs[0]
    state = navigationReducer(state, { type: 'toggle-pin', tabId: tab.tabId })
    state = navigationReducer(state, { type: 'close-tab', tabId: tab.tabId, closedAt: 12 })
    state = navigationReducer(state, { type: 'restore-closed' })
    expect(state.tabs[0]).toMatchObject({ tabId: tab.tabId, pinned: true })
    expect(state.activeTabId).toBe(tab.tabId)
  })

  it('rejects opening at 40 tabs without evicting and exposes capacity feedback', () => {
    let state = initialNavigationState()
    for (let index = 0; index < MAX_OPEN_TABS; index++) state = openTab(state, run('source', `run-${index}`))
    const capped = navigationReducer(state, open(run('source', 'extra')))
    expect(capped.tabs).toHaveLength(MAX_OPEN_TABS)
    expect(capped.tabs).toEqual(state.tabs)
    expect(capped.capacityError).toBeTruthy()
  })

  it('rejects restoring at 40 tabs and caps closed references at 20', () => {
    let state = initialNavigationState()
    for (let index = 0; index < MAX_CLOSED_REFERENCES + 1; index++) {
      state = openTab(state, run('source', `closed-${index}`))
      const id = state.activeTabId!
      state = navigationReducer(state, { type: 'close-tab', tabId: id, closedAt: index })
    }
    expect(state.closed).toHaveLength(MAX_CLOSED_REFERENCES)
    expect(state.closed.map(item => item.ref.kind === 'run' ? item.ref.runId : '')).toEqual(
      Array.from({ length: MAX_CLOSED_REFERENCES }, (_, index) => `closed-${MAX_CLOSED_REFERENCES - index}`),
    )
    expect(state.tabs).toHaveLength(0)
    expect(state.capacityError).toBeNull()
    for (let index = 0; index < MAX_OPEN_TABS; index++) state = openTab(state, run('source', `open-${index}`))
    state = navigationReducer(state, { type: 'close-tab', tabId: state.activeTabId!, closedAt: 99 })
    expect(state.tabs).toHaveLength(MAX_OPEN_TABS - 1)
    expect(state.closed).toHaveLength(MAX_CLOSED_REFERENCES)
    expect(state.closed[0]?.ref).toEqual(run('source', `open-${MAX_OPEN_TABS - 1}`))
    state = openTab(state, run('source', 'open-refill'))
    const closedBeforeRejectedRestore = [...state.closed]
    const capped = navigationReducer(state, { type: 'restore-closed' })
    expect(capped.tabs).toHaveLength(MAX_OPEN_TABS)
    expect(capped.closed).toEqual(closedBeforeRejectedRestore)
    expect(capped.capacityError).toBe('open-tabs-limit')
  })

  it('keeps long escaped canonical IDs selectable, pinnable, closable and restorable', () => {
    const ref = run(`${'q"\\'.repeat(170)}zz`, `${'r"\\'.repeat(170)}zz`)
    expect(ref.sourceId).toHaveLength(512)
    expect(ref.runId).toHaveLength(512)
    let state = openTab(initialNavigationState(), ref)
    const tabId = state.activeTabId!
    expect(tabId.length).toBeGreaterThan(512)
    state = openTab(state, run('other', 'other'))
    state = navigationReducer(state, { type: 'select-tab', tabId })
    expect(state.activeTabId).toBe(tabId)
    state = navigationReducer(state, { type: 'toggle-pin', tabId })
    expect(state.tabs.find(tab => tab.tabId === tabId)?.pinned).toBe(true)
    state = navigationReducer(state, { type: 'close-tab', tabId, closedAt: 1 })
    expect(state.closed[0]?.pinned).toBe(true)
    state = navigationReducer(state, { type: 'restore-closed' })
    expect(state.tabs.find(tab => tab.tabId === tabId)?.pinned).toBe(true)
  })

  it('retains valid references even when their sources are unavailable', () => {
    let state = openTab(initialNavigationState(), run('missing-source', 'missing-run'))
    const tab = state.tabs[0]
    const hydrated = normalizePersistedNavigation({ version: 1, tabs: [tab], activeTabId: tab.tabId, closed: [] })
    expect(hydrated?.tabs[0].ref).toEqual(run('missing-source', 'missing-run'))
  })

  it('ignores malformed actions and rejects invalid persisted entries', () => {
    const state = openTab()
    expect(navigationReducer(state, { type: 'select-tab', tabId: 'unknown' })).toEqual(state)
    expect(normalizePersistedNavigation({ version: 1, tabs: [{ tabId: 'bad', view: 'bogus' }], activeTabId: 'bad', closed: [] })).toEqual(initialNavigationState())
    expect(normalizePersistedNavigation({ version: 2, tabs: [], activeTabId: null, closed: [] })).toBeNull()
    expect((state.tabs[0] as WorkspaceTab).tabId).toContain('overview')
  })

  it('rejects persisted arrays beyond their caps instead of slicing trusted state', () => {
    const validTab = openTab().tabs[0]
    expect(normalizePersistedNavigation({ version: 1, tabs: Array(MAX_OPEN_TABS + 1).fill(validTab), activeTabId: validTab.tabId, closed: [] })).toBeNull()
    const validClosed = { ref: run('source', 'closed'), view: 'overview', closedAt: 1, pinned: false }
    expect(normalizePersistedNavigation({ version: 1, tabs: [], activeTabId: null, closed: Array(MAX_CLOSED_REFERENCES + 1).fill(validClosed) })).toBeNull()
  })
})
