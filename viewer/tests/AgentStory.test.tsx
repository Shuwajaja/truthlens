// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import { RenderView } from '../src/renderkit/RenderView.tsx'
import type { DrawerTarget } from '../src/components/Drawer.tsx'
import type { RunDoc } from '../src/types.ts'
import { claimOnlyRun } from './fixtures/claimOnlyRun.ts'
import publicRun from '../public/run.json'

const doc = publicRun as RunDoc
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })

describe('Agent Story', () => {
  it('opens the exact recorded event from the new navigation entry', async () => {
    localStorage.setItem('tl-lens', 'developer')
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => structuredClone(doc) })))
    render(<App />)
    await screen.findByRole('heading', { level: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Agent Story', exact: true }))
    const main = within(screen.getByRole('main'))
    expect(main.getByRole('heading', { name: 'Agent Story' })).toBeTruthy()
    expect(main.getByText("This browser checks the file's internal consistency only; it does not verify signatures.")).toBeTruthy()
    expect(main.getByText(/Review required/)).toBeTruthy()
    fireEvent.click(main.getByRole('button', { name: 'View event #1', exact: true }))
    expect(within(screen.getByRole('dialog', { name: 'Event detail' })).getByText(doc.events[0].id)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each(['client', 'developer'] as const)('shows the real demo story and real event links in the %s lens', lens => {
    const onOpenDrawer = vi.fn<(target: DrawerTarget) => void>()
    const { asFragment } = render(<RenderView input={{ kind: 'run', doc }} context={{ lens, onOpenDrawer }} />)
    expect(screen.getByRole('heading', { name: 'Agent Story' })).toBeTruthy()
    const links = within(screen.getByRole('list', { name: 'Recorded story' })).getAllByRole('button')
    expect(links).toHaveLength(12)
    for (const button of links) {
      fireEvent.click(button)
      const target = onOpenDrawer.mock.calls.at(-1)![0]
      expect(target.kind).toBe('event')
      if (target.kind === 'event') expect(doc.events).toContain(target.event)
    }
    expect(screen.queryByText(doc.events[0].id, { exact: false }) !== null).toBe(lens === 'developer')
    expect(asFragment()).toMatchSnapshot()
  })

  it('keeps a claim-only run claimed, with no proof or invented start/finish', () => {
    const { container, asFragment } = render(<RenderView input={{ kind: 'run', doc: claimOnlyRun() }} />)
    const story = screen.getByRole('list', { name: 'Recorded story' })
    expect(within(story).getAllByRole('button')).toHaveLength(1)
    expect(screen.getByText('Agent claimed')).toBeTruthy()
    expect(screen.getByText('claimed', { exact: true })).toBeTruthy()
    expect(screen.getByText('claim_unwitnessed')).toBeTruthy()
    expect(container.querySelector('[class*="3fb950"]')).toBeNull()
    expect(screen.queryByText('Agent started')).toBeNull()
    expect(screen.queryByText('Agent finished')).toBeNull()
    expect(screen.getByText(/Review required/)).toBeTruthy()
    expect(asFragment()).toMatchSnapshot()
  })

  it('keeps even a supported claim yellow and limits green to met criteria', () => {
    const { container } = render(<RenderView input={{ kind: 'run', doc }} />)
    const claim = screen.getByText('supported').closest('li')!
    expect(claim.querySelector('[class*="d29922"]')).toBeTruthy()
    expect(claim.querySelector('[class*="3fb950"]')).toBeNull()
    for (const green of container.querySelectorAll('[class*="3fb950"]')) expect(green.textContent).toBe('met')
    expect(container.querySelectorAll('[class*="3fb950"]').length).toBeGreaterThan(0)
  })

  it('shows Review required and an empty state without inventing a linked step', () => {
    const empty = claimOnlyRun()
    empty.events = []; empty.run.events = 0; empty.criteria = []; empty.claims = []
    empty.counts = { green: 0, yellow: 0, red: 0, gray: 0, outline: 0 }
    render(<RenderView input={{ kind: 'run', doc: empty }} />)
    expect(screen.getByText(/Review required/)).toBeTruthy()
    expect(screen.getByText('No recorded story events.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('escapes recorded task text', () => {
    const changed = structuredClone(doc)
    const event = changed.events.find(event => event.type === 'requirement.recorded')!
    event.payload.text = '<script>untrusted task</script>'
    const { container } = render(<RenderView input={{ kind: 'run', doc: changed }} />)
    expect(screen.getByText('<script>untrusted task</script>')).toBeTruthy()
    expect(container.querySelector('script')).toBeNull()
  })
})
