import {FileText, ListChecks, Clock, MessageSquare} from 'lucide-react'
import type {RunDoc} from '../types.ts'
import type {DrawerTarget} from './Drawer.tsx'
import {Navigator} from './Navigator.tsx'

export function EvidenceRail({doc,onOpenDrawer}:{doc:RunDoc;onOpenDrawer:(target:DrawerTarget)=>void}){
 const evidence=doc.events.filter(event=>['test.reported','artifact.recorded','evidence.attached'].includes(event.type))
 return <aside className="evidence-rail" aria-label="Beleg-Schublade"><div className="rail-sticky">
  <section className="rail-evidence"><div className="panel-heading"><h2>Beleg-Schublade</h2><span className="section-note">{evidence.length} Ereignisse</span></div>
   <p className="section-note">Aufgezeichnete Belege dieses Laufs.</p>
   {evidence.length===0?<p className="text-2">Keine Belege exportiert.</p>:<ul className="rail-list">{evidence.map(event=>{
    const Icon=event.type==='test.reported'?ListChecks:event.type==='artifact.recorded'?FileText:event.type==='agent.claim'?MessageSquare:Clock
    return <li key={event.id}><button type="button" aria-label={`Beleg #${event.seq}: ${event.summary}`} onClick={()=>onOpenDrawer({kind:'event',event})}><span className="rail-icon"><Icon size={14} aria-hidden="true"/></span><span><strong>{event.summary}</strong><code>#{event.seq} · {event.type}</code></span></button></li>
   })}</ul>}
   <p className="trust-seal">Integrität ≠ fachliche Freigabe</p>
  </section>
  <Navigator/>
 </div></aside>
}
