import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react'
import {navigationReducer} from './navigation-reducer.ts'
import {readNavigation,writeNavigation} from './navigation-storage.ts'
import {parseWorkspaceUrl,writeWorkspaceUrl} from './navigation-url.ts'
import type {NavigationAction,TabReference,WorkspaceSource,WorkspaceView} from './navigation-types.ts'

function openAction(ref:TabReference,view:WorkspaceView):NavigationAction {
 return ref.kind==='runs'?{type:'open-runs',sourceId:ref.sourceId}:{type:'open-run',ref,view:view==='runs'?'overview':view}
}
/** Sole owner of workspace browser history. Resolution reads supplied memory only. */
export function useWorkspaceNavigation({sources}:{sources:readonly WorkspaceSource[]}) {
 const source=sources[0],first=source?.runs.keys().next().value
 const defaultRef=useMemo<TabReference|undefined>(()=>source&&first?{kind:'run',sourceId:source.sourceId,runId:first}:undefined,[source,first])
 const [initial]=useState(()=>{
  const stored=readNavigation(),url=new URL(window.location.href)
  const parsed=parseWorkspaceUrl(url,defaultRef)
  const explicit=parsed.explicit||url.searchParams.has('view')
  const state=parsed.ref&&(explicit||!stored.state.tabs.length)?navigationReducer(stored.state,openAction(parsed.ref,parsed.view)):stored.state
  return {state,status:stored.status,malformed:parsed.malformed||state.capacityError!==null}
 })
 const [state,setState]=useState(initial.state),current=useRef(state)
 const [historyRevision,setHistoryRevision]=useState(0)
 const [malformed,setMalformed]=useState(initial.malformed)
 const [storageStatus,setStorageStatus]=useState(initial.status)
 const dispatch=(action:NavigationAction)=>{
  const before=current.current,next=navigationReducer(before,action)
  current.current=next;setState(next)
  if(next===before||next.capacityError)return
  const selects=action.type==='open-run'||action.type==='open-runs'||action.type==='select-tab'||action.type==='restore-closed'
  if(next.activeTabId===before.activeTabId&&!selects)return
  setMalformed(false)
  if(next.activeTabId===before.activeTabId&&!malformed)return
  const active=next.tabs.find(t=>t.tabId===next.activeTabId)
  const target=active??(source?{ref:{kind:'runs' as const,sourceId:source.sourceId},view:'runs' as const}:null)
  if(target){const url=writeWorkspaceUrl(window.location.href,target);if(url.href!==window.location.href)window.history.pushState(window.history.state,'',url)}
 }
 // Storage is an external system; report its actual write result.
 // oxlint-disable-next-line react/set-state-in-effect
 useEffect(()=>{setStorageStatus(writeNavigation(undefined,state).status)},[state])
 // Bind the first entry to the identity restored from device metadata, without a new entry.
 useLayoutEffect(()=>{
  const active=initial.state.tabs.find(tab=>tab.tabId===initial.state.activeTabId)
  if(active&&!initial.malformed){const url=writeWorkspaceUrl(window.location.href,active);if(url.href!==window.location.href)window.history.replaceState(window.history.state,'',url)}
 },[initial])
 useLayoutEffect(()=>{
  const restore=()=>{
   const parsed=parseWorkspaceUrl(window.location.href,defaultRef)
   setMalformed(parsed.malformed)
   if(parsed.ref){const next=navigationReducer(current.current,openAction(parsed.ref,parsed.view));setMalformed(parsed.malformed||next.capacityError!==null);if(next.activeTabId!==current.current.activeTabId)setHistoryRevision(value=>value+1);current.current=next;setState(next)}
  }
  window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore)
 },[defaultRef])
 const activeTab=malformed?undefined:state.tabs.find(t=>t.tabId===state.activeTabId)
 const activeSource=sources.find(s=>s.sourceId===activeTab?.ref.sourceId)
 const activeRun=activeTab?.ref.kind==='run'?activeSource?.runs.get(activeTab.ref.runId):undefined
 return {historyRevision,state,activeTab,activeSource,activeRun,malformed,storageStatus,capacityError:state.capacityError,dispatch,navigate:(ref:TabReference,view:WorkspaceView)=>dispatch(openAction(ref,view))}
}
