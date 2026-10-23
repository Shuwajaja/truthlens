import type {
  CapacityError, ClosedReference, NavigationAction, RunsReference,
  TabReference, WorkspaceNavigationState, WorkspaceTab, WorkspaceView,
} from './navigation-types.ts'

export const MAX_OPEN_TABS = 40
export const MAX_CLOSED_REFERENCES = 20
export const MAX_IDENTIFIER_LENGTH = 512
export const MAX_TAB_ID_LENGTH = MAX_IDENTIFIER_LENGTH * 12 + 128
export const MAX_SERIALIZED_BYTES = 64 * 1024

const views = new Set<WorkspaceView>(['runs', 'overview', 'claimed-vs-proven', 'timeline', 'agent-story'])

export function isWorkspaceView(value: unknown): value is WorkspaceView {
  return typeof value === 'string' && views.has(value as WorkspaceView)
}

function isRunView(value: unknown): value is Exclude<WorkspaceView, 'runs'> {
  return isWorkspaceView(value) && value !== 'runs'
}

export function isValidIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH
    && !Array.from(value).some(character => {
      const code = character.codePointAt(0) ?? 0
      return code <= 0x1f || code === 0x7f
    })
}

function isValidTabId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_TAB_ID_LENGTH
}

export function isTabReference(value: unknown): value is TabReference {
  if (!value || typeof value !== 'object') return false
  const ref = value as Record<string, unknown>
  if (ref.kind === 'run') return isValidIdentifier(ref.sourceId) && isValidIdentifier(ref.runId)
  if (ref.kind === 'runs') return isValidIdentifier(ref.sourceId)
  return false
}

/** Stable, separator-safe identity encoded as a JSON tuple. */
export function workspaceTabId(ref: TabReference, view: WorkspaceView): string {
  return ref.kind === 'run'
    ? JSON.stringify(['truthlens-tab-v1', ref.sourceId, 'run', ref.runId, view])
    : JSON.stringify(['truthlens-tab-v1', ref.sourceId, 'runs', null, 'runs'])
}

export function createWorkspaceTab(ref: TabReference, view: WorkspaceView, pinned = false): WorkspaceTab {
  return { tabId: workspaceTabId(ref, view), ref: { ...ref }, view, pinned }
}

export function initialNavigationState(): WorkspaceNavigationState {
  return { tabs: [], activeTabId: null, closed: [], capacityError: null }
}

function withError(state: WorkspaceNavigationState, capacityError: CapacityError): WorkspaceNavigationState {
  return { ...state, capacityError }
}

function validAction(action: NavigationAction): boolean {
  if (!action || typeof action !== 'object') return false
  switch (action.type) {
    case 'open-run': return isTabReference(action.ref) && action.ref.kind === 'run' && isRunView(action.view)
    case 'open-runs': return isValidIdentifier(action.sourceId)
    case 'select-tab': case 'toggle-pin': return isValidTabId(action.tabId)
    case 'close-tab': return isValidTabId(action.tabId) && Number.isSafeInteger(action.closedAt) && action.closedAt >= 0
    case 'restore-closed': return action.index === undefined || (Number.isSafeInteger(action.index) && action.index >= 0)
    default: return false
  }
}

function tabForAction(action: Extract<NavigationAction, { type: 'open-run' | 'open-runs' }>): WorkspaceTab {
  if (action.type === 'open-run') return createWorkspaceTab(action.ref, action.view)
  const ref: RunsReference = { kind: 'runs', sourceId: action.sourceId }
  return createWorkspaceTab(ref, 'runs')
}

export function navigationReducer(state: WorkspaceNavigationState, action: NavigationAction): WorkspaceNavigationState {
  if (!state || !validAction(action)) return state
  if (action.type === 'open-run' || action.type === 'open-runs') {
    const tab = tabForAction(action)
    const existing = state.tabs.find(candidate => candidate.tabId === tab.tabId)
    if (existing) return { ...state, activeTabId: existing.tabId, capacityError: null }
    if (state.tabs.length >= MAX_OPEN_TABS) return withError(state, 'open-tabs-limit')
    return { ...state, tabs: [...state.tabs, tab], activeTabId: tab.tabId, capacityError: null }
  }
  if (action.type === 'select-tab') {
    if (!state.tabs.some(tab => tab.tabId === action.tabId)) return state
    return { ...state, activeTabId: action.tabId, capacityError: null }
  }
  if (action.type === 'toggle-pin') {
    if (!state.tabs.some(tab => tab.tabId === action.tabId)) return state
    return { ...state, tabs: state.tabs.map(tab => tab.tabId === action.tabId ? { ...tab, pinned: !tab.pinned } : tab), capacityError: null }
  }
  if (action.type === 'close-tab') {
    const index = state.tabs.findIndex(tab => tab.tabId === action.tabId)
    if (index < 0) return state
    const [tab] = state.tabs.slice(index, index + 1)
    const tabs = state.tabs.filter(candidate => candidate.tabId !== action.tabId)
    const activeTabId = state.activeTabId === action.tabId
      ? (tabs[index]?.tabId ?? tabs[index - 1]?.tabId ?? null)
      : state.activeTabId
    const closed: ClosedReference[] = [
      { ref: { ...tab.ref }, view: tab.view, closedAt: action.closedAt, pinned: tab.pinned },
      ...state.closed,
    ].slice(0, MAX_CLOSED_REFERENCES)
    return { tabs, activeTabId, closed, capacityError: null }
  }
  const index = action.index ?? 0
  const closedRef = state.closed[index]
  if (!closedRef) return state
  const tab = createWorkspaceTab(closedRef.ref, closedRef.view, closedRef.pinned)
  const duplicate = state.tabs.find(candidate => candidate.tabId === tab.tabId)
  if (duplicate) return { ...state, activeTabId: duplicate.tabId, closed: state.closed.filter((_, i) => i !== index), capacityError: null }
  if (state.tabs.length >= MAX_OPEN_TABS) return withError(state, 'open-tabs-limit')
  return {
    ...state,
    tabs: [...state.tabs, tab], activeTabId: tab.tabId,
    closed: state.closed.filter((_, i) => i !== index), capacityError: null,
  }
}

function normalizeRef(value: unknown): TabReference | null {
  if (!isTabReference(value)) return null
  return value.kind === 'run'
    ? { kind: 'run', sourceId: value.sourceId, runId: value.runId }
    : { kind: 'runs', sourceId: value.sourceId }
}

function normalizeTab(value: unknown): WorkspaceTab | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Record<string, unknown>
  const ref = normalizeRef(entry.ref)
  if (!ref || !isWorkspaceView(entry.view) || typeof entry.pinned !== 'boolean') return null
  if ((ref.kind === 'runs') !== (entry.view === 'runs')) return null
  const tab = createWorkspaceTab(ref, entry.view, entry.pinned)
  return entry.tabId === tab.tabId ? tab : null
}

/** Validates and allowlists persisted navigation metadata. Invalid individual records are dropped. */
export function normalizePersistedNavigation(value: unknown): WorkspaceNavigationState | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (record.version !== 1 || !Array.isArray(record.tabs) || !Array.isArray(record.closed)) return null
  if (record.tabs.length > MAX_OPEN_TABS || record.closed.length > MAX_CLOSED_REFERENCES) return null
  const tabs: WorkspaceTab[] = []
  const seen = new Set<string>()
  for (const item of record.tabs) {
    const tab = normalizeTab(item)
    if (!tab || seen.has(tab.tabId)) continue
    tabs.push(tab)
    seen.add(tab.tabId)
  }
  const closed: ClosedReference[] = []
  for (const item of record.closed) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>
    const ref = normalizeRef(entry.ref)
    if (!ref || !isWorkspaceView(entry.view) || (ref.kind === 'runs') !== (entry.view === 'runs')) continue
    if (!Number.isSafeInteger(entry.closedAt) || (entry.closedAt as number) < 0 || typeof entry.pinned !== 'boolean') continue
    closed.push({ ref, view: entry.view, closedAt: entry.closedAt as number, pinned: entry.pinned })
  }
  const activeTabId = typeof record.activeTabId === 'string' && seen.has(record.activeTabId) ? record.activeTabId : null
  return { tabs, activeTabId, closed, capacityError: null }
}
