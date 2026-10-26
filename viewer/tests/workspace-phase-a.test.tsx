// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within,waitFor} from '@testing-library/react'
import App from '../src/App.tsx'
import run from '../fixtures/demo-run.json'
afterEach(()=>{cleanup();localStorage.clear();document.documentElement.removeAttribute('data-viewer-theme');vi.unstubAllGlobals();vi.unstubAllEnvs();history.replaceState(null,'','/')})
function load(mobile=false){
 history.replaceState(null,'','/?view=overview')
 vi.stubGlobal('scrollTo',()=>{})
 vi.stubGlobal('matchMedia',(query:string)=>({matches:query.includes('min-width')?!mobile:mobile&&query.includes('767'),addEventListener(){},removeEventListener(){}}))
 vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(run)})))
 return render(<App/> )
}
it('never focuses the heading on initial load, but focuses after explicit view navigation',async()=>{
 load();await screen.findByRole('main');expect(document.activeElement).toBe(document.body)
 fireEvent.click(screen.getByRole('button',{name:'Timeline',exact:true}));expect(document.activeElement).toBe(screen.getByRole('heading',{level:1}))
})
it('keeps a single global theme across views and restores only a valid theme name',async()=>{
 localStorage.setItem('truthlens.theme','cool-graphite');load();await screen.findByRole('main');fireEvent.click(screen.getByRole('button',{name:'Details',exact:true}))
 expect(document.documentElement.dataset.viewerTheme).toBe('cool-graphite')
 fireEvent.change(screen.getByRole('combobox',{name:'Theme'}),{target:{value:'petrol-porcelain'}})
 expect(document.documentElement.dataset.viewerTheme).toBe('petrol-porcelain');expect(localStorage.getItem('truthlens.theme')).toBe('petrol-porcelain')
 fireEvent.click(screen.getByRole('button',{name:'Timeline',exact:true}));expect((screen.getByRole('combobox',{name:'Theme'}) as HTMLSelectElement).value).toBe('petrol-porcelain')
 expect(fetch).toHaveBeenCalledTimes(1);expect(fetch).toHaveBeenCalledWith('/run.json')
})
it('has independent desktop panels and does not reopen a closed inspector on selection',async()=>{
 load();await screen.findByRole('main');fireEvent.click(screen.getByRole('button',{name:'Details',exact:true}))
 fireEvent.click(screen.getByRole('button',{name:'Inspector',exact:true}));expect(screen.queryByRole('complementary',{name:'Context inspector'})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Navigation',exact:true}));expect(screen.queryByRole('navigation',{name:'Viewer navigation'})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:name=>name.startsWith('Evidence:')&&name.includes(run.criteria[0].text)}));expect(screen.queryByRole('complementary',{name:'Context inspector'})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Inspector',exact:true}));expect(within(screen.getByRole('complementary',{name:'Context inspector'})).getByText(run.criteria[0].text)).toBeTruthy();expect(screen.queryByRole('dialog')).toBeNull()
})
it('opens the mobile criterion sheet with actual evidence and restores selection trigger',async()=>{
 load(true);await screen.findByRole('main');fireEvent.click(screen.getByRole('button',{name:'Details',exact:true}));expect(screen.queryByRole('navigation',{name:'Viewer navigation'})).toBeNull()
 const criterion=run.criteria.find(c=>c.status==='unmet')!,trigger=screen.getByRole('button',{name:name=>name.startsWith('Evidence:')&&name.includes(criterion.text)})
 trigger.focus();fireEvent.click(trigger)
 const sheet=screen.getByRole('dialog',{name:'Context inspector'});expect(sheet.getAttribute('aria-modal')).toBe('true');expect(within(sheet).getByText(criterion.text)).toBeTruthy()
 fireEvent.click(within(sheet).getByRole('button',{name:'Open event record'}));expect(within(sheet).getByText(/Event:/)).toBeTruthy()
 fireEvent.keyDown(document.activeElement!,{key:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(document.activeElement).toBe(trigger)
})
it('ignores unknown stored theme and survives unavailable storage',async()=>{
 localStorage.setItem('truthlens.theme','external-url');load();await screen.findByRole('main');fireEvent.click(screen.getByRole('button',{name:'Details',exact:true}));expect(document.documentElement.dataset.viewerTheme).toBe('petrol-porcelain')
 const set=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Unavailable')})
 fireEvent.change(screen.getByRole('combobox',{name:'Theme'}),{target:{value:'cool-graphite'}});expect(document.documentElement.dataset.viewerTheme).toBe('cool-graphite');set.mockRestore()
})
it('moves keyboard focus into an opened desktop record and back to the criterion',async()=>{
 load();await screen.findByRole('main');fireEvent.click(screen.getByRole('button',{name:'Details',exact:true}))
 const open=screen.getByRole('button',{name:'Open event record'});open.focus();fireEvent.click(open)
 expect(document.activeElement).toBe(screen.getByRole('heading',{name:/^Event:/}))
 const back=screen.getByRole('button',{name:'Back to criterion'});back.focus();fireEvent.click(back)
 expect(document.activeElement).toBe(screen.getByRole('region',{name:'Criterion detail'}))
})
it('returns focus to the persistent Inspector control when its desktop close button unmounts',async()=>{
 load();await screen.findByRole('main');fireEvent.click(screen.getByRole('button',{name:'Details',exact:true}))
 const close=screen.getByRole('button',{name:'Close inspector'});close.focus();fireEvent.click(close)
 expect(document.activeElement).toBe(screen.getByRole('button',{name:'Inspector',exact:true}))
})

it('production local workspace never fetches or displays a development fixture',async()=>{
 vi.stubEnv('DEV',false);vi.stubGlobal('fetch',vi.fn());render(<App/> )
 expect(await screen.findByRole('heading',{name:'Not connected'})).toBeTruthy()
 expect(fetch).not.toHaveBeenCalled();expect(screen.queryByText(run.run.run_id)).toBeNull()
 expect(screen.queryByRole('button',{name:'Run details'})).toBeNull()
 expect(screen.queryByText('Signature checked')).toBeNull()
})

it('production connects only after explicit action and fetches a selected document on demand',async()=>{
 vi.stubEnv('DEV',false)
 const contextId='a'.repeat(64),runSourceId='b'.repeat(64)
 const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}})
 const fetchMock=vi.fn()
  .mockResolvedValueOnce(json({source_id:contextId,service:'available'}))
  .mockResolvedValueOnce(json({source_id:contextId,runs:[{run_id:run.run.run_id,source_id:runSourceId,registration_id:'registration_1',ledger_last_hash:run.run.ledger_last_hash,capture_closed_at:'2026-10-23T00:00:00.000Z'}],next_offset:null}))
  .mockResolvedValueOnce(json({source_id:runSourceId,document:run}))
 vi.stubGlobal('fetch',fetchMock);render(<App/> )
 expect(fetchMock).not.toHaveBeenCalled()
 fireEvent.click(screen.getByText('Menü'))
 fireEvent.click(screen.getByRole('button',{name:'Connect'}))
 expect(await screen.findByRole('heading',{name:'Übersicht'})).toBeTruthy()
 fireEvent.click(screen.getByText('Menü'))
 expect(fetchMock.mock.calls.map(([url])=>url)).toEqual(['/v1/health','/v1/runs?offset=0&limit=50'])
 fireEvent.click(screen.getByRole('button',{name:`Open run ${run.run.run_id}`}))
 expect(await screen.findByRole('heading',{name:run.run.project})).toBeTruthy()
 expect(fetchMock.mock.calls[2][0]).toBe(`/v1/runs/${encodeURIComponent(run.run.run_id)}/document`)
 fireEvent.click(screen.getByRole('button',{name:'Details',exact:true}))
 expect(screen.getByText('Private registered snapshot. Read-only view.')).toBeTruthy()
 expect(screen.queryByText(/Local test fixture|No live server connection/)).toBeNull()
})
