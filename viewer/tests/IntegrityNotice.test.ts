import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { IntegrityNotice } from '../src/components/IntegrityNotice.tsx'

describe('integrity notice', () => {
  it.each([
    [true, 'hmac', 'HMAC geprüft'],
    [false, 'hmac', 'HMAC nicht geprüft'],
    [false, 'hash-only', 'Nur Hash · HMAC nicht geprüft'],
    [false, 'failed', 'Integritätsprüfung fehlgeschlagen'],
  ] as const)('renders verified=%s / %s honestly with browser limitation', (verified, integrity, label) => {
    const html = renderToStaticMarkup(createElement(IntegrityNotice, { verified, integrity }))
    expect(html).toContain(label)
    expect(html).toContain('internal consistency only; it does not verify signatures.')
    expect(html).toContain('Integrität ≠ fachliche Freigabe')
  })
})
