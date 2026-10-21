// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RawFallback } from '../../src/renderkit/RawFallback.tsx'

afterEach(cleanup)

describe('safe raw fallback', () => {
  it('escapes markup and pretty-prints JSON text', () => {
    const input = { kind: 'blob', mediaType: 'application/json', text: '{"status":"unverified","text":"<script>alert(1)</script>"}' }
    const { container, asFragment } = render(<RawFallback input={input} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('pre')?.textContent).toBe(`{
  "status": "unverified",
  "text": "<script>alert(1)</script>"
}`)
    expect(asFragment()).toMatchSnapshot()
  })

  it('renders plain text as text, including HTML-looking content', () => {
    const { container, asFragment } = render(<RawFallback input={{ kind: 'blob', mediaType: 'text/plain', text: '<img src=x onerror=alert(1)> & text' }} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('pre')?.textContent).toBe('<img src=x onerror=alert(1)> & text')
    expect(asFragment()).toMatchSnapshot()
  })

  it('shows the whole unknown object without inventing a presentation', () => {
    const { asFragment } = render(<RawFallback input={{ kind: 'unknown', values: [false, 0, null] }} />)
    expect(asFragment()).toMatchSnapshot()
  })

  it.each(['x', '🙂'])('caps the UTF-8 output at 200 KiB for %s content', value => {
    const text = value.repeat(300_000)
    const { container } = render(<RawFallback input={{ kind: 'blob', mediaType: 'text/plain', text }} />)
    const output = container.querySelector('pre')?.textContent ?? ''
    expect(output.length).toBeGreaterThan(0)
    expect(new TextEncoder().encode(output).length).toBeLessThanOrEqual(200 * 1024)
    expect(output).not.toContain('\uFFFD')
    expect(container.textContent).toContain('Truncated raw preview')
  })

  it('handles cycles and non-JSON values without throwing', () => {
    const value: Record<string, unknown> = { big: 12n, missing: undefined }
    value.self = value
    const { container } = render(<RawFallback input={value} />)
    expect(container.textContent).toContain('12n')
    expect(container.textContent).toContain('[Circular]')
  })

  it('does not confuse shared objects with cycles', () => {
    const child = { recorded: 'unmet' }
    const { container } = render(<RawFallback input={{ first: child, second: child }} />)
    expect(container.textContent).not.toContain('[Circular]')
    expect(container.querySelector('pre')?.textContent).toBe(JSON.stringify({ first: child, second: child }, null, 2))
  })

  it('does not execute getters or toJSON functions while making the preview', () => {
    const value = { toJSON() { throw new Error('must not execute') } }
    Object.defineProperty(value, 'accessor', { enumerable: true, get() { throw new Error('must not read') } })
    const { container } = render(<RawFallback input={value} />)
    expect(container.textContent).toContain('[Accessor]')
    expect(container.textContent).toContain('[Function]')
  })

  it.each(['kind', 'text'])('does not execute a getter on the envelope field %s', field => {
    let reads = 0
    const input = { kind: 'blob', mediaType: 'text/plain', text: 'recorded text' }
    Object.defineProperty(input, field, { enumerable: true, get() { reads++; return field === 'kind' ? 'blob' : 'generated text' } })
    const { container } = render(<RawFallback input={input} />)
    expect(reads).toBe(0)
    expect(container.textContent).toContain('[Accessor]')
    expect(container.textContent).not.toContain('generated text')
  })

  it('bounds wide objects with a truncation note', () => {
    const value: Record<string, unknown> = {}
    value.nested = Array.from({ length: 20_000 }, (_, i) => ({ value: i }))
    const { container } = render(<RawFallback input={value} />)
    expect(container.textContent).toContain('Truncated raw preview')
    expect(new TextEncoder().encode(container.querySelector('pre')?.textContent ?? '').length).toBeLessThanOrEqual(200 * 1024)
  })

  it('preserves sparse array positions in the JSON preview', () => {
    const input = new Array(4)
    const { container } = render(<RawFallback input={input} />)
    expect(container.querySelector('pre')?.textContent).toBe(JSON.stringify(input, null, 2))
  })

  it('bounds sparse arrays without expanding their entire length', () => {
    const { container } = render(<RawFallback input={new Array(1_000_000_000)} />)
    expect(container.textContent).toContain('Truncated raw preview')
    expect(new TextEncoder().encode(container.querySelector('pre')?.textContent ?? '').length).toBeLessThanOrEqual(200 * 1024)
  })

  it.each([null, undefined, false, 0, Symbol('example')])('safely displays the primitive %s', input => {
    const { container } = render(<RawFallback input={input} />)
    expect(container.querySelector('pre')?.textContent.length).toBeGreaterThan(0)
  })
})
