import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { IntegrityNotice } from '../src/components/IntegrityNotice.tsx'

describe('integrity notice', () => {
  it.each([
    ['hmac', 'Integrity: HMAC verified at export'],
    ['hash-only', 'Hash chain only – HMAC not checked'],
    ['failed', 'Integrity verification failed'],
  ] as const)('renders the %s level and browser limitation', (integrity, label) => {
    const html = renderToStaticMarkup(createElement(IntegrityNotice, { integrity }))
    expect(html).toContain(label)
    expect(html).toContain('internal consistency only; it does not verify signatures.')
  })
})
