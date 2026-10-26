// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,it,expect,vi} from 'vitest'
import {cleanup,render,screen,within,fireEvent} from '@testing-library/react'
import App from '../src/App.tsx'
import {Overview} from '../src/components/Overview.tsx'
import type {RunDoc} from '../src/types.ts'
import publicRun from '../fixtures/demo-run.json'
const doc=publicRun as RunDoc
it('maps KPI and criterion status accents only to exported outcomes',()=>{
 render(<Overview doc={doc} lens="client" onOpenDrawer={()=>{}}/> )
 for(const [id,status] of [['met-count','met'],['failed-count','unmet'],['unwitnessed-count','unverified']]){
  expect(screen.getByTestId(id).closest('.status-card')?.getAttribute('data-status')).toBe(status)
 }
 for(const criterion of doc.criteria){
  const row=screen.getByRole('button',{name:name=>name.startsWith('Evidence:')&&name.includes(criterion.text)})
  expect(row.getAttribute('data-status')).toBe(criterion.status)
 }
 expect(screen.getByRole('region',{name:'Criterion detail'}).querySelector('.recorded-result')?.getAttribute('data-status')).toBe('unmet')
})
afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals()})
it.each([['met-count','met'],['failed-count','unmet'],['unwitnessed-count','unverified']] as const)('routes actual %s results to their criterion and referenced evidence', (testid,status)=>{
 const open=vi.fn();render(<Overview doc={doc} lens="client" onOpenDrawer={open}/> )
 fireEvent.click(screen.getByTestId(testid).closest('button')!)
 const criterion=doc.criteria.find(c=>c.status===status)!,detail=screen.getByRole('region',{name:'Criterion detail'}),area=within(detail)
 expect(area.getByText(criterion.text)).toBeTruthy()
 expect(document.activeElement).toBe(detail)
 fireEvent.click(screen.getByTestId(testid).closest('button')!);expect(document.activeElement).toBe(detail)
 if(criterion.evidence.length){fireEvent.click(area.getByRole('button',{name:'Open event record'}));expect(open.mock.calls[0][0].event).toBe(doc.events.find(e=>e.id===criterion.evidence[0]))}
 else expect(area.queryByRole('button',{name:'Open event record'})).toBeNull()
})
it('does not invent a criterion action when a result category is empty',()=>{
 render(<Overview doc={{...doc,criteria:[]}} lens="client" onOpenDrawer={()=>{}}/> )
 for(const id of ['met-count','failed-count','unwitnessed-count'])expect((screen.getByTestId(id).closest('button') as HTMLButtonElement).disabled).toBe(true)
})
it('uses one shell and a real criteria return action across all four views',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(doc)})))
 render(<App/>);await screen.findByRole('main')
 fireEvent.click(screen.getByRole('button',{name:name=>name.startsWith(doc.run.project)}))
 const nav=within(screen.getByRole('navigation',{name:'Viewer navigation'}))
 for(const name of ['Overview','Claimed vs proven','Timeline','Agent story']){
  fireEvent.click(nav.getByRole('button',{name,exact:true}))
  expect(screen.getAllByRole('banner')).toHaveLength(1);expect(screen.getAllByRole('main')).toHaveLength(1)
  expect(screen.queryByRole('complementary',{name:'Evidence drawer'})).toBeNull()
  expect(screen.queryByText('Navigator coming later')).toBeNull()
  if(name!=='Overview'){fireEvent.click(screen.getByRole('button',{name:'Review criteria'}));expect(screen.getByRole('region',{name:'Criteria and evidence'})).toBeTruthy();expect(document.activeElement).toBe(screen.getByRole('heading',{level:1}))}
 }
})
it.each(['loading','invalid','error'] as const)('uses the shared honest %s state without manufacturing run content',async state=>{
 vi.stubGlobal('fetch',vi.fn(async()=>{if(state==='error')throw new Error('Network unavailable');if(state==='loading')return new Promise(()=>{});return {json:async()=>({})}}))
 render(<App/>);
 const title=state==='loading'?'Loading run data…':state==='invalid'?'Invalid or inconsistent export':'Unable to load run data'
 expect(await screen.findByRole('heading',{name:title})).toBeTruthy()
 expect(screen.getByRole(state==='loading'?'status':'alert')).toBeTruthy()
 expect(screen.queryByText(doc.run.run_id)).toBeNull()
 expect(screen.queryByText('Signature checked')).toBeNull()
})
it('keeps focus on the returned view after closing a run drawer and immediately continuing review',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(doc)})))
 render(<App/>);await screen.findByRole('main')
 fireEvent.click(within(screen.getByRole('navigation',{name:'Viewer navigation'})).getByRole('button',{name:'Timeline',exact:true}))
 const run=screen.getByRole('button',{name:'Run details',exact:true});run.focus();fireEvent.click(run)
 expect(screen.getByRole('region',{name:'Run detail'})).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Back to criterion'}))
 fireEvent.click(screen.getByRole('button',{name:'Review criteria'}))
 const heading=screen.getByRole('heading',{level:1})
 await new Promise(resolve=>setTimeout(resolve,50))
 expect(document.activeElement).toBe(heading)
})
