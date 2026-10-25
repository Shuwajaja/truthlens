// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {StatusDeck} from '../src/components/StatusDeck.tsx'
import {RegistryWidget} from '../src/audit-widget/Widget.tsx'
import {loadPrivateAuditResult} from '../src/private-reader.ts'
import run from '../fixtures/demo-run.json'

const summary={run_id:run.run.run_id,source_id:'b'.repeat(64),registration_id:'fixture',ledger_last_hash:run.run.ledger_last_hash,capture_closed_at:'2026-10-25T00:00:00Z'}
const envelope={source_id:summary.source_id,status:{status:'passed',reason_code:'checks_passed'},audit:{audit_version:1,run_id:summary.run_id,ledger_last_hash:summary.ledger_last_hash,checks:[],limitations:[]}}
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})

it('renders only the canonical DTO and visible approval boundary',()=>{
 render(<StatusDeck result={{status:'passed',reason_code:'checks_passed'}}/>)
 expect(screen.getByText('Passed',{exact:true})).toBeTruthy()
 expect(screen.getByText('Integrity is not approval')).toBeTruthy()
 expect(document.body.textContent).not.toContain('Signature checked')
})

it('fails closed on extra fields and arbitrary status/reason strings',async()=>{
 for(const status of [{status:'running',reason_code:'checks_passed'},{status:'passed',reason_code:'/synthetic/private'},{...envelope.status,path:'/synthetic/private'}]){
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({...envelope,status})))
  await expect(loadPrivateAuditResult(summary)).rejects.toThrow(/status/i)
 }
})

it('reads the server projection without deriving a second result from audit checks',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json(envelope)))
 expect(await loadPrivateAuditResult(summary)).toMatchObject({status:envelope.status})
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({...envelope,source_id:'c'.repeat(64)})))
 await expect(loadPrivateAuditResult(summary)).rejects.toThrow(/identity/)
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({...envelope,status:undefined})))
 expect((await loadPrivateAuditResult(summary)).status.status).toBe('not_checkable')
})

it('widget starts disconnected, shares the human reader and clears green on interruption',async()=>{
 const fetcher=vi.fn(async(url:string)=>{
  if(url==='/v1/health')return json({source_id:'a'.repeat(64),service:'available'})
  if(url.startsWith('/v1/runs?'))return json({source_id:'a'.repeat(64),runs:[summary],next_offset:null})
  if(url.endsWith('/audits'))return json(envelope)
  throw Error('unexpected route')
 })
 vi.stubGlobal('fetch',fetcher)
 render(<RegistryWidget runId={summary.run_id}/>)
 expect(fetcher).not.toHaveBeenCalled()
 expect(screen.getByText('Not connected',{exact:true})).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Connect',exact:true}))
 await screen.findByText('Passed',{exact:true})
 expect(fetcher.mock.calls.map(([url])=>url)).toEqual(['/v1/health','/v1/runs?offset=0&limit=50',`/v1/runs/${summary.run_id}/audits`])
 fetcher.mockRejectedValue(Error('/synthetic/private'))
 fireEvent.click(screen.getByRole('button',{name:'Refresh status',exact:true}))
 await waitFor(()=>expect(screen.queryByText('Passed',{exact:true})).toBeNull())
 expect(screen.getByText('Not checkable',{exact:true})).toBeTruthy()
 expect(document.body.textContent).not.toContain('/synthetic/private')
 expect(document.body.textContent).not.toContain(summary.run_id)
 expect(document.querySelector('details')).toBeNull()
})
