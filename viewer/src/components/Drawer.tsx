import { useState } from 'react'
import type { Artifact, Claim, Criterion, RunDoc, RunEvent } from '../types.ts'
import type { Lens } from '../lens.ts'
import { RenderView } from '../renderkit/RenderView.tsx'
import { IntegrityNotice } from './IntegrityNotice.tsx'
import { StatusBadge } from './ui/badge.tsx'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet.tsx'

export type DrawerTarget =
  | { kind: 'criterion'; criterion: Criterion; matched: RunEvent[] }
  | { kind: 'event'; event: RunEvent }
  | { kind: 'claim'; claim: Claim; event?: RunEvent }
  | { kind: 'artifact'; artifact: Artifact; event?: RunEvent }

export function Drawer({ target, blobs, lens, trust, onClose }: {
  target: DrawerTarget
  blobs?: Record<string, string>
  lens: Lens
  trust?: Pick<RunDoc, 'verified' | 'integrity'>
  onClose: () => void
}) {
  // Graph and timeline triggers do not live inside SheetTrigger. Restore their real focus.
  const [returnFocus]=useState(() => typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null)
  const label=target.kind==='criterion'?'Evidence detail':target.kind==='event'?'Event detail':target.kind==='claim'?'Claim detail':'File detail'
  return <Sheet open onOpenChange={open=>{if(!open)onClose()}}>
    <SheetContent id="evidence-drawer" className="drawer-pane" aria-label={label} aria-labelledby={undefined} aria-describedby="evidence-description"
      onCloseAutoFocus={event=>{event.preventDefault();returnFocus?.focus()}}>
      <SheetHeader className="border-b border-border pr-12">
        <SheetTitle id="evidence-title">{lens==='client'?'Details':label}</SheetTitle>
        <SheetDescription id="evidence-description" className="sr-only">Recorded export data. Technical integrity does not establish human acceptance.</SheetDescription>
      </SheetHeader>
      {trust && <div className="px-4 pt-4"><IntegrityNotice verified={trust.verified} integrity={trust.integrity} /></div>}
      <div className="drawer-body px-4 py-4 min-w-0">
        {target.kind==='criterion' && <>
          <div className="mb-4"><p className="text-sm mb-2">{target.criterion.text}</p><p className="text-sm text-muted-foreground mb-2">{target.criterion.plain}</p><StatusBadge source="criterion" status={target.criterion.status} /></div>
          {target.matched.length===0 ? <p className="text-sm text-muted-foreground">No evidence events for this criterion.</p> : <div className="space-y-4">{target.matched.map(event=><RenderView key={event.id} input={{kind:'event',event}} context={{blobs,lens}} />)}</div>}
        </>}
        {target.kind==='event' && <RenderView input={{kind:'event',event:target.event}} context={{blobs,lens}} />}
        {target.kind==='claim' && <>
          <p className="text-sm mb-3 break-words">{target.claim.text}</p><StatusBadge source="claim" finding={target.claim.finding} />
          {target.event ? <div className="mt-4"><RenderView input={{kind:'event',event:target.event}} context={{blobs,lens}} /></div> : <p className="text-muted-foreground text-sm mt-4">Kein zugehöriges Ereignis exportiert.</p>}
        </>}
        {target.kind==='artifact' && <>
          <p className="font-mono text-sm mb-3 break-all">{target.artifact.path}</p>
          <dl className="text-xs text-muted-foreground space-y-2 break-all mb-4"><dt>Artifact</dt><dd>{target.artifact.artifact_id}</dd><dt>SHA-256 (exportiert)</dt><dd>{target.artifact.sha256}</dd><dt>Provenance</dt><dd>{target.artifact.provenance}</dd></dl>
          {blobs?.[target.artifact.sha256] !== undefined ? <RenderView input={{kind:'blob',mediaType:'text/plain',path:target.artifact.path,text:blobs[target.artifact.sha256]}} /> : <p className="text-sm text-muted-foreground">Content not exported</p>}
          {target.event && <div className="mt-4"><RenderView input={{kind:'event',event:target.event}} context={{blobs,lens}} /></div>}
        </>}
      </div>
    </SheetContent>
  </Sheet>
}
