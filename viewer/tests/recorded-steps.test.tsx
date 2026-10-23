// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent} from '@testing-library/react'
import {afterEach,it,expect} from 'vitest'
import {groupRecordedPhases,recordedResult} from '../src/lib/recorded-steps.ts'
import {RecordedText} from '../src/components/RecordedText.tsx'
import {RecordedOutput,StepFacts,StepTime} from '../src/components/RecordedStep.tsx'
import publicRun from '../fixtures/demo-run.json'
import type {RunDoc} from '../src/types.ts'
const doc=publicRun as RunDoc
afterEach(cleanup)
it('groups contiguous real task/result phases without reordering or inventing empty phases',()=>{
 const events=[doc.events[0],doc.events[13],doc.events[1],doc.events[15]].map(event=>({event}))
 const before=structuredClone(events),groups=groupRecordedPhases(events)
 expect(groups.map(g=>g.kind)).toEqual(['Task','Result','Task','Result'])
 expect(groups.flatMap(g=>g.items)).toEqual(events);expect(events).toEqual(before)
 expect(groupRecordedPhases([])).toEqual([])
 expect(groupRecordedPhases([{event:doc.events[8]}]).map(g=>g.kind)).toEqual(['Result'])
})
it('colours only trusted recorded tests; claims and run exit0 never become success',()=>{
 expect(recordedResult(doc.events[13])).toEqual({tone:'ok',text:'1 passed · 0 failed · 0 skipped · Exit code 0'})
 expect(recordedResult(doc.events[14]).tone).toBe('fail')
 expect(recordedResult({...doc.events[13],actor:{kind:'agent',id:'fixture'}}).tone).toBe('open')
 expect(recordedResult(doc.events[8]).text).toContain('Claim only')
 expect(recordedResult(doc.events[15])).toEqual({tone:'open',text:'Exit code 0 · not approval'})
 expect(recordedResult(doc.events[5]).text).toContain('not a test result')
})
it('shows actual actor and timestamp even in the client presentation',()=>{
 const event=doc.events[1];render(<><StepFacts event={event}/><StepTime event={event}/></>)
 expect(screen.getByText(`${event.actor.kind} / ${event.actor.id}`)).toBeTruthy()
 expect(document.querySelector('time')?.getAttribute('dateTime')).toBe(event.ts)
 expect(document.querySelector('time')?.getAttribute('title')).toContain('2026')
 expect(screen.getByText('Record only · no test result')).toBeTruthy()
})
it('collapses long exact text without losing it and leaves short text readable',()=>{
 const text='Exact long output <script>not HTML</script>\n'.repeat(20)
 const {rerender}=render(<RecordedText text={text}/>)
 const details=document.querySelector('details')!;expect(details.open).toBe(false)
 fireEvent.click(screen.getByText('Show full text'));expect(details.open).toBe(true)
 expect(document.querySelector('.recorded-full-text')?.textContent).toBe(text)
 expect(document.querySelector('script')).toBeNull()
 rerender(<RecordedText key="multiline" text={'a\nb\nc\nd'}/>);expect(document.querySelector('details')?.open).toBe(false)
 rerender(<RecordedText text="Short fact"/>);expect(document.querySelector('details')).toBeNull();expect(screen.getByText('Short fact')).toBeTruthy()
})
it('opens only the exact exported attached body; missing bodies stay missing',()=>{
 const event={...doc.events[7],payload:{sha256:'fixture-sha'}},body='Original\nbody\n'.repeat(40)
 const {rerender}=render(<RecordedOutput event={event} blobs={{'fixture-sha':body,unrelated:'never show'}}/>)
 expect(document.querySelector('details')?.open).toBe(false)
 fireEvent.click(screen.getByText(/Recorded content/));expect(document.querySelector('pre')?.textContent).toBe(body)
 expect(screen.queryByText('never show')).toBeNull()
 rerender(<RecordedOutput event={event} blobs={{unrelated:'never show'}}/>);expect(screen.getByText('Content not exported')).toBeTruthy();expect(document.querySelector('pre')).toBeNull()
 rerender(<RecordedOutput event={{...event,payload:{}}} blobs={{unrelated:'never show'}}/>);expect(document.body.textContent).not.toContain('never show')
})
