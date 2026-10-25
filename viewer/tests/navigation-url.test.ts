import { describe, expect, it } from 'vitest'
import { parseWorkspaceUrl, writeWorkspaceUrl } from '../src/workspace/navigation-url.ts'
import type { RunReference, WorkspaceView } from '../src/workspace/navigation-types.ts'

const defaultRef: RunReference = { kind: 'run', sourceId: 'local-fixture', runId: 'run-1' }
const views: WorkspaceView[] = ['overview', 'claimed-vs-proven', 'timeline', 'agent-story']

describe('workspace URL helpers', () => {
  it.each(['', '&view=timeline', '&view=claimed-vs-proven', '&view=unknown'])('uses the catalog before a private document is loaded: %s', suffix => {
    const ref = { kind: 'runs' as const, sourceId: 'reader-workspace' }
    expect(parseWorkspaceUrl(`https://example.test/?filter=kept${suffix}#anchor`, ref)).toMatchObject({
      ref, view: 'runs', explicit: false, malformed: false,
    })
  })
  it.each(views)('binds the legacy %s URL to the supplied default reference', view => {
    expect(parseWorkspaceUrl(`https://example.test/?view=${view}`, defaultRef)).toMatchObject({ ref: defaultRef, view })
  })

  it('maps explicit run and catalog references and does not replace unavailable identities', () => {
    expect(parseWorkspaceUrl('https://example.test/?source=external&run=absent&view=timeline', defaultRef)).toMatchObject({
      ref: { kind: 'run', sourceId: 'external', runId: 'absent' }, view: 'timeline', explicit: true,
    })
    expect(parseWorkspaceUrl('https://example.test/?source=external&view=runs', defaultRef)).toMatchObject({
      ref: { kind: 'runs', sourceId: 'external' }, view: 'runs', explicit: true,
    })
    expect(parseWorkspaceUrl('https://example.test/?source=external&run=&view=overview', defaultRef).ref).toBeNull()
  })

  it('writes navigation fields while preserving other URL components', () => {
    const url = writeWorkspaceUrl('https://example.test/review?keep=yes&view=timeline&old=1#section', {
      ref: defaultRef, view: 'agent-story',
    })
    expect(url.pathname).toBe('/review')
    expect(url.searchParams.get('keep')).toBe('yes')
    expect(url.searchParams.get('old')).toBe('1')
    expect(url.searchParams.get('source')).toBe(defaultRef.sourceId)
    expect(url.searchParams.get('run')).toBe(defaultRef.runId)
    expect(url.searchParams.get('view')).toBe('agent-story')
    expect(url.hash).toBe('#section')
    expect(url.searchParams.has('tab')).toBe(false)
  })
})
