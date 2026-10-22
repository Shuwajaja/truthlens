import {Fragment} from 'react'
import {Play,FilePenLine,Check,X,FileText,Quote,Circle} from 'lucide-react'
import {recordedTime,recordedDuration} from './overview-data.ts'
import {testTone} from '../lib/event-result.ts'
import type {RunEvent} from '../types.ts'
import type {Lens} from '../lens.ts'
import type {DrawerTarget} from './Drawer.tsx'

type Entry={event:RunEvent;previous?:RunEvent}
const setup=new Set(['run.started','requirement.recorded','criterion.recorded','criteria.confirmed'])
const number=new Intl.NumberFormat('en-GB')
function relative(ts:string,base:string){
 const ms=Date.parse(ts)-Date.parse(base)
 return Number.isFinite(ms)?`${ms<0?'−':'+'}${number.format(Math.abs(ms))} ms`:'Unreadable time'
}
function label(event:RunEvent){
 if(event.summary!==event.type)return event.summary
 const known:Record<string,string>={'run.started':'Run started','run.finished':'Run ended','requirement.recorded':'Task recorded','criterion.recorded':'Criterion recorded','criteria.confirmed':'Criteria met','evidence.attached':'Evidence attached','artifact.recorded':'File recorded','agent.claim':'Agent claim','test.reported':'Test result recorded'}
 return known[event.type]??event.summary
}
function TimelineEvent({entry,base,lens,onOpenDrawer}:{entry:Entry;base:string;lens:Lens;onOpenDrawer:(target:DrawerTarget)=>void}){
 const {event,previous}=entry
 const test=testTone(event)
 const tone=event.type==='test.reported'?test:/^(requirement|criterion|criteria|evidence|artifact)\./.test(event.type)?'info':'open'
 const Icon=event.type==='run.started'?Play:event.type==='agent.claim'?Quote:event.type==='test.reported'?(test==='ok'?Check:test==='fail'?X:Circle):/^(requirement|criterion|criteria)\./.test(event.type)?FilePenLine:/^(evidence|artifact)\./.test(event.type)?FileText:Circle
 const gap=previous?Date.parse(event.ts)-Date.parse(previous.ts):0
 const summary=label(event)
 return <Fragment>
  {gap>1000&&<li className="timeline-gap">··· Agent working {new Intl.NumberFormat('en-GB',{maximumFractionDigits:1}).format(gap/1000)} s ···</li>}
  <li className="timeline-event" data-tone={tone}><button type="button" aria-label={`Event #${event.seq}: ${event.summary}${summary!==event.summary?` · ${summary}`:''}`} onClick={()=>onOpenDrawer({kind:'event',event})}>
   <span className={`timeline-icon tone-${tone}`}><Icon size={14} aria-hidden="true"/></span>
   <span className="timeline-copy"><span>{summary}</span>{lens==='developer'&&<code>#{event.seq} · {event.type} · {event.actor.kind} / {event.actor.id}</code>}</span>
   <time dateTime={event.ts} title={recordedTime(event.ts)}>{relative(event.ts,base)}</time>
  </button></li>
 </Fragment>
}
export function Timeline({events,lens,onOpenDrawer,headingLevel=1}:{events:readonly RunEvent[];lens:Lens;onOpenDrawer:(target:DrawerTarget)=>void;headingLevel?:1|2}){
 const sorted=[...events].sort((a,b)=>a.seq-b.seq)
 const entries=sorted.map((event,index)=>({event,previous:sorted[index-1]}))
 const firstResult=entries.findIndex(entry=>!setup.has(entry.event.type))
 const boundary=firstResult<0?entries.length:firstResult
 const phases=[{title:'01 Task',entries:entries.slice(0,boundary)},{title:'02 Result',entries:entries.slice(boundary)}].filter(phase=>phase.entries.length>0)
 const Heading=headingLevel===1?'h1':'h2'
 const PhaseHeading=headingLevel===1?'h2':'h3'
 const base=sorted[0]?.ts
 return <section className="timeline-view"><div className="panel-heading"><Heading>{headingLevel===1?'Timeline':'Timeline'}</Heading><span className="section-note">{events.length} events</span></div>
  <p className="section-note">Times come from recorded timestamps. Not live.</p>
  {phases.length===0?<p className="text-2">No events exported.</p>:phases.map(phase=>{
   const groups:Entry[][]=[]
   for(const entry of phase.entries){
    const last=groups.at(-1)
    if(entry.event.type==='agent.claim'&&last?.at(-1)?.event.type==='agent.claim')last.push(entry)
    else groups.push([entry])
   }
   return <section className="timeline-phase" key={phase.title}><div className="phase-heading"><PhaseHeading>{phase.title}</PhaseHeading><p><time dateTime={phase.entries[0].event.ts}>{recordedTime(phase.entries[0].event.ts)}</time> · Span {recordedDuration(phase.entries[0].event.ts,phase.entries.at(-1)!.event.ts)}</p></div>
    <ol className="timeline-rail">{groups.map((group,index)=>group.length>1?<li key={index} className="timeline-claims"><details><summary>{group.length} claims</summary><ol>{group.map((entry,i)=><TimelineEvent key={i} entry={entry} base={base!} lens={lens} onOpenDrawer={onOpenDrawer}/>)}</ol></details></li>:<TimelineEvent key={index} entry={group[0]} base={base!} lens={lens} onOpenDrawer={onOpenDrawer}/>)}</ol>
   </section>
  })}
 </section>
}
