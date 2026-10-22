import { useEffect, useRef, useState } from 'react'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { RegistryPoller } from './poller'
import type { Snapshot } from './poller'
import './widget.css'

const empty:Snapshot = {events:[],audit:null,problem:null,stale:false,hasMore:false}
const runPattern = /^[A-Za-z0-9_-]{1,80}$/
function recordedTime(value:unknown) {
  if(typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return 'Not recorded'
  return new Date(value).toLocaleString('en-GB',{timeZoneName:'short',hour12:false})
}
async function loadPage(runId:string,cursor:number,signal:AbortSignal,before?:number) {
  const query = new URLSearchParams({after_seq:String(cursor)})
  if(before) query.set('before_seq',String(before))
  const response = await fetch(`/v1/runs/${encodeURIComponent(runId)}/events?${query}`,{
    credentials:'same-origin',cache:'no-store',signal,redirect:'error',headers:{Accept:'application/json'},
  })
  if(!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw Error('unavailable')
  const text = await response.text()
  if(text.length>1024*1024) throw Error('unavailable')
  return JSON.parse(text) as unknown
}

export function RegistryWidget({runId}:{runId:string|null}) {
  return <RegistryWidgetRun key={runId ?? ''} runId={runId} />
}
function RegistryWidgetRun({runId}:{runId:string|null}) {
  const [snapshot,setSnapshot] = useState<Snapshot>(empty)
  const poller = useRef<RegistryPoller|null>(null)
  const tick = useRef<()=>void>(()=>{})
  useEffect(()=>{
    if(!runId || !runPattern.test(runId)) return
    const current = new RegistryPoller(runId,(cursor,signal,before)=>loadPage(runId,cursor,signal,before),setSnapshot)
    poller.current = current
    let timer:ReturnType<typeof setTimeout>|undefined
    let active=true
    const update = async()=>{
      if(timer) clearTimeout(timer)
      await current.refresh()
      if(active && !current.hidden) timer=setTimeout(()=>{void update()},current.delay)
    }
    tick.current=()=>{void update()}
    const visibility=()=>{
      current.hidden=document.hidden
      if(timer) clearTimeout(timer)
      if(!current.hidden) void update()
    }
    current.hidden=document.hidden
    document.addEventListener('visibilitychange',visibility)
    void update()
    return ()=>{active=false;current.stop();if(timer) clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);poller.current=null}
  },[runId])
  const audit=snapshot.audit
  const contradiction=audit?.conclusion==='contradictory'
  const status = snapshot.problem ?? (contradiction?'Contradiction found':audit?.state==='running'?'Audit running':audit?.state==='queued'?'Audit queued':audit?.state==='completed'?'Audit completed':audit?.state==='failed'?'Audit unavailable':'Not connected')
  const checked = audit?.connection==='connected' && audit.verified===true && audit.integrity==='hmac'
  return <main className="audit-widget-shell">
    <Card className="audit-widget" role="region" aria-labelledby="audit-widget-heading">
      <header><h1 id="audit-widget-heading">Audit status</h1><p className="audit-task">{runId && runPattern.test(runId)?<>Run <code>{runId}</code></>:'No registered run selected'}</p></header>
      <div aria-live="polite"><p className={contradiction?'audit-contradiction':'audit-state'}>{status}</p>
        {snapshot.stale && <p>Last received data is stale.</p>}
        <p className="audit-last">Last activity: <span className="mono">{recordedTime(audit?.last_activity)}</span></p>
      </div>
      <p className="audit-boundary">{checked?'Signature checked':audit?.integrity==='hash-only'?'Hash only · signature not checked':'Signature not checked'}<br /><span>Integrity is not approval</span></p>
      {audit && audit.connection !== 'connected' && <p className="audit-connection">Gateway not connected · server pipeline only</p>}
      <details><summary>Evidence &amp; details</summary>
        <p>Audit result: {audit?.conclusion ?? 'Not checked'}</p>
        <p>Claims remain separate from recorded evidence.</p>
        {audit?.claim_checks?.slice(0,5).map((check,index)=><p key={`${check.rule_id}-${index}`}><code>{check.rule_id}</code>: {check.message} ({check.outcome})</p>)}
        {snapshot.events.length===0?<p>No recorded events received.</p>:<ol className="audit-events">{snapshot.events.map(event=><li key={`${event.run_id}-${event.seq}-${event.hash}`}>
          <span className="mono">#{event.seq} · {recordedTime(event.recorded_at)}</span>
          <p>{event.actor} · {event.type}</p>
          {event.result && <p>{Object.entries(event.result).filter(([,v])=>Number.isSafeInteger(v)).map(([k,v])=>`${k}: ${v}`).join(' · ')}</p>}
        </li>)}</ol>}
        {snapshot.hasMore && (snapshot.events[0]?.seq ?? 0)>1 && <Button variant="outline" onClick={()=>{void poller.current?.refresh(snapshot.events[0].seq)}}>Load earlier events</Button>}
        {snapshot.events.length>0 && <Button variant="outline" onClick={()=>poller.current?.showLatest()}>Latest events</Button>}
      </details>
      {snapshot.problem && snapshot.problem!=='Record consistency error' && runId && <Button variant="outline" onClick={()=>tick.current()}>Retry connection</Button>}
    </Card>
  </main>
}
