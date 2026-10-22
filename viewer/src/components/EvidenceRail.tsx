import {FileText, ListChecks, Clock} from 'lucide-react'
import type {RunDoc, RunEvent} from '../types.ts'
import type {DrawerTarget} from './Drawer.tsx'
import {Navigator} from './Navigator.tsx'
import {Tabs,TabsList,TabsTrigger,TabsContent} from './ui/tabs.tsx'
import {recordedTime,recordedDuration} from './overview-data.ts'

function EvidenceEvents({events,onOpenDrawer}:{events:RunEvent[];onOpenDrawer:(target:DrawerTarget)=>void}){
 return events.length===0?<p className="text-2">Keine Belege exportiert.</p>:<ul className="rail-list">{events.map(event=>{
  const Icon=event.type==='test.reported'?ListChecks:event.type==='artifact.recorded'?FileText:Clock
  return <li key={event.id}><button type="button" aria-label={`Beleg #${event.seq}: ${event.summary}`} onClick={()=>onOpenDrawer({kind:'event',event})}><span className="rail-icon"><Icon size={14} aria-hidden="true"/></span><span><strong>{event.summary}</strong><code>#{event.seq} · {event.type}</code></span></button></li>
 })}</ul>
}

export function EvidenceRail({doc,onOpenDrawer}:{doc:RunDoc;onOpenDrawer:(target:DrawerTarget)=>void}){
 const evidence=doc.events.filter(event=>['test.reported','artifact.recorded','evidence.attached'].includes(event.type))
 return <aside className="evidence-rail" aria-label="Beleg-Schublade"><div className="rail-sticky">
  <section className="rail-evidence"><div className="panel-heading"><h2>Beleg-Schublade</h2><span className="section-note">{evidence.length} Ereignisse</span></div>
   <Tabs defaultValue="overview" className="rail-tabs"><TabsList aria-label="Belege filtern">
    <TabsTrigger value="overview">Übersicht</TabsTrigger><TabsTrigger value="tests">Tests</TabsTrigger><TabsTrigger value="artifacts">Artefakte</TabsTrigger><TabsTrigger value="time">Zeit</TabsTrigger>
   </TabsList>
    <TabsContent value="overview"><EvidenceEvents events={evidence} onOpenDrawer={onOpenDrawer}/></TabsContent>
    <TabsContent value="tests"><EvidenceEvents events={evidence.filter(event=>event.type==='test.reported')} onOpenDrawer={onOpenDrawer}/></TabsContent>
    <TabsContent value="artifacts">{doc.artifacts.length===0?<p className="text-2">Keine Artefakte exportiert.</p>:<ul className="rail-list">{doc.artifacts.map(artifact=><li key={artifact.artifact_id}><button type="button" aria-label={`Datei: ${artifact.path}`} onClick={()=>{
     const matches=doc.events.filter(event=>event.type==='artifact.recorded'&&event.payload.artifact_id===artifact.artifact_id)
     onOpenDrawer({kind:'artifact',artifact,event:matches.length===1?matches[0]:undefined})
    }}><span className="rail-icon"><FileText size={14} aria-hidden="true"/></span><span><strong>{artifact.path}</strong><code className="break-all">{artifact.sha256}</code></span></button></li>)}</ul>}</TabsContent>
    <TabsContent value="time"><dl className="run-times"><div><dt>Start</dt><dd>{recordedTime(doc.run.started)}</dd></div><div><dt>Ende</dt><dd>{doc.run.finished?recordedTime(doc.run.finished):'Nicht exportiert'}</dd></div><div><dt>Dauer</dt><dd>{recordedDuration(doc.run.started,doc.run.finished)}</dd></div></dl></TabsContent>
   </Tabs>
   <p className="trust-seal">Integrität ≠ fachliche Freigabe</p>
  </section>
  <Navigator/>
 </div></aside>
}
