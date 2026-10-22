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
    const runs = within(screen.getByRole('region', { name: 'Exported runs' }))
    expect(runs.getAllByRole('row')).toHaveLength(2)
    expect(runs.getByText(doc.run.project)).toBeTruthy()
    expect(screen.getByTestId('failed-count').textContent).toBe('1')
    expect(screen.getByTestId('unwitnessed-count').textContent).toBe('1')
    expect(screen.getByTestId('met-count').textContent).toBe('1 / 3')
    expect(screen.getByTestId('overall-status').textContent).toBe('Open')
    expect(document.querySelector('polyline')).toBeNull()
    expect(screen.queryByText('Signature checked')).toBeNull()
    expect(document.body.textContent).not.toContain('Healthy')
    expect(document.body.textContent).not.toContain('✓')
  })
  it.each(['client', 'developer'] as const)('keeps supported claims separate from proof in the %s lens', lens => {
    render(<ClaimedVsProven doc={doc} lens={lens} />)
    expect(screen.getByText('Claim · supported').closest('[data-slot=status-badge]')?.getAttribute('data-variant')).toBe('open')
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
    fireEvent.click(screen.getByText(doc.criteria[0].text, {selector: '.criterion-content strong'}).closest('button')!)
    expect(open.mock.calls.at(-1)?.[0]).toEqual({ kind: 'criterion', criterion: doc.criteria[0], matched: doc.events.filter(e => doc.criteria[0].evidence.includes(e.id)) })
    const last = [...doc.events].sort((a,b) => a.seq-b.seq).at(-1)!
    fireEvent.click(screen.getByRole('button',{name:name=>name.includes('#16 · run.finished')}))
    expect(open.mock.calls.at(-1)?.[0]).toEqual({ kind: 'event', event: last })
  })
  it('shows neutral empty states when no diff, claims, criteria or events were exported', () => {
    const empty = structuredClone(doc)
    empty.criteria=[]; empty.claims=[]; empty.events=[]; empty.blobs={}; empty.run.events=0
    empty.counts={green:0,red:0,yellow:0,gray:0,outline:0}
    render(<Overview doc={empty} lens="client" onOpenDrawer={() => {}} />)
    expect(screen.getByText('No code diff exported.')).toBeTruthy()
    expect(screen.getByText('No criteria exported.')).toBeTruthy()
    expect(screen.getByTestId('met-count').textContent).toBe('0 / 0')
    expect(screen.getByTestId('unwitnessed-count').textContent).toBe('0')
    expect(screen.getByText('No events exported.')).toBeTruthy()
    expect(recordedDiff(empty)).toBeUndefined()
  })
})

it('updates the node detail from the selected real claim without turning it into proof',()=>{
 render(<Overview doc={doc} lens="developer" onOpenDrawer={()=>{}}/>);
 fireEvent.click(screen.getByText('All records and links as a list'));
 const list=within(screen.getByRole('list',{name:'Graph records'}));
 fireEvent.click(list.getByRole('button',{name:`Claim: ${doc.claims[1].text}`}));
 const detail=screen.getByRole('region',{name:'Record details'});
 expect(within(detail).getByText(doc.claims[1].claim_id)).toBeTruthy();
 expect(within(detail).getByText(doc.claims[1].text)).toBeTruthy();
 expect(detail.querySelector('[data-variant=proven]')).toBeNull();
})
