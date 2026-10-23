import {useMobile,useWide} from './lib/use-mobile.ts'
import {useWorkspaceNavigation} from './workspace/use-workspace-navigation.ts'
import {WorkspaceTabs} from './workspace/WorkspaceTabs.tsx'
import {RunsView} from './workspace/RunsView.tsx'
import type {WorkspaceSource,WorkspaceView} from './workspace/navigation-types.ts'
import {useState,useEffect,useLayoutEffect,useRef,useMemo} from 'react'
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
import {connectPrivateReader,loadPrivateCatalogPage,loadPrivateRun,type PrivateReaderConnection,type PrivateRunCatalog} from './private-reader.ts'
import {PrivateRunsView} from './workspace/PrivateRunsView.tsx'
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
 const [connection,setConnection]=useState<PrivateReaderConnection|null>(null)
 const [connecting,setConnecting]=useState(false)
 const [connectionError,setConnectionError]=useState<string|null>(null)
 const connectionAbort=useRef<AbortController|null>(null)
 useEffect(()=>{
  applyTheme(readTheme())
  if(!import.meta.env.DEV)return ()=>connectionAbort.current?.abort()
  const controller=new AbortController()
  fetch('/run.json').then(r=>r.json()).then((data:unknown)=>{
   if(controller.signal.aborted)return
   if(!validateRunDoc(data)){setInvalidExport(true);return}setDoc(data)
  }).catch((e:Error)=>{if(!controller.signal.aborted)setError(e.message||'Failed to load run data')})
  return ()=>controller.abort()
 },[])
 const workspace=useRef<WorkspaceHandle>(null)
 const connect=async()=>{
  connectionAbort.current?.abort()
  const controller=new AbortController();connectionAbort.current=controller
  setConnecting(true);setConnectionError(null)
  try{const result=await connectPrivateReader(controller.signal);if(!controller.signal.aborted)setConnection(result)}
  catch(error){if(!controller.signal.aborted)setConnectionError(error instanceof Error?error.message:'Unable to connect to the private reader')}
  finally{if(!controller.signal.aborted)setConnecting(false)}
 }
 if(!import.meta.env.DEV)return connection?<ConnectedWorkspace key={connection.sourceId} connection={connection} onDisconnect={()=>{connectionAbort.current?.abort();setConnection(null);setConnectionError(null)}}/>:<WorkspaceShell ref={workspace} lens={lens} mobile={mobile} wide={wide} inspectorAvailable={false} inspectorOpen={false} onInspectorOpenChange={()=>{}} inspector={<p>No recorded selection.</p>} navigation={<p className="section-note">No private run source is connected.</p>}>
  <section className="local-disconnected"><h1>Not connected</h1><p>Connect to your private run catalog through your configured SSH connection.</p><p>Connect checks the local reader and loads its bounded run catalog. No request is made until you choose Connect.</p><Button variant="outline" disabled={connecting} onClick={connect}>{connecting?'Connecting…':'Connect'}</Button>{connectionError&&<p role="alert">Unable to connect: {connectionError}</p>}</section>
 </WorkspaceShell>
 if(error)return <ViewState title="Unable to load run data" description={error} error/>
 if(invalidExport)return <ViewState title="Invalid or inconsistent export" description="Restore a valid export and reload to view run data." error/>
 if(!doc)return <ViewState title="Loading run data…"/>
 return <LoadedWorkspace doc={doc}/>
}

const MAX_PRIVATE_CACHE_BYTES=50*1024*1024
const MAX_PRIVATE_CATALOG_ENTRIES=200
type CachedDocument={doc:RunDoc;bytes:number}
function ConnectedWorkspace({connection,onDisconnect}:{connection:PrivateReaderConnection;onDisconnect:()=>void}){
 const mobile=useMobile(),wide=useWide()
 const [catalog,setCatalog]=useState<PrivateRunCatalog>(connection.catalog)
 const [documents,setDocuments]=useState<Map<string,CachedDocument>>(()=>new Map())
 const [loadingMore,setLoadingMore]=useState(false)
 const [catalogError,setCatalogError]=useState<string|null>(null)
 const catalogAbort=useRef<AbortController|null>(null)
 const [loadRetry,setLoadRetry]=useState(0)
 const [loadProblem,setLoadProblem]=useState<{key:string;message:string}|null>(null)
 const sources=useMemo<WorkspaceSource[]>(()=>[
  {sourceId:connection.sourceId,label:'Private reader catalog',kind:'private-reader',runs:new Map()},
  ...catalog.runs.map(item=>({sourceId:item.source_id,label:'Private reader',kind:'private-reader' as const,runs:new Map(documents.has(item.source_id)?[[item.run_id,documents.get(item.source_id)!.doc] as [string,RunDoc]]:[])})),
 ],[catalog,connection,documents])
 const nav=useWorkspaceNavigation({sources})
 const doc=nav.activeRun
 const focusNext=useRef(false)
 const activeRunRef=nav.activeTab?.ref.kind==='run'?nav.activeTab.ref:undefined
 const activeSummary=activeRunRef?catalog.runs.find(item=>item.source_id===activeRunRef.sourceId&&item.run_id===activeRunRef.runId):undefined
 const activeKey=activeRunRef?JSON.stringify([activeRunRef.sourceId,activeRunRef.runId]):null
 useEffect(()=>()=>catalogAbort.current?.abort(),[])
 useEffect(()=>{
  if(!activeKey||!activeSummary||doc||loadProblem?.key===activeKey)return
  const controller=new AbortController()
  loadPrivateRun(activeSummary,controller.signal).then(loaded=>{
   if(controller.signal.aborted)return
   const bytes=new TextEncoder().encode(JSON.stringify(loaded)).byteLength
   setDocuments(current=>{
    const next=new Map(current);next.delete(activeSummary.source_id);next.set(activeSummary.source_id,{doc:loaded,bytes})
    let total=[...next.values()].reduce((sum,entry)=>sum+entry.bytes,0)
    while(total>MAX_PRIVATE_CACHE_BYTES&&next.size>1){const oldest=next.keys().next().value as string;total-=next.get(oldest)!.bytes;next.delete(oldest)}
    return next
   })
  }).catch(error=>{if(!controller.signal.aborted)setLoadProblem({key:activeKey!,message:error instanceof Error?error.message:'Unable to load this run document'})})
  return ()=>controller.abort()
 },[activeKey,activeSummary,doc,loadProblem,loadRetry])
 const loadMore=async()=>{
  if(catalog.next_offset===null||catalog.runs.length>=MAX_PRIVATE_CATALOG_ENTRIES||loadingMore)return
  catalogAbort.current?.abort();const controller=new AbortController();catalogAbort.current=controller
  setLoadingMore(true);setCatalogError(null)
  try{
   const page=await loadPrivateCatalogPage(connection.sourceId,catalog.next_offset,controller.signal)
   if(controller.signal.aborted)return
   const knownRuns=new Set(catalog.runs.map(item=>item.run_id)),knownSources=new Set(catalog.runs.map(item=>item.source_id))
   if(page.runs.some(item=>knownRuns.has(item.run_id)||knownSources.has(item.source_id)))throw Error('Private reader returned duplicate run identities')
   setCatalog({...catalog,runs:[...catalog.runs,...page.runs].slice(0,MAX_PRIVATE_CATALOG_ENTRIES),next_offset:page.next_offset})
  }catch(error){if(!controller.signal.aborted)setCatalogError(error instanceof Error?error.message:'Unable to load more runs')}
  finally{if(!controller.signal.aborted)setLoadingMore(false)}
 }
 const onRuns=()=>nav.navigate({kind:'runs',sourceId:connection.sourceId},'runs')
 const openRun=(run:PrivateRunCatalog['runs'][number])=>{focusNext.current=true;nav.navigate({kind:'run',sourceId:run.source_id,runId:run.run_id},'overview')}
 const [record,setRecord]=useState<DrawerTarget|null>(null)
 const [selected,setSelected]=useState<string>()
 const [inspectorOpen,setInspectorOpen]=useState(true)
 const workspace=useRef<WorkspaceHandle>(null)
 const [lens,setLens]=useState<Lens>(readLens)
 const identity=nav.activeTab?.tabId
 const previousRecord=useRef({record,identity}),previousHistory=useRef(nav.historyRevision)
 const [previousIdentity,setPreviousIdentity]=useState(identity)
 if(previousIdentity!==identity){setPreviousIdentity(identity);setSelected(undefined);setRecord(null)}
 useEffect(()=>{if(previousRecord.current.identity===identity&&previousRecord.current.record&&!record)document.getElementById('criterion-detail')?.focus({preventScroll:true});previousRecord.current={record,identity}},[record,identity])
 useLayoutEffect(()=>{if(focusNext.current||previousHistory.current!==nav.historyRevision){if(activeRunRef&&!doc)return;focusNext.current=false;previousHistory.current=nav.historyRevision;focusView()}},[activeRunRef,doc,identity,nav.historyRevision])
 const handleViewChange=(next:WorkspaceView)=>{focusNext.current=true;if(next==='runs')onRuns();else if(nav.activeTab?.ref.kind==='run')nav.navigate(nav.activeTab.ref,next);else if(catalog.runs[0])nav.navigate({kind:'run',sourceId:catalog.runs[0].source_id,runId:catalog.runs[0].run_id},next);if(next===nav.activeTab?.view)focusView()}
 const handleLensChange=(next:Lens)=>{setLens(next);writeLens(next)}
 const openRecord=(target:DrawerTarget)=>{setRecord(target);setInspectorOpen(true);workspace.current?.inspect()}
 const selectCriterion=(id:string)=>{setSelected(id);setRecord(null);if(!wide)workspace.current?.inspect()}
 const criterion=doc?.criteria.find(c=>c.criterion_id===selected)??doc?.criteria.find(c=>c.status==='unmet')??doc?.criteria[0]
 const matched=criterion?.evidence.flatMap(id=>{const event=doc?.events.find(e=>e.id===id);return event?[event]:[]})??[]
 const inspector=!doc?<p>No recorded selection.</p>:record?<Drawer inline target={record} doc={doc} trust={doc} blobs={doc.blobs} lens={lens} onOpenDrawer={openRecord} onClose={()=>setRecord(null)}/>:<CriterionDetail criterion={criterion} claims={doc.claims.filter(c=>c.criterion_ids.includes(criterion?.criterion_id??''))} matched={matched} onOpenDrawer={openRecord}/>
 const unavailable=nav.malformed||nav.activeTab&&!nav.activeSource||activeRunRef&&!activeSummary
 const loading=activeRunRef&&activeSummary&&!doc&&loadProblem?.key!==activeKey
 return <WorkspaceShell sourceLabel="Private reader · loaded" sourceDescription="Private registered snapshot. Read-only view." tabs={<WorkspaceTabs state={nav.state} dispatch={nav.dispatch} onRuns={onRuns} unsaved={nav.storageStatus==='memory-only'}/>} inspectorAvailable={!!doc} lens={lens} mobile={mobile} wide={wide} onOpenRun={doc?()=>openRecord({kind:'run',doc}):undefined} inspectorOpen={inspectorOpen} onInspectorOpenChange={setInspectorOpen} ref={workspace} inspector={inspector} navigation={<Sidebar currentView={nav.activeTab?.view??'runs'} onViewChange={handleViewChange} lens={lens} onLensChange={handleLensChange} reviewRequired={doc?.review_required??false}/> }>
  {unavailable?<section className="local-disconnected"><h1>Run unavailable</h1><p>This source or run is not available in the connected reader.</p><Button variant="outline" onClick={onRuns}>Return to Runs</Button></section>:activeRunRef&&!doc?<section className="local-disconnected"><h1>{loading?'Loading run…':'Unable to load run'}</h1>{loadProblem?.key===activeKey?<><p>{loadProblem.message}</p><Button variant="outline" onClick={()=>{setLoadProblem(null);setLoadRetry(value=>value+1)}}>Retry</Button><Button variant="outline" onClick={onRuns}>Return to Runs</Button></>:<p>Loading the selected run document from the private reader.</p>}</section>:!doc?<><PrivateRunsView catalog={catalog} loadingMore={loadingMore} onOpenRun={openRun} onLoadMore={loadMore} onDisconnect={onDisconnect}/>{catalogError&&<p role="alert">Unable to load more runs: {catalogError}</p>}</>:<>
  <IntegrityNotice verified={doc.verified} integrity={doc.integrity}/>
  {nav.activeTab?.view!=='overview'&&<div className="review-return"><Button variant="outline" size="sm" onClick={()=>handleViewChange('overview')}>Review criteria</Button></div>}
  {nav.activeTab?.view==='overview'&&<Overview doc={doc} lens={lens} showRunAction={false} selection={criterion?.criterion_id} onSelectCriterion={selectCriterion} onOpenDrawer={openRecord}/>}
  {nav.activeTab?.view==='claimed-vs-proven'&&<ClaimedVsProven doc={doc} lens={lens} onOpenDrawer={openRecord}/>}
  {nav.activeTab?.view==='timeline'&&<RenderView input={{kind:'events',events:doc.events}} context={{lens,blobs:doc.blobs,onOpenDrawer:openRecord}}/>}
  {nav.activeTab?.view==='agent-story'&&<RenderView input={{kind:'run',doc}} context={{lens,blobs:doc.blobs,onOpenDrawer:openRecord}}/>}
  </>}
 </WorkspaceShell>
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
