import {afterEach,expect,it,vi} from 'vitest'
import {connectPrivateReader,loadPrivateCatalogPage,loadPrivateRun,MAX_CATALOG_BYTES,MAX_DOCUMENT_BYTES} from '../src/private-reader.ts'
import run from '../fixtures/demo-run.json'

const contextId='a'.repeat(64),runSourceId='b'.repeat(64)
const catalog={source_id:contextId,runs:[{run_id:run.run.run_id,source_id:runSourceId,registration_id:'registration_1',ledger_last_hash:run.run.ledger_last_hash,capture_closed_at:'2026-10-23T00:00:00.000Z'}],next_offset:null}
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}})
afterEach(()=>vi.unstubAllGlobals())

it.each([0,50])('rejects a non-advancing catalog cursor at offset %s',async offset=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({...catalog,next_offset:offset})))
 await expect(loadPrivateCatalogPage(contextId,offset)).rejects.toThrow(/cursor/)
})

it('accepts an advancing catalog page without fetching any document',async()=>{
 const fetchMock=vi.fn().mockResolvedValue(json({...catalog,next_offset:100}))
 vi.stubGlobal('fetch',fetchMock)
 expect((await loadPrivateCatalogPage(contextId,50)).next_offset).toBe(100)
 expect(fetchMock.mock.calls.map(([url])=>url)).toEqual(['/v1/runs?offset=50&limit=50'])
})

it('connects only through the fixed same-origin health and first catalog paths',async()=>{
 const fetchMock=vi.fn().mockResolvedValueOnce(json({source_id:contextId,service:'available'})).mockResolvedValueOnce(json(catalog))
 vi.stubGlobal('fetch',fetchMock)
 const result=await connectPrivateReader()
 expect(result.sourceId).toBe(contextId)
 expect(result.catalog.runs[0].source_id).toBe(runSourceId)
 expect(fetchMock.mock.calls.map(([url])=>url)).toEqual(['/v1/health','/v1/runs?offset=0&limit=50'])
 expect(fetchMock.mock.calls.every(([,options])=>options.redirect==='error'&&options.credentials==='omit')).toBe(true)
})

it('rejects catalog identity drift and malformed source identifiers',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(json({source_id:contextId,service:'available'})).mockResolvedValueOnce(json({...catalog,source_id:'wrong'})))
 await expect(connectPrivateReader()).rejects.toThrow(/identity/)
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(json({source_id:'not-a-hash',service:'available'})))
 await expect(connectPrivateReader()).rejects.toThrow(/health/)
})

it('rejects oversized responses before parsing and prevents redirects',async()=>{
 const tooLarge=new Response(' '.repeat(MAX_CATALOG_BYTES+1),{headers:{'content-type':'application/json'}})
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(tooLarge))
 await expect(connectPrivateReader()).rejects.toThrow(/too large/)
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:302,headers:{location:'https://example.test'}})))
 await expect(connectPrivateReader()).rejects.toThrow(/redirect|health/i)
})

it('loads one run document only when requested and checks both source and run identity',async()=>{
 const fetchMock=vi.fn().mockResolvedValue(json({source_id:runSourceId,document:run}))
 vi.stubGlobal('fetch',fetchMock)
 const doc=await loadPrivateRun(catalog.runs[0])
 expect(doc.run.run_id).toBe(run.run.run_id)
 expect(fetchMock).toHaveBeenCalledWith(`/v1/runs/${encodeURIComponent(run.run.run_id)}/document`,expect.objectContaining({redirect:'error'}))
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({source_id:contextId,document:run})))
 await expect(loadPrivateRun(catalog.runs[0])).rejects.toThrow(/identity/)
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(json({source_id:runSourceId,document:{...run,run:{...run.run,run_id:'run_other'}}})))
 await expect(loadPrivateRun(catalog.runs[0])).rejects.toThrow(/run id/)
})

it('rejects a document that exceeds the fixed 10 MiB limit',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(' '.repeat(MAX_DOCUMENT_BYTES+1),{headers:{'content-type':'application/json'}})))
 await expect(loadPrivateRun(catalog.runs[0])).rejects.toThrow(/too large/)
})
