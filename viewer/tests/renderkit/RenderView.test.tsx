// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RenderView } from '../../src/renderkit/RenderView.tsx'
import { createRegistry } from '../../src/renderkit/registry.ts'
import type { Renderer, RenderInput } from '../../src/renderkit/types.ts'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const blob: RenderInput = { kind: 'blob', mediaType: 'text/plain', text: 'original raw text' }
const healthy: Renderer = { id: 'healthy', label: 'Healthy', match: () => 1, Component: () => <p>Rendered normally</p> }
const broken: Renderer = { id: 'broken', label: 'Broken', match: () => 1, Component: () => { throw new Error('renderer detail') } }

describe('RenderView', () => {
  it('uses safe raw data by default and for malformed input', () => {
    const { container, rerender } = render(<RenderView input={blob} />)
    expect(container.querySelector('pre')?.textContent).toBe('original raw text')
    rerender(<RenderView input={{ kind: 'event', event: null }} registry={createRegistry([healthy])} />)
    expect(container.querySelector('pre')?.textContent).toContain('"event": null')
    expect(screen.queryByText('Rendered normally')).toBeNull()
  })

  it('renders the selected component', () => {
    render(<RenderView input={blob} registry={createRegistry([healthy])} />)
    expect(screen.getByText('Rendered normally')).toBeTruthy()
  })

  it('contains a renderer error and shows raw data with a neutral note', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(<RenderView input={blob} registry={createRegistry([broken])} />)
    expect(screen.getByText('Could not render; showing raw data')).toBeTruthy()
    expect(container.querySelector('pre')?.textContent).toBe('original raw text')
    expect(container.textContent).not.toContain('renderer detail')
  })

  it('recovers when a different renderer is selected', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(<RenderView input={blob} registry={createRegistry([broken])} />)
    rerender(<RenderView input={blob} registry={createRegistry([healthy])} />)
    expect(screen.getByText('Rendered normally')).toBeTruthy()
    expect(screen.queryByText('Could not render; showing raw data')).toBeNull()
  })

  it('retries the same renderer for new input after an error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const renderer: Renderer = { ...healthy, Component: ({ input }) => {
      if (input.kind !== 'blob' || input.text === 'bad') throw new Error('bad input')
      return <p>{input.text}</p>
    } }
    const registry = createRegistry([renderer])
    const { rerender } = render(<RenderView input={{ ...blob, text: 'bad' }} registry={registry} />)
    expect(screen.getByText('Could not render; showing raw data')).toBeTruthy()
    rerender(<RenderView input={{ ...blob, text: 'recovered' }} registry={registry} />)
    expect(screen.getByText('recovered')).toBeTruthy()
    expect(screen.queryByText('Could not render; showing raw data')).toBeNull()
  })
})
