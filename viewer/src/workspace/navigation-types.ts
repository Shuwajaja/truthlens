import type { RunDoc } from '../types.ts'

export type WorkspaceView = 'runs' | 'overview' | 'claimed-vs-proven' | 'timeline' | 'agent-story' | 'chain' | 'coverage' | 'gated-actions' | 'changes' | 'compare'
export type RunReference = { kind: 'run'; sourceId: string; runId: string }
export type RunsReference = { kind: 'runs'; sourceId: string }
export type TabReference = RunReference | RunsReference
export type WorkspaceSource = {
  sourceId: string
  label: string
  kind: 'development-fixture' | 'private-reader'
  runs: ReadonlyMap<string, RunDoc>
}
export type WorkspaceTab = { tabId: string; ref: TabReference; view: WorkspaceView; pinned: boolean }
export type ClosedReference = { ref: TabReference; view: WorkspaceView; closedAt: number; pinned: boolean }
export type CapacityError = 'open-tabs-limit'
export type WorkspaceNavigationState = {
  tabs: WorkspaceTab[]
  activeTabId: string | null
  closed: ClosedReference[]
  capacityError: CapacityError | null
}
export type NavigationAction =
  | { type: 'open-run'; ref: RunReference; view: Exclude<WorkspaceView, 'runs'> }
  | { type: 'open-runs'; sourceId: string }
  | { type: 'select-tab'; tabId: string }
  | { type: 'toggle-pin'; tabId: string }
  | { type: 'close-tab'; tabId: string; closedAt: number }
  | { type: 'restore-closed'; index?: number }
