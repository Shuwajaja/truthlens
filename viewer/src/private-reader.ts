import type {RunDoc} from './types.ts'
import {validateRunDoc} from './validateRunDoc.ts'

export const MAX_DOCUMENT_BYTES=10*1024*1024
export const MAX_CATALOG_BYTES=1024*1024
export const MAX_CATALOG_RUNS=50
const SOURCE_ID=/^[a-f0-9]{64}$/
const RUN_ID=/^[A-Za-z0-9_-]{1,80}$/

export type PrivateRunSummary={
 run_id:string
 source_id:string
 registration_id:string
 ledger_last_hash:string
 capture_closed_at:string
}
export type PrivateRunCatalog={source_id:string;runs:PrivateRunSummary[];next_offset:number|null}
export type PrivateReaderConnection={sourceId:string;catalog:PrivateRunCatalog}

function record(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value)}
function sourceId(value:unknown):value is string{return typeof value==='string'&&SOURCE_ID.test(value)}
function runId(value:unknown):value is string{return typeof value==='string'&&RUN_ID.test(value)&&value!=='.'&&value!=='..'}
function summary(value:unknown):value is PrivateRunSummary{
 if(!record(value))return false
 return runId(value.run_id)&&sourceId(value.source_id)
  &&typeof value.registration_id==='string'&&value.registration_id.length>0&&value.registration_id.length<=512
  &&typeof value.ledger_last_hash==='string'&&/^[a-f0-9]{64}$/.test(value.ledger_last_hash)
  &&typeof value.capture_closed_at==='string'&&value.capture_closed_at.length<=128
}
function parseCatalog(value:unknown,expectedSourceId:string):PrivateRunCatalog{
 if(!record(value)||value.source_id!==expectedSourceId||!Array.isArray(value.runs)||value.runs.length>MAX_CATALOG_RUNS
  ||!(value.next_offset===null||(Number.isSafeInteger(value.next_offset)&&Number(value.next_offset)>=0))
  ||!value.runs.every(summary))throw Error('Invalid private reader catalog or identity mismatch')
 const runIds=new Set<string>(),sourceIds=new Set<string>([expectedSourceId])
 for(const item of value.runs){
  if(runIds.has(item.run_id)||sourceIds.has(item.source_id))throw Error('Duplicate run identity in private reader catalog')
  runIds.add(item.run_id);sourceIds.add(item.source_id)
 }
 return {source_id:expectedSourceId,runs:value.runs,next_offset:value.next_offset as number|null}
}

async function boundedJson(path:string,maxBytes:number,signal?:AbortSignal):Promise<unknown>{
 // Callers can select only these fixed same-origin routes; no URL or origin is accepted.
 if(path!=='/v1/health'&&!/^\/v1\/runs\?offset=(?:0|[1-9][0-9]*)&limit=50$/.test(path)
  &&!/^\/v1\/runs\/[A-Za-z0-9_-]{1,80}\/document$/.test(path))throw Error('Invalid private reader path')
 const timeout=AbortSignal.timeout(10000)
 const requestSignal=signal?AbortSignal.any([signal,timeout]):timeout
 const response=await fetch(path,{method:'GET',mode:'same-origin',credentials:'omit',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:requestSignal})
 if(response.redirected)throw Error('Private reader redirects are not allowed')
 if(response.status>=300&&response.status<400)throw Error('Private reader redirects are not allowed')
 if(!response.ok)throw Error(`Private reader request failed (${response.status})`)
 if(!response.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw Error('Private reader returned a non-JSON response')
 const length=response.headers.get('content-length')
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw Error('Private reader response is too large')
 if(!response.body)throw Error('Private reader response has no body')
 const reader=response.body.getReader(),chunks:Uint8Array[]=[]
 let total=0
 try{
  while(true){
   const {done,value}=await reader.read()
   if(done)break
   total+=value.byteLength
   if(total>maxBytes){await reader.cancel();throw Error('Private reader response is too large')}
   chunks.push(value)
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(total);let offset=0
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown}
 catch{throw Error('Private reader returned invalid JSON')}
}

async function catalogPage(expectedSourceId:string,offset:number,signal?:AbortSignal):Promise<PrivateRunCatalog>{
 const value=await boundedJson(`/v1/runs?offset=${offset}&limit=50`,MAX_CATALOG_BYTES,signal)
 const page=parseCatalog(value,expectedSourceId)
 if(page.next_offset!==null&&page.next_offset<=offset)throw Error('Private reader catalog cursor did not advance')
 return page
}

export async function connectPrivateReader(signal?:AbortSignal):Promise<PrivateReaderConnection>{
 const health=await boundedJson('/v1/health',16*1024,signal)
 if(!record(health)||!sourceId(health.source_id)||health.service!=='available')throw Error('Private reader health response is invalid')
 const catalog=await catalogPage(health.source_id,0,signal)
 return {sourceId:health.source_id,catalog}
}

export async function loadPrivateCatalogPage(expectedSourceId:string,offset:number,signal?:AbortSignal):Promise<PrivateRunCatalog>{
 if(!sourceId(expectedSourceId)||!Number.isSafeInteger(offset)||offset<0||offset>1_000_000)throw Error('Invalid private reader catalog request')
 return catalogPage(expectedSourceId,offset,signal)
}

export async function loadPrivateRun(item:PrivateRunSummary,signal?:AbortSignal):Promise<RunDoc>{
 if(!summary(item))throw Error('Invalid private reader run reference')
 const value=await boundedJson(`/v1/runs/${encodeURIComponent(item.run_id)}/document`,MAX_DOCUMENT_BYTES,signal)
 if(!record(value)||value.source_id!==item.source_id||!validateRunDoc(value.document))throw Error('Private reader document identity or structure is invalid')
 if(value.document.run.run_id!==item.run_id)throw Error('Private reader document run id does not match the requested run id')
 if(value.document.run.ledger_last_hash!==item.ledger_last_hash)throw Error('Private reader document head does not match its catalog entry')
 return value.document
}
