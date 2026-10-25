import {canonicalLocal,decodeLocal,parseLocalJson,record,requireLocal,sha256,utf8} from './local-json.ts'
export type LocalEvent={schema_version:number;id:string;seq:number;ts:string;run_id:string;actor:{kind:string;id:string};type:string;payload:Record<string,unknown>;prev_hash:string;hash:string;hmac?:string;hmac_key_id?:string;request_id?:string}
const required=['schema_version','id','seq','ts','run_id','actor','type','payload','prev_hash','hash']
const allowed=new Set([...required,'hmac','hmac_key_id','request_id'])
export const isHash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const id=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value)
function timestamp(value:unknown):bigint{
 requireLocal(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value),'Invalid UTC timestamp')
 const n=Date.parse(value.slice(0,19)+'Z');requireLocal(Number.isFinite(n)&&new Date(n).toISOString().slice(0,19)===value.slice(0,19),'Invalid UTC timestamp')
 return BigInt(n)*1000n+BigInt(value.slice(20,-1).padEnd(6,'0'))
}
export async function verifyLocalLedger(bytes:Uint8Array,maxEvents:number):Promise<LocalEvent[]>{
 const text=decodeLocal(bytes);requireLocal(text.endsWith('\n'),'Ledger torn tail')
 const lines=text.slice(0,-1).split('\n');requireLocal(lines.length>0&&lines.length<=maxEvents,'Ledger event count limit')
 const events:LocalEvent[]=[],ids=new Set<string>(),requirements=new Set<string>(),criteria=new Map<string,string>(),approvals=new Map<string,{payload:Record<string,unknown>;consumed:boolean}>(),blocked=new Set<string>(),requests=new Set<string>()
 let prev='0'.repeat(64),runId='',closed=false,anyHmac=false
 for(const [index,line] of lines.entries()){
  const v=parseLocalJson(line)
  requireLocal(record(v)&&required.every(key=>Object.hasOwn(v,key))&&Object.keys(v).every(key=>allowed.has(key)),'Invalid ledger envelope fields')
  requireLocal(v.schema_version===1&&v.seq===index+1,'Invalid ledger schema/seq')
  requireLocal(id(v.id)&&!ids.has(v.id)&&id(v.run_id),'Invalid or duplicate event/run id');ids.add(v.id)
  requireLocal(typeof v.type==='string'&&v.type.length>0&&record(v.actor)&&['human','agent','wrapper','system'].includes(String(v.actor.kind))&&typeof v.actor.id==='string'&&v.actor.id.length>0,'Invalid ledger actor/type')
  timestamp(v.ts)
  requireLocal(record(v.payload),'Invalid ledger payload');const p=v.payload,t=v.type,kind=v.actor.kind
  requireLocal(utf8.encode(canonicalLocal(p)).byteLength<=64*1024,'Ledger payload size > 64 KiB')
  requireLocal(canonicalLocal(v)===line,'Noncanonical ledger line')
  runId=runId||v.run_id;requireLocal(v.run_id===runId&&v.prev_hash===prev,'Ledger run/previous hash mismatch')
  const body=Object.fromEntries(Object.entries(v).filter(([key])=>key!=='hash'&&key!=='hmac'))
  requireLocal(isHash(v.hash)&&await sha256(utf8.encode(canonicalLocal(body)))===v.hash,'Ledger hash mismatch')
  if(Object.hasOwn(v,'hmac')){requireLocal(isHash(v.hmac)&&typeof v.hmac_key_id==='string'&&v.hmac_key_id.length>0,'Invalid HMAC metadata');anyHmac=true}
  if(Object.hasOwn(v,'request_id')){requireLocal(id(v.request_id)&&!requests.has(v.request_id),'Duplicate/invalid request id');requests.add(v.request_id)}
  requireLocal(!closed||t==='ledger.repaired','Event after run close')
  if(t==='run.finished'){requireLocal(p.last_hash===prev,'Run close anchor mismatch');closed=true}
  if(t==='requirement.recorded'){requireLocal(id(p.requirement_id)&&!requirements.has(p.requirement_id)&&typeof p.text==='string','Invalid/duplicate requirement');requirements.add(p.requirement_id)}
  if(t==='criterion.recorded'){
   requireLocal(id(p.criterion_id)&&!criteria.has(p.criterion_id)&&typeof p.text==='string'&&isHash(p.text_sha256),'Invalid/duplicate criterion')
   requireLocal(await sha256(utf8.encode(p.text.normalize('NFC')))===p.text_sha256,'Criterion text hash mismatch')
   requireLocal(p.requirement_id===undefined||typeof p.requirement_id==='string'&&requirements.has(p.requirement_id),'Unknown requirement')
   requireLocal((p.source==='user'&&kind==='human')||(p.source==='derived'&&record(p.derived_by)),'Invalid criterion author/source');criteria.set(p.criterion_id,p.text_sha256)
  }
  if(t==='criteria.confirmed'||t==='approval.granted')requireLocal(kind==='human',`${t} requires human actor`)
  if(t==='criteria.confirmed'){
   requireLocal(Array.isArray(p.criteria),'Invalid confirmation')
   for(const c of p.criteria)requireLocal(record(c)&&typeof c.criterion_id==='string'&&criteria.has(c.criterion_id)&&criteria.get(c.criterion_id)===c.text_sha256,'Unknown criterion/text in confirmation')
  }
  if(p.criterion_ids!==undefined)requireLocal(Array.isArray(p.criterion_ids)&&p.criterion_ids.every(cid=>typeof cid==='string'&&criteria.has(cid)),'Unknown criterion reference')
  if(t==='test.reported'||t==='evidence.attached'&&['pass','fail'].includes(String(p.result)))requireLocal(kind==='wrapper'||kind==='system','Evidence must be witnessed by wrapper/system')
  if(t==='test.reported')requireLocal(['passed','failed','skipped'].every(key=>p[key]===undefined||Number.isSafeInteger(p[key])&&Number(p[key])>=0),'Invalid test counts')
  if(t==='approval.granted'){requireLocal(typeof p.action_hash==='string'&&p.action_hash.length>0,'Missing approval action hash');approvals.set(v.id,{payload:p,consumed:false})}
  if(t==='action.blocked'&&typeof p.action_hash==='string')blocked.add(p.action_hash)
  if(t==='action.executed'){
   requireLocal(typeof p.action_hash==='string'&&p.action_hash.length>0,'Missing executed action hash')
   requireLocal(!blocked.has(p.action_hash)||p.approval_event_id!==undefined,'Blocked action without approval')
   if(p.approval_event_id!==undefined){const a=approvals.get(String(p.approval_event_id));requireLocal(a&&!a.consumed&&a.payload.simulated!==true&&a.payload.action_hash===p.action_hash,'Invalid or consumed approval');requireLocal(timestamp(a.payload.expires_at)>=timestamp(v.ts),'Expired approval');a.consumed=true}
  }
  prev=v.hash;events.push(v as LocalEvent)
 }
 requireLocal(events[0]?.type==='run.started'&&events.filter(e=>e.type==='run.started').length===1&&closed&&['run.finished','ledger.repaired'].includes(events.at(-1)!.type),'Local folder requires exactly one initial run.started and a closed ledger')
 if(anyHmac)requireLocal(events.every(e=>!['approval.granted','criteria.confirmed'].includes(e.type)||e.hmac!==undefined),'Missing HMAC on human record')
 return events
}
