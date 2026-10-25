import type {Artifact,Card,Claim,Criterion,RunDoc} from './types.ts'
import type {LocalEvent} from './local-ledger.ts'
import {canonicalLocal,record,requireLocal} from './local-json.ts'
export function projectLocal(events:LocalEvent[],manifest:unknown):RunDoc{
 requireLocal(record(manifest)&&manifest.manifest_version===1&&record(manifest.agent),'Invalid manifest version/agent')
 const agent=manifest.agent
 requireLocal(typeof agent.name==='string'&&agent.name===(events[0].payload.agent??''),'Manifest agent mismatch')
 const confirmed=new Set<string>(),criteria=new Map<string,{text:string;accepted:boolean;last?:'pass'|'fail';evidence:string[]}>()
 for(const e of events){const p=e.payload
  if(e.type==='criterion.recorded')criteria.set(p.criterion_id as string,{text:p.text as string,accepted:p.source==='user'&&e.actor.kind==='human',evidence:[]})
  if(e.type==='criteria.confirmed')for(const c of p.criteria as {criterion_id:string}[])confirmed.add(c.criterion_id)
  let decision:'pass'|'fail'|undefined
  if(['wrapper','system'].includes(e.actor.kind)){
   if(e.type==='test.reported')decision=Number(p.failed)>0?'fail':p.failed===0&&Number(p.passed)>0?'pass':undefined
   if(e.type==='evidence.attached'&&(p.result==='pass'||p.result==='fail'))decision=p.result
  }
  if(decision)for(const cid of (p.criterion_ids??[]) as string[]){const c=criteria.get(cid)!;c.last=decision;c.evidence.push(e.id)}
 }
 const acceptance=[...criteria].map(([criterion_id,c])=>({criterion_id,text:c.text,evidence:c.evidence,status:!c.accepted&&!confirmed.has(criterion_id)?'proposed':c.last==='pass'?'met':c.last==='fail'?'unmet':'unverified'}))
 const claims:Claim[]=events.filter(e=>e.type==='agent.claim').map(e=>{
  const p=e.payload;requireLocal(typeof p.claim_id==='string'&&typeof p.text==='string','Invalid claim')
  const ids=(p.criterion_ids??[]) as string[]
  return {claim_id:p.claim_id,text:p.text,criterion_ids:ids,finding:p.kind==='completion'&&ids.length>0&&ids.every(cid=>acceptance.find(c=>c.criterion_id===cid)?.status==='met')?'supported':'claim_unwitnessed'}
 })
 const artifacts=events.filter(e=>e.type==='artifact.recorded').map(e=>{const p=e.payload
  requireLocal(['artifact_id','path','sha256'].every(key=>typeof p[key]==='string')&&(p.kind===undefined||p.kind===null||typeof p.kind==='string')&&(p.provenance===undefined||typeof p.provenance==='string'),'Invalid artifact record')
  return {artifact_id:p.artifact_id as string,path:p.path as string,sha256:p.sha256 as string,kind:(p.kind??null) as string|null,provenance:(p.provenance??'original') as string,criterion_ids:p.criterion_ids??[],events:{recorded:e.id}}
 })
 requireLocal(manifest.run_id===events[0].run_id&&manifest.ledger_last_hash===events.at(-1)!.hash&&canonicalLocal(manifest.acceptance)===canonicalLocal(acceptance)&&canonicalLocal(manifest.artifacts)===canonicalLocal(artifacts),'Manifest differs from recomputed ledger')
 const cards:Criterion[]=acceptance.map(a=>{
  const claimed=claims.some(c=>c.criterion_ids.includes(a.criterion_id))
  const card:Card=a.status==='met'?'green':a.status==='unmet'?'red':a.status==='proposed'?'outline':claimed?'yellow':'gray'
  const plain={green:'Proven – witnessed evidence passed.',red:'Failed – the witnessed check did not pass.',outline:'Waiting for your confirmation.',yellow:'Claimed only – nothing checked this yet.',gray:'Not checked yet.'}[card]
  return {...a,claimed,card,plain}
 })
 const start=events[0],fin=events.findLast(e=>e.type==='run.finished')!
 requireLocal(typeof (start.payload.command??'')==='string'&&(fin.payload.exit_code===null||fin.payload.exit_code===undefined||Number.isSafeInteger(fin.payload.exit_code)),'Invalid run command/exit code')
 return {verified:false,integrity:'hash-only',headline:claims.length?["Your agent said: Done.","Here's what's actually proven."]:["Here's what this run actually proves."],review_required:true,
  run:{run_id:start.run_id,project:(events.find(e=>e.type==='requirement.recorded')?.payload.text??'') as string,agent:agent.name,command:(start.payload.command??'') as string,started:start.ts,finished:fin.ts,exit_code:(fin.payload.exit_code??null) as number|null,ledger_last_hash:events.at(-1)!.hash,events:events.length},
  counts:Object.fromEntries((['green','yellow','red','gray','outline'] as Card[]).map(card=>[card,cards.filter(c=>c.card===card).length])) as Record<Card,number>,criteria:cards,claims,artifacts:artifacts as Artifact[],
  events:events.map(e=>({seq:e.seq,id:e.id,ts:e.ts,type:e.type,actor:e.actor,summary:summary(e),hash:e.hash,payload:e.payload}))}
}
function summary(e:LocalEvent){const p=e.payload
 if(e.type==='test.reported')return `Tests run by TruthLens: ${p.passed??0} passed, ${p.failed??0} failed, ${p.skipped??0} skipped`
 if(e.type==='agent.claim')return `Agent said: ${p.text??''}`
 if(e.type==='artifact.recorded')return `File recorded: ${p.path}`
 if(e.type==='run.finished')return `Run closed (exit ${p.exit_code??'unknown'})`
 if(e.type==='criterion.recorded')return `Criterion ${p.criterion_id}: ${p.text}`
 return e.type
}
