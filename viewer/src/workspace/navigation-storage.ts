import {
  initialNavigationState, isValidIdentifier, MAX_SERIALIZED_BYTES, normalizePersistedNavigation,
} from './navigation-reducer.ts'
import type { WorkspaceNavigationState } from './navigation-types.ts'

export const NAVIGATION_STORAGE_KEY = 'truthlens.workspace-navigation.v1'
export type NavigationStorageStatus = 'saved' | 'empty' | 'invalid' | 'memory-only'
export type NavigationStorageRead = { state: WorkspaceNavigationState; status: NavigationStorageStatus }
export type NavigationStorageWrite = { status: 'saved' | 'memory-only'; error?: 'unavailable' | 'quota-or-security' | 'invalid-state' }

function availableStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage
  try { return globalThis.localStorage ?? null } catch { return null }
}

export function serializeNavigation(state: WorkspaceNavigationState, workspaceId?: string): string {
  if (workspaceId !== undefined && !isValidIdentifier(workspaceId)) throw new TypeError('Invalid workspace identity')
  const normalized = normalizePersistedNavigation({
    version: 1, tabs: state.tabs, activeTabId: state.activeTabId, closed: state.closed,
  })
  if (!normalized) throw new TypeError('Invalid workspace navigation state')
  const value = JSON.stringify({
    version: 1,
    ...(workspaceId === undefined ? {} : { workspaceId }),
    tabs: normalized.tabs.map(({ tabId, ref, view, pinned }) => ({ tabId, ref, view, pinned })),
    activeTabId: normalized.activeTabId,
    closed: normalized.closed.map(({ ref, view, closedAt, pinned }) => ({ ref, view, closedAt, pinned })),
  })
  if (new TextEncoder().encode(value).byteLength > MAX_SERIALIZED_BYTES) throw new RangeError('Workspace navigation exceeds storage limit')
  return value
}

export function readNavigation(storage?: Storage | null, workspaceId?: string): NavigationStorageRead {
  const target = availableStorage(storage)
  if (!target) return { state: initialNavigationState(), status: 'memory-only' }
  let raw: string | null
  try {
    raw = target.getItem(NAVIGATION_STORAGE_KEY)
  } catch {
    return { state: initialNavigationState(), status: 'memory-only' }
  }
  if (raw === null) return { state: initialNavigationState(), status: 'empty' }
  if (new TextEncoder().encode(raw).byteLength > MAX_SERIALIZED_BYTES) return { state: initialNavigationState(), status: 'invalid' }
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || (value as Record<string, unknown>).workspaceId !== workspaceId
      || (workspaceId !== undefined && !isValidIdentifier(workspaceId))) {
      return { state: initialNavigationState(), status: 'invalid' }
    }
    const state = normalizePersistedNavigation(value)
    return state ? { state, status: 'saved' } : { state: initialNavigationState(), status: 'invalid' }
  } catch {
    return { state: initialNavigationState(), status: 'invalid' }
  }
}

export function writeNavigation(storage: Storage | null | undefined, state: WorkspaceNavigationState, workspaceId?: string): NavigationStorageWrite {
  const target = availableStorage(storage)
  if (!target) return { status: 'memory-only', error: 'unavailable' }
  try {
    target.setItem(NAVIGATION_STORAGE_KEY, serializeNavigation(state, workspaceId))
    return { status: 'saved' }
  } catch (error) {
    return { status: 'memory-only', error: error instanceof RangeError || error instanceof TypeError ? 'invalid-state' : 'quota-or-security' }
  }
}
