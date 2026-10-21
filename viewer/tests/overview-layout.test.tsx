// @vitest-environment jsdom
import './browser-env.ts'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClaimedVsProven } from '../src/components/ClaimedVsProven.tsx'
import { Overview } from '../src/components/Overview.tsx'
import { recordedDiff } from '../src/components/overview-data.ts'
import type { RunDoc } from '../src/types.ts'
import publicRun from '../public/run.json'

const doc = publicRun as RunDoc
afterEach(cleanup)

describe('recorded overview', () => {
  it('shows only the exported run and measured counts, with no fabricated history', () => {
    render(<Overview doc={doc} lens="client" onOpenDrawer={() => {}} />)
    const runs = within(screen.getByRole('region', { name: 'Exportierte Läufe' }))
    expect(runs.getAllByRole('row')).toHaveLength(2)
    expect(runs.getByText(doc.run.project)).toBeTruthy()
    expect(screen.getByTestId('failed-count').textContent).toBe(String(doc.counts.red))
    expect(screen.getByTestId('unwitnessed-count').textContent).toBe(String(doc.claims.filter(c => c.finding === 'claim_unwitnessed').length))
    expect(screen.getByText('Nur Hash · HMAC nicht geprüft')).toBeTruthy()
    expect(document.querySelector('polyline')).toBeNull()
    expect(screen.queryByText('HMAC geprüft')).toBeNull()
    expect(document.body.textContent).not.toContain('Healthy')
    expect(document.body.textContent).not.toContain('✓')
  })
  it.each(['client', 'developer'] as const)('keeps supported claims separate from proof in the %s lens', lens => {
    render(<ClaimedVsProven doc={doc} lens={lens} />)
    expect(screen.getByText('Claim · supported').closest('[data-slot=status-badge]')?.getAttribute('data-variant')).toBe('offen')
    expect(screen.queryByText('· met') !== null).toBe(lens === 'developer')
  })
  it('uses the actual diff, not a JSON snapshot containing a diff marker', () => {
    const diff = recordedDiff(doc)!
    expect(diff.text.startsWith('diff --git')).toBe(true)
    expect(diff.event.payload.refers_to).toBe('git_diff_after')
  })
  it('opens recorded criterion and timeline evidence through real buttons', () => {
    const open = vi.fn()
    render(<Overview doc={doc} lens="developer" onOpenDrawer={open} />)
    fireEvent.click(screen.getByRole('button', { name: `Belege: ${doc.criteria[0].text}` }))
    expect(open.mock.calls.at(-1)?.[0]).toEqual({ kind: 'criterion', criterion: doc.criteria[0], matched: doc.events.filter(e => doc.criteria[0].evidence.includes(e.id)) })
    const last = [...doc.events].sort((a,b) => a.seq-b.seq).at(-1)!
    fireEvent.click(screen.getByRole('button', { name: `Ereignis #${last.seq}: ${last.summary}` }))
    expect(open.mock.calls.at(-1)?.[0]).toEqual({ kind: 'event', event: last })
  })
  it('shows neutral empty states when no diff, claims, criteria or events were exported', () => {
    const empty = structuredClone(doc)
    empty.criteria=[]; empty.claims=[]; empty.events=[]; empty.blobs={}; empty.run.events=0
    empty.counts={green:0,red:0,yellow:0,gray:0,outline:0}
    render(<Overview doc={empty} lens="client" onOpenDrawer={() => {}} />)
    expect(screen.getByText('Kein Code-Diff exportiert.')).toBeTruthy()
    expect(screen.getByText('Keine Kriterien exportiert.')).toBeTruthy()
    expect(screen.getByText('Keine Ereignisse exportiert.')).toBeTruthy()
    expect(recordedDiff(empty)).toBeUndefined()
  })
})
