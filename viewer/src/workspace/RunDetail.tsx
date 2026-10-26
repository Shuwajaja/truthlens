import {useId,useMemo,useRef} from 'react'
import type {Claim,Criterion,RunDoc,RunEvent} from '../types.ts'
import {ScoreRing} from './RunCharts.tsx'
import {criterionStates,type CriterionCounts} from './cross-run-data.ts'
import {overviewCopy,type OverviewCopy} from './overview-copy.ts'
import {useOverviewLanguage} from './overview-language.ts'
import {recordedTime,overviewTime} from '../components/overview-data.ts'
import './run-detail.css'

type Entry={criterion?:Criterion;claims:Claim[];events:RunEvent[];missing:number}
/** Joins use recorded IDs only; no text matching or inferred test outcomes. */
function detailEntries(doc:RunDoc){
 const events=new Map(doc.events.map(event=>[event.id,event]))
 const criteria=new Set(doc.criteria.map(c=>c.criterion_id))
 const byCriterion=new Map<string,Claim[]>()
 for(const claim of doc.claims)for(const id of new Set(claim.criterion_ids)){
  const list=byCriterion.get(id)??[];list.push(claim);byCriterion.set(id,list)
 }
 const rows:Entry[]=doc.criteria.map(criterion=>{
  const matched=[...new Set(criterion.evidence)].flatMap(id=>{const event=events.get(id);return event?[event]:[]})
  return {criterion,claims:byCriterion.get(criterion.criterion_id)??[],events:matched,missing:new Set(criterion.evidence).size-matched.length}
 })
 for(const claim of doc.claims)if(!claim.criterion_ids.some(id=>criteria.has(id)))rows.push({claims:[claim],events:[],missing:0})
 return {rows,criteria}
}
function Finding({claim,copy}:{claim:Claim;copy:OverviewCopy}){
 return <span className="claim-finding">{claim.finding==='supported'?copy.supported:copy.unwitnessed}</span>
}
function Fields({event,copy}:{event:RunEvent;copy:OverviewCopy}){
 const p=event.payload
 const number=(key:string)=>typeof p[key]==='number'&&Number.isSafeInteger(p[key])?p[key] as number:null
 const fields:[string,string|number][]=[]
 const exit=number('exit_code');if(exit!==null)fields.push([copy.exitLabel,exit])
 if(typeof p.result==='string'&&p.result)fields.push([copy.resultLabel,p.result])
 if(event.type==='test.reported')for(const [key,label] of [['passed',copy.passedLabel],['failed',copy.failedLabel],['skipped',copy.skippedLabel]]){
  const value=number(key);if(value!==null&&value>=0)fields.push([label,value])
 }
 return <span>{event.type}{fields.map(([label,value])=><span key={label}> · {label}: {value}</span>)}</span>
}
function Reason({entry,copy}:{entry:Entry;copy:OverviewCopy}){
 return <div className="claim-reason">
  {entry.criterion&&<p>{copy.statusLabel}: {copy[entry.criterion.status as keyof CriterionCounts]}.</p>}
  {entry.claims.map(claim=><p key={claim.claim_id}><Finding claim={claim} copy={copy}/> · <code>finding: {claim.finding}</code></p>)}
  {entry.missing>0&&<p>{copy.missingEvidence}: {entry.missing}.</p>}
  {!entry.events.length?<p>{copy.noReason}</p>:<ul>{entry.events.map(event=><li key={event.id}><Fields event={event} copy={copy}/></li>)}</ul>}
 </div>
}
export function RunDetail({doc,onRuns}:{doc:RunDoc;onRuns:()=>void}){
 const {language}=useOverviewLanguage(),copy=overviewCopy[language],id=useId(),strip=useRef<HTMLDivElement>(null)
 const {rows,criteria}=useMemo(()=>detailEntries(doc),[doc])
 const byCriterion=new Map(rows.flatMap(row=>row.criterion?[[row.criterion.criterion_id,row] as const]:[]))
 const counts:CriterionCounts={met:0,unmet:0,unverified:0,proposed:0}
 for(const c of doc.criteria)counts[c.status as keyof CriterionCounts]++
 const supported=doc.claims.filter(claim=>claim.finding==='supported').length,unwitnessed=doc.claims.length-supported
 const score=doc.criteria.length?`${counts.met} ${copy.of} ${doc.criteria.length} ${copy.criteriaMet}`:copy.noCriteria
 const events=useMemo(()=>doc.events.toSorted((a,b)=>a.seq-b.seq),[doc.events])
 const move=(direction:number)=>{const el=strip.current;if(el)el.scrollBy({left:direction*((el.firstElementChild?.getBoundingClientRect().width??el.clientWidth)+12),behavior:'auto'})}
 const time=(value:string,empty:string)=>value?<time dateTime={value} title={recordedTime(value)}>{overviewTime(value,language)}</time>:empty
 return <div className="run-detail" lang={language}>
  <button type="button" className="run-back" onClick={onRuns}>← {copy.overview}</button>
  <section className="run-detail-summary" aria-label={score}>
   <ScoreRing criteria={counts} label={score} copy={copy}/>
   <div className="run-detail-heading"><p className="run-detail-identity">{copy.runDetail} {doc.run.run_id} · {doc.run.agent||copy.noAgent}</p>
    <h1>{doc.run.project||copy.untitled}</h1><h2>{score}</h2>
    <p>{doc.claims.length?`${doc.claims.length} ${copy.recordedClaims}; ${supported} ${copy.supported}, ${unwitnessed} ${copy.unwitnessed}. ${score}.`:copy.noClaims}</p>
    <div className="run-detail-statuses">{criterionStates.map(status=><span key={status} className="criterion-pill" data-criterion={status}>{copy[status]} {counts[status]}</span>)}</div>
    <p className="run-detail-time">{time(doc.run.started,copy.noStart)}</p>
   </div>
   <div className="run-detail-boundary"><p className="overview-seal">{copy.hashOnly}</p><p>{copy.approval}</p></div>
  </section>
  <section className="run-detail-claims" aria-labelledby={`${id}-claims`}><h2 id={`${id}-claims`}>{copy.claimsTitle}</h2>
   {!rows.length?<p>{copy.noCriteria}</p>:<><div ref={strip} className="claim-cards" role="region" aria-label={copy.claimStrip} tabIndex={0}>
    {rows.map((entry,index)=><article className="claim-card" data-criterion={entry.criterion?.status??'unverified'} key={entry.criterion?`criterion:${entry.criterion.criterion_id}`:`claim:${entry.claims[0].claim_id}`} aria-labelledby={`${id}-card-${index}`}>
     <h3 id={`${id}-card-${index}`}>{entry.criterion?.text??entry.claims[0].text}</h3>
     <p className="claim-label">{copy.agentSays}:</p>
     {!entry.claims.length?<p>{copy.noClaim}</p>:entry.claims.map(claim=><div key={claim.claim_id} className="claim-words"><p>{claim.text}</p><Finding claim={claim} copy={copy}/>{claim.criterion_ids.some(ref=>!criteria.has(ref))&&<p>{copy.missingCriteria}: {claim.criterion_ids.filter(ref=>!criteria.has(ref)).length}.</p>}</div>)}
     <div className="claim-result"><span className="claim-label">{copy.recordShows}:</span>{entry.criterion?<span className="criterion-pill" data-criterion={entry.criterion.status}>{copy[entry.criterion.status as keyof CriterionCounts]}</span>:<p>{copy.noCriterion}</p>}</div>
     <p className="claim-label">{copy.evidenceLabel}: {entry.events.length}</p>
     <details className="claim-why"><summary>{copy.why}</summary><Reason entry={entry} copy={copy}/></details>
    </article>)}
   </div><div className="claim-strip-controls"><button type="button" onClick={()=>move(-1)} aria-label={copy.previousClaim}>←</button><span>{copy.swipeClaims}</span><button type="button" onClick={()=>move(1)} aria-label={copy.nextClaim}>→</button></div></>}
  </section>
  <section className="run-gap" role="region" aria-labelledby={`${id}-gap`}><h2 id={`${id}-gap`}>{copy.gapTitle}</h2>
   {!doc.claims.length?<p>{copy.noClaims}</p>:<><p className="gap-counts">{supported} {copy.supported} · {unwitnessed} {copy.unwitnessed}</p>
    <div className="gap-table"><div className="gap-table-heading"><span>{copy.agentSays}</span><span aria-hidden="true"/><span>{copy.recordShows}</span></div>
     {doc.claims.map(claim=>{
      const linked=[...new Set(claim.criterion_ids)].flatMap(ref=>{const row=byCriterion.get(ref);return row?[row]:[]})
      const missing=new Set(claim.criterion_ids.filter(ref=>!criteria.has(ref))).size
      return <div className="gap-row" data-finding={claim.finding} key={claim.claim_id}><p>{claim.text}</p><span className="gap-connector"><span>{claim.finding==='claim_unwitnessed'?copy.gap:'✓'}</span></span><div><Finding claim={claim} copy={copy}/>{!linked.length&&<p>{copy.noCriterion}</p>}{missing>0&&<p>{copy.missingCriteria}: {missing}.</p>}{linked.map(entry=><div key={entry.criterion!.criterion_id}><p>{entry.criterion!.text} · {copy[entry.criterion!.status as keyof CriterionCounts]}</p><p>{copy.evidenceLabel}: {entry.events.length}</p>{entry.missing>0&&<p>{copy.missingEvidence}: {entry.missing}.</p>}{!entry.events.length?<p>{copy.noReason}</p>:entry.events.map(event=><p key={event.id}><Fields event={event} copy={copy}/></p>)}</div>)}</div></div>
     })}
    </div></>}
  </section>
  <section className="run-detail-timeline" role="region" aria-labelledby={`${id}-timeline`}><h2 id={`${id}-timeline`}>{copy.timelineTitle}</h2>
   {!events.length?<p>{copy.noEvents}</p>:<ol>{events.map(event=><li key={event.id} data-seq={event.seq}><span className="timeline-marker" aria-hidden="true"/><div><p>{event.summary||event.type}</p><p className="timeline-meta">#{event.seq} · {event.type} · {event.actor.kind} · {event.actor.id}</p></div>{time(event.ts,copy.noTime)}</li>)}</ol>}
  </section>
  <footer className="overview-boundary"><p>{copy.claimLimitations}</p><p>{copy.approval}</p></footer>
 </div>
}
