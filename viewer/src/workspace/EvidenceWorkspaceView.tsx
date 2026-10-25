import {useEffect,useState} from 'react'
import type {RunDoc} from '../types.ts'
import type {AuditReport} from '../audit-report.ts'
import type {WorkspaceView} from './navigation-types.ts'
import type {DrawerTarget} from '../components/Drawer.tsx'
import {loadPrivateAudit,type PrivateRunSummary} from '../private-reader.ts'
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
 const [state,setState]=useState<{report:AuditReport|null;loading:boolean;error?:string}>({report:null,loading:!!summary})
 const [retry,setRetry]=useState(0)
 useEffect(()=>{
  if(!summary)return
  const controller=new AbortController()
  loadPrivateAudit(summary,controller.signal).then(report=>{if(!controller.signal.aborted)setState({report,loading:false})}).catch(error=>{if(!controller.signal.aborted)setState({report:null,loading:false,error:error instanceof Error?error.message:'Unable to read stored audit'})})
  return ()=>controller.abort()
 },[summary,retry])
 return <>{state.loading?<section><h1>{view==='gated-actions'?'Gated actions':view==='chain'?'Chain':'Coverage'}</h1><p role="status">Loading stored audit…</p></section>:<EvidenceReview doc={doc} view={view} report={state.report} onOpenDrawer={onOpenDrawer}/>}{state.error&&<div role="alert"><p>Stored audit unavailable: {state.error}</p><Button variant="outline" onClick={()=>{setState({report:null,loading:true});setRetry(value=>value+1)}}>Retry stored audit</Button></div>}</>
}
