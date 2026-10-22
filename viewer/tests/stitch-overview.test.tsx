// @vitest-environment jsdom
import './browser-env.ts'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {Overview} from '../src/components/Overview.tsx'
import type {RunDoc} from '../src/types.ts'
import publicRun from '../public/run.json'
const doc=publicRun as RunDoc
afterEach(cleanup)
const show=(value=doc,open=vi.fn())=>render(<Overview doc={value} lens="client" onOpenDrawer={open}/> )
it('uses exactly three measured KPI cards and a separate warning approval boundary',()=>{
 show()
 expect(document.querySelectorAll('.status-card')).toHaveLength(3)
 expect(screen.getByTestId('met-count').textContent).toBe('1 / 3')
 expect(screen.getByTestId('failed-count').textContent).toBe('1')
 expect(screen.getByTestId('unwitnessed-count').textContent).toBe('1')
 expect(screen.getByTestId('approval-status').textContent).toBe('Open')
 expect(screen.getByTestId('approval-status').getAttribute('data-state')).toBe('open')
 expect(screen.getByRole('heading',{level:1}).textContent).toBe(doc.run.project)
 expect(screen.getByText(doc.run.run_id)).toBeTruthy()
 for(const invented of ['Run verified','Hardware Sealed','Enclave','Chromium','Acme Corp','v1.4.0','Timeout'])expect(document.body.textContent).not.toContain(invented)
})
it('selects a real criterion inline and opens only its referenced evidence',()=>{
 const open=vi.fn();show(doc,open)
 const criterion=doc.criteria[2]
 const button=screen.getByRole('button',{name:name=>name.startsWith('Evidence:')&&name.includes(criterion.text)})
 fireEvent.click(button)
 expect(button.getAttribute('aria-pressed')).toBe('true')
 expect(open).not.toHaveBeenCalled()
 const detail=within(screen.getByRole('region',{name:'Criterion detail'}))
 expect(detail.getByText(criterion.text)).toBeTruthy()
 expect(detail.getByText(criterion.criterion_id)).toBeTruthy()
 expect(detail.getByText('No evidence events exported for this criterion.')).toBeTruthy()
 fireEvent.click(detail.getByRole('button',{name:'Open criterion record'}))
 expect(open).toHaveBeenLastCalledWith({kind:'criterion',criterion,matched:[]})
})
it('previews the actual exported HTML in an opaque, script-free network-blocked sandbox',()=>{
 show()
 const artifact=doc.artifacts.find(a=>a.path==='index.html')!
 const frame=screen.getByTitle('Project preview: index.html')
 expect(frame.tagName).toBe('IFRAME')
 expect(frame.getAttribute('sandbox')).toBe('')
 expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer')
 expect(frame.getAttribute('srcdoc')).toContain(doc.blobs![artifact.sha256])
 for(const policy of ["default-src 'none'","script-src 'none'","form-action 'none'","base-uri 'none'"])expect(frame.getAttribute('srcdoc')).toContain(policy)
 expect(frame.getAttribute('src')).toBeNull()
})
it.each(['artifact','body','type'] as const)('shows a genuine empty preview when %s is unavailable',missing=>{
 const value=structuredClone(doc)
 if(missing==='artifact')value.artifacts=[]
 if(missing==='body')value.blobs={}
 if(missing==='type')value.artifacts=value.artifacts.map(a=>({...a,path:'record.txt'}))
 show(value)
 expect(document.querySelector('iframe')).toBeNull()
 expect(screen.getByText('No project preview available.')).toBeTruthy()
})
it('a diff body alone cannot manufacture a project preview',()=>{
 const value=structuredClone(doc);value.artifacts=[];show(value)
 expect(document.querySelector('iframe')).toBeNull()
 expect(screen.getByText('No project preview available.')).toBeTruthy()
})
it('does not turn absence of a review flag into human approval',()=>{
 show({...doc,review_required:false})
 expect(screen.getByTestId('approval-status').textContent).toBe('Not stated')
 expect(screen.getByTestId('approval-status').getAttribute('data-state')).toBe('not-stated')
 expect(document.body.textContent).not.toContain('Approved')
})
it('handles an empty export without inventing counts or selected evidence',()=>{
 show({...doc,criteria:[],claims:[],artifacts:[],events:[],blobs:{}})
 expect(screen.getByTestId('met-count').textContent).toBe('0 / 0')
 expect(screen.getByText('No criteria exported.')).toBeTruthy()
 expect(screen.getByText('Select a recorded criterion to see its evidence.')).toBeTruthy()
 expect(screen.getByText('No project preview available.')).toBeTruthy()
})
