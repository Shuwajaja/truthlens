// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RenderView } from '../../src/renderkit/RenderView.tsx'
import { createRegistry, defaultRegistry } from '../../src/renderkit/registry.ts'
import type { Renderer } from '../../src/renderkit/types.ts'
import type { RunDoc } from '../../src/types.ts'
import publicRun from '../../public/run.json'

const doc = publicRun as RunDoc
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('registered existing views', () => {
  it.each([
    ['diff --git a/a b/a\n+line', 'report.md', 'text/plain', 'diff'],
    ['@@ -1 +1 @@\n-old\n+new', 'report.md', 'text/plain', 'diff'],
    ['# Recorded Markdown', 'report.md', 'text/plain', 'markdown'],
    ['# Recorded Markdown', undefined, 'text/markdown', 'markdown'],
    ['+new', undefined, 'text/x-diff', 'diff'],
    ['plain <script>text</script>', 'notes.txt', 'text/plain', 'plain-text'],
    ['{"status":"unverified"}', 'notes.json', 'text/plain', 'plain-text'],
    ['unknown media', undefined, 'application/octet-stream', 'raw'],
  ])('selects %s / %s / %s as %s', (text, path, mediaType, id) => {
    expect(defaultRegistry.select({ kind: 'blob', text, path, mediaType }).id).toBe(id)
  })

  it.each(['client', 'developer'] as const)('keeps timeline sorting and exact event drawer targets in the %s lens', lens => {
    const onOpenDrawer = vi.fn()
    const events = [...doc.events].reverse()
    const before = structuredClone(events)
    render(<RenderView input={{ kind: 'events', events }} context={{ lens, onOpenDrawer }} />)
    const first=screen.getAllByRole('button',{name:/^Event #/})[0]
    expect(first.getAttribute('aria-label')).toContain(doc.events[0].summary)
    expect(screen.queryByText(`#${doc.events[0].seq} · ${doc.events[0].type} · ${doc.events[0].actor.kind} / ${doc.events[0].actor.id}`)!==null).toBe(lens==='developer')
    fireEvent.click(first)
    expect(onOpenDrawer).toHaveBeenCalledWith({ kind: 'event', event: doc.events[0] })
    expect(events).toEqual(before)
  })

  it('passes event detail its exported blobs and lens without changing recorded fields', () => {
    const event = doc.events.find(event => typeof event.payload.sha256 === 'string' && doc.blobs?.[event.payload.sha256]?.startsWith('diff --git'))!
    const before = structuredClone(event)
    render(<RenderView input={{ kind: 'event', event }} context={{ lens: 'developer', blobs: doc.blobs }} />)
    expect(screen.getByText('Type')).toBeTruthy()
    expect(screen.getByText(event.id)).toBeTruthy()
    expect(screen.getByText('diff --git a/dev/null b/index.html')).toBeTruthy()
    expect(event).toEqual(before)
  })

  it('passes presentation context to a custom renderer and recovers after context changes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const renderer: Renderer = {
      id: 'context', label: 'Context', match: () => 1,
      Component: ({ context }) => {
        if (context?.lens !== 'developer') throw new Error('requires developer lens')
        return <p>Developer context received</p>
      },
    }
    const registry = createRegistry([renderer])
    const input = { kind: 'blob' as const, mediaType: 'text/plain', text: 'original' }
    const { rerender } = render(<RenderView input={input} registry={registry} context={{ lens: 'client' }} />)
    expect(screen.getByText('Could not render; showing raw data')).toBeTruthy()
    rerender(<RenderView input={input} registry={registry} context={{ lens: 'developer' }} />)
    expect(screen.getByText('Developer context received')).toBeTruthy()
  })
})
