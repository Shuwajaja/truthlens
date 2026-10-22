// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { integrityBadge } from '../../src/lib/status-badge.ts'
import { afterEach, describe, expect, it } from 'vitest'
import { StatusBadge } from '../../src/components/ui/badge.tsx'

afterEach(cleanup)

describe('recorded badge levels', () => {
  it.each([
    [false, 'hash-only', 'hash-only'],
    [false, 'hmac', 'open'],
    [true, 'hash-only', 'hash-only'],
    [true, 'hmac', 'signature-checked'],
    [false, 'failed', 'failed'],
    [true, 'failed', 'failed'],
  ] as const)('maps verified=%s, integrity=%s to %s', (verified, integrity, variant) => {
    expect(integrityBadge({ verified, integrity }).variant).toBe(variant)
  })
  it('only shows the HMAC checked badge when both exported fields agree', () => {
    const { rerender } = render(<StatusBadge source="integrity" verified={false} integrity="hmac" />)
    expect(screen.queryByText('Signature checked')).toBeNull()
    rerender(<StatusBadge source="integrity" verified integrity="hmac" />)
    expect(screen.getByText('Signature checked')).toBeTruthy()
  })
  it('shows the exact hash-only warning without a check icon', () => {
    render(<StatusBadge source="integrity" verified={false} integrity="hash-only" />)
    expect(screen.getByText('Hash only · signature not checked')).toBeTruthy()
    expect(document.querySelector('svg')).toBeNull()
  })
  it.each([['met', 'Proven'], ['unmet', 'Failed'], ['unverified', 'Open'], ['proposed', 'Open']])('labels recorded criterion status %s', (status, label) => {
    render(<StatusBadge source="criterion" status={status} />)
    expect(screen.getByText(label)).toBeTruthy()
    expect(screen.getByText(`· ${status}`)).toBeTruthy()
    expect(document.querySelector('svg')).toBeNull()
  })
  it.each(['supported', 'claim_unwitnessed'] as const)('never styles a claim finding %s as proof', finding => {
    render(<StatusBadge source="claim" finding={finding} />)
    expect(document.querySelector('[data-variant="open"]')).toBeTruthy()
    expect(screen.queryByText('Proven')).toBeNull()
  })
})

it('keeps compact unsigned integrity neutral and only colours a real HMAC check',()=>{
 const {rerender}=render(<StatusBadge source="integrity" verified={false} integrity="hash-only" compact/>);
 expect(screen.getByText('Hash only').closest('[data-slot=status-badge]')?.className).not.toContain('text-ok');
 rerender(<StatusBadge source="integrity" verified={false} integrity="hmac" compact/>);
 expect(screen.getByText('Not checked').closest('[data-slot=status-badge]')?.className).not.toContain('text-ok');
 rerender(<StatusBadge source="integrity" verified integrity="hmac" compact/>);
 expect(screen.getByText('Signature checked').closest('[data-slot=status-badge]')?.className).toContain('text-ok');
})
