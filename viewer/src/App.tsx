import {useMobile,useWide} from './lib/use-mobile.ts'
import {useWorkspaceNavigation} from './workspace/use-workspace-navigation.ts'
import {WorkspaceTabs} from './workspace/WorkspaceTabs.tsx'
import {RunsView} from './workspace/RunsView.tsx'
import type {WorkspaceSource,WorkspaceView} from './workspace/navigation-types.ts'
import {useState,useEffect,useLayoutEffect,useRef} from 'react'
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
 const [lens]=useState<Lens>(readLens)
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
 const workspace=useRef<WorkspaceHandle>(null)
 if(!import.meta.env.DEV)return <WorkspaceShell ref={workspace} lens={lens} mobile={mobile} wide={wide} inspectorAvailable={false} inspectorOpen={false} onInspectorOpenChange={()=>{}} inspector={<p>No recorded selection.</p>} navigation={<p className="section-note">No local run source is connected.</p>}>
  <section className="local-disconnected"><h1>Not connected</h1><p>The local read-only run source is not configured.</p><p>Real runs require the approved SSH tunnel and reader setup. No server connection is attempted.</p></section>
 </WorkspaceShell>
 if(error)return <ViewState title="Unable to load run data" description={error} error/>
 if(invalidExport)return <ViewState title="Invalid or inconsistent export" description="Restore a valid export and reload to view run data." error/>
 if(!doc)return <ViewState title="Loading run data…"/>
 return <LoadedWorkspace doc={doc}/>
}

function LoadedWorkspace({doc:supplied}:{doc:RunDoc}){
 const mobile=useMobile(),wide=useWide()
 const [sources]=useState<WorkspaceSource[]>(()=>[{sourceId:'local-fixture',label:'Local development fixture',kind:'development-fixture',runs:new Map([[supplied.run.run_id,supplied]])}])
 const nav=useWorkspaceNavigation({sources})
 const doc=nav.activeRun
 const view=nav.activeTab?.view??'runs'
 const [record,setRecord]=useState<DrawerTarget|null>(null)
 const [selected,setSelected]=useState<string>()
 const [inspectorOpen,setInspectorOpen]=useState(true)
 const workspace=useRef<WorkspaceHandle>(null)
 const [lens,setLens]=useState<Lens>(readLens)
 const identity=nav.activeTab?.tabId
 const focusNext=useRef(false),previousRecord=useRef({record,identity}),previousHistory=useRef(nav.historyRevision)
 const [previousIdentity,setPreviousIdentity]=useState(identity)
 if(previousIdentity!==identity){setPreviousIdentity(identity);setSelected(undefined);setRecord(null)}
 useEffect(()=>{if(previousRecord.current.identity===identity&&previousRecord.current.record&&!record)document.getElementById('criterion-detail')?.focus({preventScroll:true});previousRecord.current={record,identity}},[record,identity])
 useLayoutEffect(()=>{if(focusNext.current||previousHistory.current!==nav.historyRevision){focusNext.current=false;previousHistory.current=nav.historyRevision;focusView()}},[identity,nav.historyRevision])
 const onRuns=()=>nav.navigate({kind:'runs',sourceId:sources[0].sourceId},'runs')
 const handleViewChange=(next:WorkspaceView)=>{focusNext.current=true;if(next==='runs')onRuns();else nav.navigate(nav.activeTab?.ref.kind==='run'?nav.activeTab.ref:{kind:'run',sourceId:sources[0].sourceId,runId:supplied.run.run_id},next);if(next===view)focusView()}
 const handleLensChange=(next:Lens)=>{setLens(next);writeLens(next)}
 const openRecord=(target:DrawerTarget)=>{setRecord(target);setInspectorOpen(true);workspace.current?.inspect()}
 const selectCriterion=(id:string)=>{setSelected(id);setRecord(null);if(!wide)workspace.current?.inspect()}
 const criterion=doc?.criteria.find(c=>c.criterion_id===selected)??doc?.criteria.find(c=>c.status==='unmet')??doc?.criteria[0]
 const matched=criterion?.evidence.flatMap(id=>{const event=doc?.events.find(e=>e.id===id);return event?[event]:[]})??[]
 const inspector=!doc?<p>No recorded selection.</p>:record?<Drawer inline target={record} doc={doc} trust={doc} blobs={doc.blobs} lens={lens} onOpenDrawer={openRecord} onClose={()=>setRecord(null)}/>:<CriterionDetail criterion={criterion} claims={doc.claims.filter(c=>c.criterion_ids.includes(criterion?.criterion_id??''))} matched={matched} onOpenDrawer={openRecord}/>
 return <WorkspaceShell tabs={<WorkspaceTabs state={nav.state} dispatch={nav.dispatch} onRuns={onRuns} unsaved={nav.storageStatus==='memory-only'}/>} inspectorAvailable={!!doc} lens={lens} mobile={mobile} wide={wide} onOpenRun={doc?()=>openRecord({kind:'run',doc}):undefined} inspectorOpen={inspectorOpen} onInspectorOpenChange={setInspectorOpen} ref={workspace} inspector={inspector} navigation={<Sidebar currentView={view} onViewChange={handleViewChange} lens={lens} onLensChange={handleLensChange} reviewRequired={doc?.review_required??false}/>}>
  {nav.malformed||nav.activeTab&&!nav.activeSource||nav.activeTab?.ref.kind==='run'&&!doc?<section className="local-disconnected"><h1>Run unavailable</h1><p>This source or run is unavailable in this workspace.</p><p className="workspace-reference">{nav.activeTab?.ref.sourceId} {nav.activeTab?.ref.kind==='run'?nav.activeTab.ref.runId:''}</p><Button variant="outline" onClick={onRuns}>Return to Runs</Button></section>:!doc?<RunsView sources={sources} onOpenRun={ref=>nav.navigate(ref,'overview')}/>:<>
  <IntegrityNotice verified={doc.verified} integrity={doc.integrity}/>
  {view!=='overview'&&<div className="review-return"><Button variant="outline" size="sm" onClick={()=>handleViewChange('overview')}>Review criteria</Button></div>}
  {view==='overview'&&<Overview doc={doc} lens={lens} showRunAction={false} selection={criterion?.criterion_id} onSelectCriterion={selectCriterion} onOpenDrawer={openRecord}/>}
  {view==='claimed-vs-proven'&&<ClaimedVsProven doc={doc} lens={lens} onOpenDrawer={openRecord}/>}
  {view==='timeline'&&<RenderView input={{kind:'events',events:doc.events}} context={{lens,blobs:doc.blobs,onOpenDrawer:openRecord}}/>}
  {view==='agent-story'&&<RenderView input={{kind:'run',doc}} context={{lens,blobs:doc.blobs,onOpenDrawer:openRecord}}/>}
  </>}
 </WorkspaceShell>
}
