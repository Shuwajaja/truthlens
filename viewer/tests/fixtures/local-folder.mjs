// Synthetic v1 folder. Independent Node encoder/hash oracle; no key or live run.
import {createHash} from 'node:crypto'
export const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(typeof value==='string'?value.normalize('NFC'):value):Array.isArray(value)?`[${value.map(canonical).join(',')}]`:`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
export function fixture(blob=Buffer.from('Original evidence\r\nwith exact bytes.\n')){
 const sha=hash(blob),events=[]
 const add=(type,payload,kind='wrapper')=>{
  const body={schema_version:1,id:`evt_synthetic_${events.length}`,seq:events.length+1,ts:'2026-10-25T00:00:00.000Z',run_id:'run_synthetic',actor:{kind,id:'synthetic'},type,payload,prev_hash:events.at(-1)?.hash??'0'.repeat(64)}
  events.push({...body,hash:hash(canonical(body))})
 }
 add('run.started',{agent:'Synthetic agent',command:'synthetic command'})
 add('requirement.recorded',{requirement_id:'r1',text:'Synthetic local folder',source:'user'},'human')
 add('criterion.recorded',{criterion_id:'c1',requirement_id:'r1',text:'Evidence is present',text_sha256:hash('Evidence is present'),source:'user'},'human')
 add('artifact.recorded',{artifact_id:'a1',path:'evidence.txt',sha256:sha,kind:'document',criterion_ids:['c1']})
 add('test.reported',{passed:1,failed:0,skipped:0,criterion_ids:['c1']})
 add('run.finished',{last_hash:events.at(-1).hash,exit_code:0})
 const manifest={manifest_version:1,run_id:'run_synthetic',ledger_last_hash:events.at(-1).hash,agent:{name:'Synthetic agent'},artifacts:[{artifact_id:'a1',path:'evidence.txt',sha256:sha,kind:'document',provenance:'original',criterion_ids:['c1'],events:{recorded:events[3].id}}],acceptance:[{criterion_id:'c1',text:'Evidence is present',evidence:[events[4].id],status:'met'}]}
 const files=new Map([['ledger.jsonl',Buffer.from(events.map(canonical).join('\n')+'\n')],['manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n')],[`blobs/sha256/${sha.slice(0,2)}/${sha}`,blob]])
 return {files,events,manifest,sha,add,sync(){files.set('ledger.jsonl',Buffer.from(events.map(canonical).join('\n')+'\n'));files.set('manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'))}}
}
export const entries=files=>[...files].map(([path,bytes])=>({path,kind:'file',size:bytes.length,read:async()=>new Uint8Array(bytes)}))
