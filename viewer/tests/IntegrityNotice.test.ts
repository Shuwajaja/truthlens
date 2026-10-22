import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { IntegrityNotice } from '../src/components/IntegrityNotice.tsx'

describe('integrity notice', () => {
  it.each([
    [true, 'hmac', 'Signature checked'],
    [false, 'hmac', 'Signature not checked'],
    [false, 'hash-only', 'Hash only · signature not checked'],
    [false, 'failed', 'Integrity check failed'],
  ] as const)('renders verified=%s / %s honestly with browser limitation', (verified, integrity, label) => {
    const html = renderToStaticMarkup(createElement(IntegrityNotice, { verified, integrity }))
    expect(html).toContain(label)
    expect(html).toContain('internal consistency only; it does not verify signatures.')
    expect(html).toContain('Integrity is not approval')
  })
})
