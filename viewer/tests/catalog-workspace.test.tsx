// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,expect,it,vi} from 'vitest'
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react'
import App from '../src/App.tsx'
import fixture from '../fixtures/demo-run.json'

const workspace='a'.repeat(64)
const summary=(run_id:string,source_id:string)=>({run_id,source_id,registration_id:`registration_${run_id}`,ledger_last_hash:fixture.run.ledger_last_hash,capture_closed_at:'2026-10-23T00:00:00.000Z'})
const one=summary(fixture.run.run_id,'b'.repeat(64)),two=summary('run_two','c'.repeat(64))
const document=(item:typeof one)=>({source_id:item.source_id,document:{...structuredClone(fixture),run:{...fixture.run,run_id:item.run_id,project:item.run_id}}})
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}})
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return {promise,resolve}}
function setup(load:(path:string)=>Promise<Response>=async path=>json(document(path.includes(two.run_id)?two:one))){
 vi.stubEnv('DEV',false)
 vi.stubGlobal('scrollTo',()=>{})
 const fetch=vi.fn(async(path:string)=>path==='/v1/health'?json({source_id:workspace,service:'available'}):path.startsWith('/v1/runs?')?json({source_id:workspace,runs:[one,two],next_offset:null}):load(path))
 vi.stubGlobal('fetch',fetch)
 render(<App/>)
 return fetch
}
async function connect(){fireEvent.click(screen.getByRole('button',{name:'Connect',exact:true}));await screen.findByRole('heading',{name:'Runs',exact:true})}
const open=(item:typeof one)=>fireEvent.click(screen.getByRole('button',{name:`Open run ${item.run_id}`,exact:true}))
afterEach(()=>{cleanup();localStorage.clear();history.replaceState(null,'','/');vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs()})

it('shows workspace and snapshot identities and canonicalizes the initial Runs entry',async()=>{
 const fetch=setup();expect(fetch).not.toHaveBeenCalled();await connect()
 expect(new URL(location.href).searchParams.get('source')).toBe(workspace)
 expect(new URL(location.href).searchParams.get('view')).toBe('runs')
 expect(screen.getByText(workspace)).toBeTruthy()
 expect(screen.getByText(one.source_id)).toBeTruthy()
 expect(fetch.mock.calls.map(([path])=>path)).toEqual(['/v1/health','/v1/runs?offset=0&limit=50'])
})

it('ignores a late document after switching runs, and retains Claims as a deduplicated renderer tab',async()=>{
 const first=deferred<Response>()
 setup(async path=>path.includes(one.run_id)?first.promise:json(document(two)))
 await connect();open(one)
 await screen.findByRole('heading',{name:'Loading run…'})
 fireEvent.click(screen.getByRole('button',{name:'Open Runs'}));open(two)
 await screen.findByText(two.run_id,{selector:'h1'})
 await act(async()=>{first.resolve(json(document(one)));await first.promise})
 expect(screen.queryByText(one.run_id,{selector:'h1'})).toBeNull()
 const navigation=within(screen.getByRole('navigation',{name:'Viewer navigation'}))
 fireEvent.click(navigation.getByRole('button',{name:'Claimed vs proven',exact:true}))
 fireEvent.click(navigation.getByRole('button',{name:'Claimed vs proven',exact:true}))
 const tabs=within(screen.getByRole('region',{name:'Workspace tabs'}))
 expect(tabs.getAllByRole('button',{name:/^Select Claimed vs proven/})).toHaveLength(1)
 expect(new URL(location.href).searchParams.get('view')).toBe('claimed-vs-proven')
})

it('stays usable on storage failure and exposes retry after a failed document read',async()=>{
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota')})
 const load=vi.fn().mockRejectedValueOnce(Error('Reader unavailable')).mockImplementation(async()=>json(document(one)))
 setup(load);await connect();await screen.findByText('Unsaved on this device.');open(one)
 await screen.findByRole('heading',{name:'Unable to load run'})
 fireEvent.click(screen.getByRole('button',{name:'Retry',exact:true}))
 await screen.findByText(one.run_id,{selector:'h1'})
 await waitFor(()=>expect(load).toHaveBeenCalledTimes(2))
})

it('keeps Not connected when the read service is unavailable',async()=>{
 const fetch=setup();fetch.mockRejectedValue(Error('Unavailable'))
 fireEvent.click(screen.getByRole('button',{name:'Connect',exact:true}))
 await screen.findByRole('alert')
 expect(screen.getByRole('heading',{name:'Not connected'})).toBeTruthy()
 expect(screen.getByRole('alert').textContent).toContain('Unable to connect')
})

it.each(['Chain','Coverage','Gated actions','Changes','Compare'])('opens %s through the existing source/run tab model',async name=>{
 setup(async path=>path.endsWith('/audits')?json({source_id:one.source_id,audit:null}):json(document(one)))
 await connect();open(one);await screen.findByText(one.run_id,{selector:'h1'})
 const navigation=within(screen.getByRole('navigation',{name:'Viewer navigation'}))
 fireEvent.click(navigation.getByRole('button',{name,exact:true}))
 fireEvent.click(navigation.getByRole('button',{name,exact:true}))
 expect(within(screen.getByRole('region',{name:'Workspace tabs'})).getAllByRole('button',{name:new RegExp(`^Select ${name} ·`)})).toHaveLength(1)
 expect(new URL(location.href).searchParams.get('view')).toBe(name.toLowerCase().replaceAll(' ','-'))
})
