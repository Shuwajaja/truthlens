import {useLayoutEffect,useRef} from 'react'
import {Button} from '../components/ui/button.tsx'
import type {NavigationAction,WorkspaceNavigationState,TabReference,WorkspaceView} from './navigation-types.ts'
const viewLabels:Record<WorkspaceView,string>={runs:'Runs',overview:'Overview','claimed-vs-proven':'Claimed vs proven',timeline:'Timeline','agent-story':'Agent story',chain:'Chain',coverage:'Coverage','gated-actions':'Gated actions',changes:'Changes',compare:'Compare'}
function label(ref:TabReference,view:WorkspaceView){return `${viewLabels[view]} · ${ref.sourceId}${ref.kind==='run'?` · ${ref.runId}`:''}`}
export function WorkspaceTabs({state,dispatch,onRuns,unsaved}:{state:WorkspaceNavigationState;dispatch:(action:NavigationAction)=>void;onRuns:()=>void;unsaved:boolean}){
 const root=useRef<HTMLElement>(null),pending=useRef(false)
 useLayoutEffect(()=>{if(pending.current){pending.current=false;const selected=root.current?.querySelector<HTMLButtonElement>('[data-tab-select][aria-pressed="true"]');(selected??root.current?.querySelector<HTMLButtonElement>('[data-open-runs]'))?.focus()}},[state])
 return <section ref={root} className="workspace-tabs" aria-label="Workspace tabs">
  <div className="workspace-tab-strip" role="group" aria-label="Open workspace tabs">
   <Button data-open-runs variant="outline" onClick={onRuns}>Open Runs</Button>
   {state.tabs.map(tab=><div className="workspace-tab" key={tab.tabId}>
    <Button data-tab-select title={label(tab.ref,tab.view)} aria-label={`Select ${label(tab.ref,tab.view)}`} aria-pressed={state.activeTabId===tab.tabId} variant="ghost" onClick={()=>dispatch({type:'select-tab',tabId:tab.tabId})}>{label(tab.ref,tab.view)}</Button>
    <Button variant="ghost" aria-label={`${tab.pinned?'Unpin':'Pin'} ${label(tab.ref,tab.view)}`} aria-pressed={tab.pinned} onClick={()=>dispatch({type:'toggle-pin',tabId:tab.tabId})}>{tab.pinned?'Unpin':'Pin'}</Button>
    <Button variant="ghost" aria-label={`Close ${label(tab.ref,tab.view)}`} onClick={()=>{pending.current=true;dispatch({type:'close-tab',tabId:tab.tabId,closedAt:Date.now()})}}>Close</Button>
   </div>)}
  </div>
  {unsaved&&<p role="status">Unsaved on this device.</p>}
  {state.capacityError&&<p role="alert">40 tabs are open. Close a tab before opening or restoring another.</p>}
  <details className="workspace-recent"><summary>Recently closed ({state.closed.length}; latest 20)</summary>{!state.closed.length?<p>No recently closed tabs.</p>:<ul>{state.closed.map((entry,index)=><li key={`${entry.closedAt}-${index}`}><Button variant="outline" title={label(entry.ref,entry.view)} aria-label={`Restore ${label(entry.ref,entry.view)}`} onClick={()=>{pending.current=true;dispatch({type:'restore-closed',index})}}>Restore {label(entry.ref,entry.view)}</Button></li>)}</ul>}</details>
 </section>
}
