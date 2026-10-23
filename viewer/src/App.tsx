import {useMobile,useWide} from './lib/use-mobile.ts'
import {useView} from './lib/use-view.ts'
import {useState,useEffect,useRef} from 'react'
import type {RunDoc} from './types.ts'
import {validateRunDoc} from './validateRunDoc.ts'
import {readLens,writeLens,type Lens} from './lens.ts'
import {ViewState} from './components/ViewState.tsx'
import {Button} from './components/ui/button.tsx'
import {Sidebar} from './components/Sidebar.tsx'
import {Overview} from './components/Overview.tsx'
import {ClaimedVsProven} from './components/ClaimedVsProven.tsx'
import {RenderView} from './renderkit/RenderView.tsx'
import {Drawer,type DrawerTarget} from './components/Drawer.tsx'
import {CriterionDetail} from './components/CriterionDetail.tsx'
import {IntegrityNotice} from './components/IntegrityNotice.tsx'
import {WorkspaceShell,type WorkspaceHandle} from './workspace/WorkspaceShell.tsx'
import {applyTheme,readTheme} from './workspace/theme.ts'
export type {View} from './lib/use-view.ts'
import type {View} from './lib/use-view.ts'

function focusView(){
 const heading=document.querySelector<HTMLElement>('main h1')
 if(!heading)return
 heading.tabIndex=-1;heading.focus({preventScroll:true})
 window.scrollTo({top:0,left:0,behavior:'auto'})
}
export default function App(){
 const mobile=useMobile(),wide=useWide()
 const [doc,setDoc]=useState<RunDoc|null>(null)
 const [error,setError]=useState<string|null>(null)
 const [invalidExport,setInvalidExport]=useState(false)
 const [view,setView]=useView()
 const [record,setRecord]=useState<DrawerTarget|null>(null)
 const [selected,setSelected]=useState<string>()
 const [inspectorOpen,setInspectorOpen]=useState(true)
 const workspace=useRef<WorkspaceHandle>(null)
 const [lens,setLens]=useState<Lens>(readLens)
 const previousView=useRef(view)
 const previousRecord=useRef(record)
 useEffect(()=>{if(previousRecord.current&&!record)document.getElementById('criterion-detail')?.focus({preventScroll:true});previousRecord.current=record},[record])
 useEffect(()=>{
  applyTheme(readTheme())
  if(!import.meta.env.DEV)return
  const controller=new AbortController()
  fetch('/run.json').then(r=>r.json()).then((data:unknown)=>{
   if(controller.signal.aborted)return
   if(!validateRunDoc(data)){setInvalidExport(true);return}setDoc(data)
  }).catch((e:Error)=>{if(!controller.signal.aborted)setError(e.message||'Failed to load run data')})
  return ()=>controller.abort()
 },[])
 // Initial data and responsive changes must not steal focus. Back/Forward still restores the view.
 useEffect(()=>{if(previousView.current!==view){previousView.current=view;focusView()}},[view])
 const handleViewChange=(next:View)=>{setView(next);if(next===view)focusView()}
 const handleLensChange=(next:Lens)=>{setLens(next);writeLens(next)}
 const openRecord=(target:DrawerTarget)=>{setRecord(target);setInspectorOpen(true);workspace.current?.inspect()}
 const selectCriterion=(id:string)=>{setSelected(id);setRecord(null);if(!wide)workspace.current?.inspect()}
 if(!import.meta.env.DEV)return <WorkspaceShell ref={workspace} lens={lens} mobile={mobile} wide={wide} inspectorAvailable={false} inspectorOpen={false} onInspectorOpenChange={()=>{}} inspector={<p>No recorded selection.</p>} navigation={<p className="section-note">No local run source is connected.</p>}>
  <section className="local-disconnected"><h1>Not connected</h1><p>The local read-only run source is not configured.</p><p>Real runs require the approved SSH tunnel and reader setup. No server connection is attempted.</p></section>
 </WorkspaceShell>
 if(error)return <ViewState title="Unable to load run data" description={error} error/>
 if(invalidExport)return <ViewState title="Invalid or inconsistent export" description="Restore a valid export and reload to view run data." error/>
 if(!doc)return <ViewState title="Loading run data…"/>
 const criterion=doc.criteria.find(c=>c.criterion_id===selected)??doc.criteria.find(c=>c.status==='unmet')??doc.criteria[0]
 const matched=criterion?.evidence.flatMap(id=>{const event=doc.events.find(e=>e.id===id);return event?[event]:[]})??[]
 const inspector=record?<Drawer inline target={record} doc={doc} trust={doc} blobs={doc.blobs} lens={lens} onOpenDrawer={openRecord} onClose={()=>setRecord(null)}/>:<CriterionDetail criterion={criterion} claims={doc.claims.filter(c=>c.criterion_ids.includes(criterion?.criterion_id??''))} matched={matched} onOpenDrawer={openRecord}/>
 return <WorkspaceShell lens={lens} mobile={mobile} wide={wide} onOpenRun={()=>openRecord({kind:'run',doc})} inspectorOpen={inspectorOpen} onInspectorOpenChange={setInspectorOpen} ref={workspace} inspector={inspector} navigation={<Sidebar currentView={view} onViewChange={handleViewChange} lens={lens} onLensChange={handleLensChange} reviewRequired={doc.review_required}/>}>
  <IntegrityNotice verified={doc.verified} integrity={doc.integrity}/>
  {view!=='overview'&&<div className="review-return"><Button variant="outline" size="sm" onClick={()=>handleViewChange('overview')}>Review criteria</Button></div>}
  {view==='overview'&&<Overview doc={doc} lens={lens} showRunAction={false} selection={criterion?.criterion_id} onSelectCriterion={selectCriterion} onOpenDrawer={openRecord}/>}
  {view==='claimed-vs-proven'&&<ClaimedVsProven doc={doc} lens={lens} onOpenDrawer={openRecord}/>}
  {view==='timeline'&&<RenderView input={{kind:'events',events:doc.events}} context={{lens,blobs:doc.blobs,onOpenDrawer:openRecord}}/>}
  {view==='agent-story'&&<RenderView input={{kind:'run',doc}} context={{lens,blobs:doc.blobs,onOpenDrawer:openRecord}}/>}
 </WorkspaceShell>
}
