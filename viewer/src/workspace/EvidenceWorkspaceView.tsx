import {useEffect,useState} from 'react'
import type {RunDoc} from '../types.ts'
import type {AuditReport} from '../audit-report.ts'
import type {WorkspaceView} from './navigation-types.ts'
import type {DrawerTarget} from '../components/Drawer.tsx'
import {loadPrivateAuditResult,type PrivateRunSummary} from '../private-reader.ts'
import {unavailableStatus,type StatusResult} from '../status-result.ts'
import {StatusDeck} from '../components/StatusDeck.tsx'
import {EvidenceReview,type AuditView} from '../components/EvidenceReview.tsx'
import {StoredChanges} from '../components/StoredChanges.tsx'
import {ComparePane,type ComparisonSnapshot} from '../components/ComparePane.tsx'
import {Button} from '../components/ui/button.tsx'
export function EvidenceWorkspaceView({view,doc,sourceId,summary,choices,onOpenDrawer}:{view:WorkspaceView;doc:RunDoc;sourceId:string;summary?:PrivateRunSummary;choices:ComparisonSnapshot[];onOpenDrawer:(target:DrawerTarget)=>void}){
 if(view==='changes')return <StoredChanges doc={doc} onOpenDrawer={onOpenDrawer}/>
 if(view==='compare')return <ComparePane current={{sourceId,doc}} choices={choices}/>
 if(view==='chain'||view==='coverage'||view==='gated-actions')return <StoredAudit key={JSON.stringify([sourceId,doc.run.run_id,doc.run.ledger_last_hash])} doc={doc} summary={summary} view={view} onOpenDrawer={onOpenDrawer}/>
 return null
}
function StoredAudit({doc,summary,view,onOpenDrawer}:{doc:RunDoc;summary?:PrivateRunSummary;view:AuditView;onOpenDrawer:(target:DrawerTarget)=>void}){
 const [state,setState]=useState<{report:AuditReport|null;status:StatusResult;loading:boolean;error?:string}>({report:null,status:unavailableStatus,loading:!!summary})
 const [retry,setRetry]=useState(0)
 useEffect(()=>{
  if(!summary)return
  const controller=new AbortController()
  loadPrivateAuditResult(summary,controller.signal).then(result=>{if(!controller.signal.aborted)setState({...result,loading:false})}).catch(()=>{if(!controller.signal.aborted)setState({report:null,status:unavailableStatus,loading:false,error:'Unable to read stored audit'})})
  return ()=>controller.abort()
 },[summary,retry])
 return <>{state.loading?<section><h1>{view==='gated-actions'?'Gated actions':view==='chain'?'Chain':'Coverage'}</h1><p role="status">Loading stored audit…</p><StatusDeck result={unavailableStatus}/></section>:<EvidenceReview doc={doc} view={view} report={state.report} status={state.status} onOpenDrawer={onOpenDrawer}/>}{state.error&&<div role="alert"><p>Stored audit unavailable: {state.error}</p><Button variant="outline" onClick={()=>{setState({report:null,status:unavailableStatus,loading:true});setRetry(value=>value+1)}}>Retry stored audit</Button></div>}</>
}
