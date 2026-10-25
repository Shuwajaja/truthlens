// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import {EvidenceReview} from '../src/components/EvidenceReview.tsx'
import {StoredChanges} from '../src/components/StoredChanges.tsx'
import {ComparePane} from '../src/components/ComparePane.tsx'
import type {RunDoc} from '../src/types.ts'
import fixture from '../fixtures/demo-run.json'
const doc=fixture as RunDoc
const check=(outcome:string,rule_id='TL-AUD-001')=>({rule_id,outcome,required:true,message:`Recorded ${outcome}`,event_ids:[],criterion_ids:[]})
const report=(checks:unknown[])=>({audit_version:1,run_id:doc.run.run_id,ledger_last_hash:doc.run.ledger_last_hash,checks,limitations:['Synthetic test boundary.']})
afterEach(cleanup)
it.each([
 [[check('supported')],'Checked within scope','supported'],
 [[check('supported'),check('not_checkable')],'Partially checked','not_checkable'],
 [[check('supported'),check('contradictory')],'Check failed','contradictory'],
 [[], 'Not checked','not_checkable'],
])('uses all recorded chain checks without manufacturing link diagnostics %#',(checks,label,outcome)=>{
 render(<EvidenceReview doc={doc} view="chain" report={report(checks) as never} onOpenDrawer={vi.fn()}/>)
 expect(screen.getByTestId('review-outcome').textContent).toBe(label)
 expect(screen.getByTestId('review-outcome').getAttribute('data-outcome')).toBe(outcome)
 expect(screen.queryByText(/signature checked/i)).toBeNull()
})
it('missing audit is unchecked; missing evidence references remain missing',()=>{
 const open=vi.fn()
 const {rerender}=render(<EvidenceReview doc={doc} view="chain" report={null} onOpenDrawer={open}/>)
 expect(screen.getByText(/No stored audit/)).toBeTruthy()
 rerender(<EvidenceReview doc={doc} view="coverage" report={report([{...check('not_checkable','TL-AUD-004'),event_ids:[doc.events[0].id,'missing-event'],criterion_ids:['missing-criterion']}]) as never} onOpenDrawer={open}/>)
 fireEvent.click(screen.getByRole('button',{name:`Open event ${doc.events[0].id}`}))
 expect(open).toHaveBeenCalledWith({kind:'event',event:doc.events[0]})
 expect(screen.getByText(/Event not exported: missing-event/)).toBeTruthy()
 expect(screen.getByText(/Criterion not exported: missing-criterion/)).toBeTruthy()
})
it('gated checks show not applicable without claiming human approval',()=>{
 render(<EvidenceReview doc={doc} view="gated-actions" report={report([check('not_applicable','TL-AUD-012')]) as never} onOpenDrawer={vi.fn()}/>)
 expect(screen.getByTestId('review-outcome').textContent).toBe('Not applicable')
 expect(screen.getByText(/does not grant human approval/)).toBeTruthy()
})
it('shows only stored diff bytes and an honest missing blob state',()=>{
 const copy=structuredClone(doc),sha='e'.repeat(64),text='diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1 +1 @@\n-old\n+new'
 copy.events=[{...doc.events[0],type:'evidence.attached',payload:{sha256:sha,refers_to:'git_diff_after'}}];copy.blobs={[sha]:text}
 const open=vi.fn(),{rerender}=render(<StoredChanges doc={copy} onOpenDrawer={open}/>)
 expect(screen.getByText('old')).toBeTruthy();expect(screen.getByText('new')).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Open diff event'}));expect(open).toHaveBeenCalledWith({kind:'event',event:copy.events[0]})
 copy.blobs={};rerender(<StoredChanges doc={copy} onOpenDrawer={open}/>)
 expect(screen.getByText(/No stored diff content/)).toBeTruthy();expect(screen.queryByText('new')).toBeNull()
})
it('comparison retains both source identities for the same run id and never invents a before file',()=>{
 const other={...doc,criteria:[],blobs:{}}
 const choices=[{sourceId:'snapshot-a',doc},{sourceId:'snapshot-b',doc:other}]
 render(<ComparePane current={choices[0]} choices={choices}/>)
 expect(screen.getByText(/Choose another loaded snapshot/)).toBeTruthy()
 fireEvent.change(screen.getByLabelText('Comparison snapshot'),{target:{value:JSON.stringify(['snapshot-b',doc.run.run_id])}})
 const left=within(screen.getByRole('region',{name:'Left snapshot'})),right=within(screen.getByRole('region',{name:'Right snapshot'}))
 expect(left.getByRole('complementary',{name:'Left snapshot trust boundaries'})).toBeTruthy()
 expect(right.getByRole('complementary',{name:'Right snapshot trust boundaries'})).toBeTruthy()
 expect(left.getByText('snapshot-a')).toBeTruthy();expect(right.getByText('snapshot-b')).toBeTruthy()
 expect(left.getByText(doc.run.ledger_last_hash)).toBeTruthy();expect(right.getByText(doc.run.ledger_last_hash)).toBeTruthy()
 expect(left.getByText('Integrity is not approval')).toBeTruthy();expect(right.getByText('Integrity is not approval')).toBeTruthy()
 expect(right.getByText(/No stored diff content/)).toBeTruthy()
})
it('evicted comparison content becomes unavailable instead of showing stale evidence',()=>{
 const choices=[{sourceId:'a',doc},{sourceId:'b',doc:{...doc,criteria:[]}}]
 const {rerender}=render(<ComparePane current={choices[0]} choices={choices}/>)
 fireEvent.change(screen.getByLabelText('Comparison snapshot'),{target:{value:JSON.stringify(['b',doc.run.run_id])}})
 rerender(<ComparePane current={choices[0]} choices={[choices[0]]}/>)
 expect(screen.getByText(/Comparison snapshot unavailable/)).toBeTruthy()
 expect(screen.queryByRole('region',{name:'Right snapshot'})).toBeNull()
})
it('exposes recorded gate events even without an audit and labels simulated records',()=>{
 const event={...doc.events[0],id:'synthetic-gate-record',type:'approval.granted',actor:{kind:'agent',id:'synthetic-agent'},payload:{simulated:true}}
 const open=vi.fn()
 render(<EvidenceReview doc={{...doc,events:[event]}} view="gated-actions" report={null} onOpenDrawer={open}/>)
 expect(screen.getByTestId('review-outcome').textContent).toBe('Not checked')
 expect(screen.getByText('Simulated record')).toBeTruthy()
 expect(screen.getByText('agent · synthetic-agent')).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Open gate event synthetic-gate-record'}))
 expect(open).toHaveBeenCalledWith({kind:'event',event})
})
