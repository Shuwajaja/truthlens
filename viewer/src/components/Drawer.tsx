import {Tabs,TabsList,TabsTrigger,TabsContent} from './ui/tabs.tsx'
import {EvidenceTabs} from './EvidenceRail.tsx'
import {recordedTime,recordedDuration} from './overview-data.ts'
import { useState } from 'react'
import type { Artifact, Claim, Criterion, RunDoc, RunEvent } from '../types.ts'
import type { Lens } from '../lens.ts'
import { RenderView } from '../renderkit/RenderView.tsx'
import { IntegrityNotice } from './IntegrityNotice.tsx'
import { StatusBadge, Badge } from './ui/badge.tsx'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet.tsx'

export type DrawerTarget =
  | { kind:'run'; doc:RunDoc }
  | { kind: 'criterion'; criterion: Criterion; matched: RunEvent[] }
  | { kind: 'event'; event: RunEvent }
  | { kind: 'claim'; claim: Claim; event?: RunEvent }
  | { kind: 'artifact'; artifact: Artifact; event?: RunEvent }

export function Drawer({ target, blobs, lens, trust, onClose, onOpenDrawer, doc }: {
  target: DrawerTarget
  doc?:RunDoc
  blobs?: Record<string, string>
  lens: Lens
  trust?: Pick<RunDoc, 'verified' | 'integrity'>
  onOpenDrawer?: (target:DrawerTarget)=>void
  onClose: () => void
}) {
  const [selectionVersion,setSelectionVersion]=useState(0)
  const selectionId=target.kind==='criterion'?target.criterion.criterion_id:target.kind==='event'?target.event.id:target.kind==='claim'?target.claim.claim_id:target.kind==='artifact'?target.artifact.artifact_id:target.doc.run.run_id
  const openRecord=(next:DrawerTarget)=>{setSelectionVersion(value=>value+1);onOpenDrawer?.(next)}
  // Graph and timeline triggers do not live inside SheetTrigger. Restore their real focus.
  const [returnFocus]=useState(() => typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null)
  const label=target.kind==='criterion'?'Evidence detail':target.kind==='event'?'Event detail':target.kind==='claim'?'Claim detail':target.kind==='artifact'?'File detail':'Run detail'
  const selectedEvents=(target.kind==='criterion'?target.matched:target.kind==='event'?[target.event]:target.kind==='run'?target.doc.events:target.event?[target.event]:[]).toSorted((a,b)=>a.seq-b.seq)
  const selectedArtifacts=target.kind==='artifact'?[target.artifact]:(doc?.artifacts.filter(artifact=>selectedEvents.some(event=>event.payload.artifact_id===artifact.artifact_id||event.payload.report_artifact_id===artifact.artifact_id||event.payload.sha256===artifact.sha256))??[])
  return <Sheet open onOpenChange={open=>{if(!open)onClose()}}>
    <SheetContent id="evidence-drawer" className="drawer-pane" aria-label={label} aria-labelledby={undefined} aria-describedby="evidence-description"
      onCloseAutoFocus={event=>{event.preventDefault();returnFocus?.focus()}}>
      <div className="sheet-handle" aria-hidden="true"/>
      <SheetHeader className="border-b border-border pr-12">
        <SheetTitle id="evidence-title">{lens==='client'?'Details':label}</SheetTitle>
        <SheetDescription id="evidence-description" className="sr-only">Recorded export data. Technical integrity does not establish human acceptance.</SheetDescription>
      </SheetHeader>
      {trust && <div className="px-4 pt-4"><IntegrityNotice verified={trust.verified} integrity={trust.integrity} /></div>}
      <div className="drawer-body px-4 py-4 min-w-0">
        {target.kind==='run'&&<div className="space-y-4"><h3 className="text-lg font-semibold">{target.doc.run.project}</h3><Badge>Review required</Badge><dl className="node-properties">
          <div><dt>Run</dt><dd>{target.doc.run.run_id}</dd></div><div><dt>Agent</dt><dd>{target.doc.run.agent}</dd></div><div><dt>Start</dt><dd>{recordedTime(target.doc.run.started)}</dd></div><div><dt>End</dt><dd>{target.doc.run.finished?recordedTime(target.doc.run.finished):'Not exported'}</dd></div><div><dt>Duration</dt><dd>{recordedDuration(target.doc.run.started,target.doc.run.finished)}</dd></div><div><dt>Exit code</dt><dd>{target.doc.run.exit_code??'Not exported'}</dd></div>
        </dl><pre className="font-mono text-xs whitespace-pre-wrap break-all">{target.doc.run.command}</pre>{onOpenDrawer?<EvidenceTabs doc={target.doc} onOpenDrawer={openRecord}/>:<p className="text-2">Evidence navigation not available.</p>}</div>}
        {target.kind!=='run'&&<Tabs key={`${target.kind}:${selectionId}:${selectionVersion}`} defaultValue="overview" className="rail-tabs"><TabsList aria-label="Filter selected evidence"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="tests">Tests</TabsTrigger><TabsTrigger value="artifacts">Files</TabsTrigger><TabsTrigger value="time">Time</TabsTrigger></TabsList><TabsContent value="overview">
        {target.kind==='criterion' && <>
          <div className="mb-4"><p className="text-sm mb-2">{target.criterion.text}</p><p className="text-sm text-muted-foreground mb-2">{target.criterion.plain}</p><StatusBadge source="criterion" status={target.criterion.status} /></div>
          {target.matched.length===0 ? <p className="text-sm text-muted-foreground">No evidence events for this criterion.</p> : <div className="space-y-4">{target.matched.map(event=><RenderView key={event.id} input={{kind:'event',event}} context={{blobs,lens}} />)}</div>}
        </>}
        {target.kind==='event' && <RenderView input={{kind:'event',event:target.event}} context={{blobs,lens}} />}
        {target.kind==='claim' && <>
          <p className="text-sm mb-4 break-words">{target.claim.text}</p><StatusBadge source="claim" finding={target.claim.finding} />
          {target.event ? <div className="mt-4"><RenderView input={{kind:'event',event:target.event}} context={{blobs,lens}} /></div> : <p className="text-muted-foreground text-sm mt-4">No matching event exported.</p>}
        </>}
        {target.kind==='artifact' && <>
          <p className="font-mono text-sm mb-4 break-all">{target.artifact.path}</p>
          <dl className="text-xs text-muted-foreground space-y-2 break-all mb-4"><dt>File</dt><dd>{target.artifact.artifact_id}</dd><dt>SHA-256 (exported)</dt><dd>{target.artifact.sha256}</dd><dt>Source</dt><dd>{target.artifact.provenance}</dd></dl>
          {blobs?.[target.artifact.sha256] !== undefined ? <RenderView input={{kind:'blob',mediaType:'text/plain',path:target.artifact.path,text:blobs[target.artifact.sha256]}} /> : <p className="text-sm text-muted-foreground">Content not exported</p>}
          {target.event && <div className="mt-4"><RenderView input={{kind:'event',event:target.event}} context={{blobs,lens}} /></div>}
        </>}
        </TabsContent><TabsContent value="tests">
          {selectedEvents.some(event=>event.type==='test.reported')?selectedEvents.filter(event=>event.type==='test.reported').map(event=><div className="mb-4" key={event.id}><RenderView input={{kind:'event',event}} context={{blobs,lens}}/></div>):<p className="text-2">No test reports exported for this selection.</p>}
        </TabsContent><TabsContent value="artifacts">
          {selectedArtifacts.length===0?<p className="text-2">No linked files.</p>:<ul className="space-y-4">{selectedArtifacts.map(artifact=><li key={artifact.artifact_id}><p className="font-mono text-sm break-all">{artifact.path}</p><p className="font-mono text-xs text-2 break-all" title={artifact.sha256}>{artifact.sha256}</p>{onOpenDrawer&&<button type="button" className="text-info underline text-sm mt-2" onClick={()=>{const matches=(doc?.events??selectedEvents).filter(event=>event.type==='artifact.recorded'&&event.payload.artifact_id===artifact.artifact_id);openRecord({kind:'artifact',artifact,event:matches.length===1?matches[0]:undefined})}}>Open file</button>}</li>)}</ul>}
        </TabsContent><TabsContent value="time">
          {selectedEvents.length===0?<p className="text-2">No clearly matched event times.</p>:<ul className="space-y-4">{selectedEvents.map(event=><li key={event.id}><p className="text-sm">{event.summary}</p><time className="text-xs text-2" dateTime={event.ts}>{recordedTime(event.ts)}</time></li>)}</ul>}
        </TabsContent></Tabs>}

      </div>
    </SheetContent>
  </Sheet>
}
