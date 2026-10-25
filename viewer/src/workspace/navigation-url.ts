import { isValidIdentifier, isWorkspaceView, MAX_IDENTIFIER_LENGTH } from './navigation-reducer.ts'
import type { RunReference, TabReference, WorkspaceView } from './navigation-types.ts'

export type ParsedWorkspaceUrl = {
  ref: TabReference | null
  view: WorkspaceView
  explicit: boolean
  malformed: boolean
}

function parseUrl(input: string | URL): URL {
  return input instanceof URL ? new URL(input.href) : new URL(input, 'http://truthlens.local')
}

function boundedParam(url: URL, key: string): string | null {
  const value = url.searchParams.get(key)
  return value !== null && value.length <= MAX_IDENTIFIER_LENGTH ? value : null
}

/** Parses a navigation target only. It never looks up or fetches a source. */
export function parseWorkspaceUrl(input: string | URL, defaultRef?: TabReference): ParsedWorkspaceUrl {
  const url = parseUrl(input)
  const params = url.searchParams
  const hasSource = params.has('source')
  const hasRun = params.has('run')
  const explicit = hasSource || hasRun
  const rawView = params.get('view')
  const view: WorkspaceView = isWorkspaceView(rawView) ? rawView : 'overview'

  if (explicit) {
    const sourceId = boundedParam(url, 'source')
    const runId = boundedParam(url, 'run')
    if (!isValidIdentifier(sourceId)) return { ref: null, view, explicit: true, malformed: true }
    if (hasRun) {
      if (!isValidIdentifier(runId) || view === 'runs') return { ref: null, view, explicit: true, malformed: true }
      const ref: RunReference = { kind: 'run', sourceId, runId }
      return { ref, view, explicit: true, malformed: false }
    }
    if (view !== 'runs') return { ref: null, view, explicit: true, malformed: true }
    return { ref: { kind: 'runs', sourceId }, view: 'runs', explicit: true, malformed: false }
  }

  if (!defaultRef) return { ref: null, view, explicit: false, malformed: false }
  // A renderer-only legacy URL cannot select a document that has not been supplied.
  if (defaultRef.kind === 'runs') return { ref: { ...defaultRef }, view: 'runs', explicit: false, malformed: false }
  if (view === 'runs' || rawView === null) {
    return { ref: { kind: 'runs', sourceId: defaultRef.sourceId }, view:'runs', explicit: false, malformed: false }
  }
  return { ref: { ...defaultRef }, view, explicit: false, malformed: false }
}

export function writeWorkspaceUrl(input: string | URL, target: { ref: TabReference; view: WorkspaceView }): URL {
  const url = parseUrl(input)
  url.searchParams.set('source', target.ref.sourceId)
  if (target.ref.kind === 'run') url.searchParams.set('run', target.ref.runId)
  else url.searchParams.delete('run')
  url.searchParams.set('view', target.ref.kind === 'runs' ? 'runs' : target.view)
  url.searchParams.delete('tab')
  return url
}
