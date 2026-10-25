import {afterEach,expect,it,vi} from 'vitest'
import {loadPrivateAudit} from '../src/private-reader.ts'
import fixture from '../fixtures/demo-run.json'
const item={run_id:fixture.run.run_id,source_id:'b'.repeat(64),registration_id:'registration_1',ledger_last_hash:fixture.run.ledger_last_hash,capture_closed_at:'2026-10-23T00:00:00.000Z'}
const report={audit_version:1,run_id:item.run_id,ledger_last_hash:item.ledger_last_hash,checks:[{rule_id:'TL-AUD-001',outcome:'supported',required:true,message:'Ledger structure and chain checked.',event_ids:[],criterion_ids:[]}],limitations:['Integrity is not approval.']}
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}})
afterEach(()=>vi.unstubAllGlobals())
it('reads the existing stored audit route with fixed GET policy and no audit execution',async()=>{
 const fetch=vi.fn().mockResolvedValue(json({source_id:item.source_id,audit:report}));vi.stubGlobal('fetch',fetch)
 expect(await loadPrivateAudit(item)).toEqual(report)
 expect(fetch).toHaveBeenCalledExactlyOnceWith(`/v1/runs/${item.run_id}/audits`,expect.objectContaining({method:'GET',credentials:'omit',redirect:'error',cache:'no-store'}))
})
it('represents an absent stored report honestly',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({source_id:item.source_id,audit:null})))
 expect(await loadPrivateAudit(item)).toBeNull()
})
it.each([
 {source_id:'c'.repeat(64),audit:report},
 {source_id:item.source_id,audit:{...report,run_id:'foreign'}},
 {source_id:item.source_id,audit:{...report,ledger_last_hash:'d'.repeat(64)}},
 {source_id:item.source_id,audit:{...report,audit_version:2}},
 {source_id:item.source_id,audit:{...report,checks:[{...report.checks[0],outcome:'verified'}]}},
 {source_id:item.source_id,audit:{...report,checks:[{...report.checks[0],required:'true'}]}},
 {source_id:item.source_id,audit:{...report,checks:[{...report.checks[0],event_ids:[42]}]}},
 {source_id:item.source_id,audit:{...report,limitations:'all fine'}},
])('rejects foreign or malformed stored reports %#',async value=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json(value)))
 await expect(loadPrivateAudit(item)).rejects.toThrow(/audit|identity|anchor/i)
})
it('bounds stored audit responses before parsing',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{headers:{'content-type':'application/json','content-length':String(10*1024*1024+1)}})))
 await expect(loadPrivateAudit(item)).rejects.toThrow(/too large/)
})
