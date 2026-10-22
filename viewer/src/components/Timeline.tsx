import {PageHeading} from './PageHeading.tsx'
import {Empty,EmptyDescription} from './ui/empty.tsx'
import {Fragment} from 'react'
import {groupRecordedPhases} from '../lib/recorded-steps.ts'
import {StepFacts,StepTime,RecordedOutput} from './RecordedStep.tsx'
import {RecordedText} from './RecordedText.tsx'
import {Play,FilePenLine,Check,X,FileText,Quote,Circle} from 'lucide-react'
import {recordedTime,recordedDuration} from './overview-data.ts'
import {testTone} from '../lib/event-result.ts'
import type {RunEvent} from '../types.ts'
import type {Lens} from '../lens.ts'
import type {DrawerTarget} from './Drawer.tsx'

type Entry={event:RunEvent;previous?:RunEvent}
function label(event:RunEvent){
 if(event.type==='criteria.confirmed')return event.actor.kind==='human'?'Criteria confirmed by human':'Criteria confirmation recorded'
 if(event.summary!==event.type)return event.summary
 const known:Record<string,string>={'run.started':'Run started','run.finished':'Run ended','requirement.recorded':'Task recorded','criterion.recorded':'Criterion recorded','evidence.attached':'Evidence attached','artifact.recorded':'File recorded','agent.claim':'Agent claim','test.reported':'Test result recorded'}
 return known[event.type]??event.summary
}
function TimelineEvent({entry,base,lens,onOpenDrawer,blobs}:{entry:Entry;base:string;lens:Lens;blobs?:Record<string,string>;onOpenDrawer:(target:DrawerTarget)=>void}){
 const {event,previous}=entry
 const test=testTone(event)
 const tone=event.type==='test.reported'?test:/^(requirement|criterion|criteria|evidence|artifact)\./.test(event.type)?'info':'open'
 const Icon=event.type==='run.started'?Play:event.type==='agent.claim'?Quote:event.type==='test.reported'?(test==='ok'?Check:test==='fail'?X:Circle):/^(requirement|criterion|criteria)\./.test(event.type)?FilePenLine:/^(evidence|artifact)\./.test(event.type)?FileText:Circle
 const gap=previous?Date.parse(event.ts)-Date.parse(previous.ts):0
 const summary=label(event)
 const longSummary=summary.length>240||summary.split('\n').length>3
 return <Fragment>
  {gap>1000&&<li className="timeline-gap">Gap between records {new Intl.NumberFormat('en-GB',{maximumFractionDigits:1}).format(gap/1000)} s</li>}
  <li className="timeline-event" data-tone={tone}><button type="button" onClick={()=>onOpenDrawer({kind:'event',event})}>
   <span className={`timeline-icon tone-${tone}`}><Icon size={14} aria-hidden="true"/></span>
   <span className="timeline-copy"><span className="step-title">{longSummary?summary.slice(0,160)+'…':summary}</span><StepFacts event={event}/>{event.type==='criteria.confirmed'&&<span className="block section-note">Confirmation is not a test result.</span>}{lens==='developer'&&<code className="developer-only"><span>Developer</span> · <span>#{event.seq} · {event.type} · {event.actor.kind} / {event.actor.id}</span></code>}</span>
   <StepTime event={event} base={base}/>
  </button>{longSummary&&<RecordedText text={summary}/>}{blobs&&<RecordedOutput event={event} blobs={blobs}/>}</li>
 </Fragment>
}
export function Timeline({events,lens,onOpenDrawer,headingLevel=1,blobs}:{blobs?:Record<string,string>;events:readonly RunEvent[];lens:Lens;onOpenDrawer:(target:DrawerTarget)=>void;headingLevel?:1|2}){
 const sorted=[...events].sort((a,b)=>a.seq-b.seq)
 const entries=sorted.map((event,index)=>({event,previous:sorted[index-1]}))
 const phases=groupRecordedPhases(entries)
 const PhaseHeading=headingLevel===1?'h2':'h3'
 const base=sorted[0]?.ts
 return <section className="timeline-view"><PageHeading title="Timeline" level={headingLevel} description="Follow the recorded sequence; open an event to inspect its evidence." action={<span className="section-note">{events.length} events</span>}/>
  <p className="section-note">Grouped by recorded event type. Times are recorded, not live.</p>
  {phases.length===0?<Empty><EmptyDescription>No events exported.</EmptyDescription></Empty>:phases.map((phase,phaseIndex)=>{
   const groups:Entry[][]=[]
   for(const entry of phase.items){
    const last=groups.at(-1)
    if(entry.event.type==='agent.claim'&&last?.at(-1)?.event.type==='agent.claim')last.push(entry)
    else groups.push([entry])
   }
   return <section className="timeline-phase" key={phase.items[0].event.id}><div className="phase-heading"><PhaseHeading>{String(phaseIndex+1).padStart(2,'0')} {phase.kind}</PhaseHeading><p><time dateTime={phase.items[0].event.ts}>{recordedTime(phase.items[0].event.ts)}</time> · Span {recordedDuration(phase.items[0].event.ts,phase.items.at(-1)!.event.ts)}</p></div>
    <ol className="timeline-rail">{groups.map(group=>group.length>1?<li key={group[0].event.id} className="timeline-claims"><details><summary>{group.length} claims</summary><ol>{group.map(entry=><TimelineEvent key={entry.event.id} entry={entry} base={base!} lens={lens} onOpenDrawer={onOpenDrawer} blobs={blobs}/>)}</ol></details></li>:<TimelineEvent key={group[0].event.id} entry={group[0]} base={base!} lens={lens} onOpenDrawer={onOpenDrawer} blobs={blobs}/>)}</ol>
   </section>
  })}
 </section>
}
