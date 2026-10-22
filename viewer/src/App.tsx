import {useMobile} from './lib/use-mobile.ts'
import {LensToggle} from './components/LensToggle.tsx'
import {useView} from './lib/use-view.ts'
import { useState, useEffect } from 'react'
import type { RunDoc } from './types.ts'
import { validateRunDoc } from './validateRunDoc.ts'
import { readLens, writeLens, type Lens } from './lens.ts'
import {ViewState} from './components/ViewState.tsx'
import {Button} from './components/ui/button.tsx'
import { Header } from './components/Header.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { Overview } from './components/Overview.tsx'
import { ClaimedVsProven } from './components/ClaimedVsProven.tsx'
import { RenderView } from './renderkit/RenderView.tsx'
import { Drawer, type DrawerTarget } from './components/Drawer.tsx'
import { IntegrityNotice } from './components/IntegrityNotice.tsx'

export type {View} from './lib/use-view.ts'
import type {View} from './lib/use-view.ts'

function focusView(){
  const heading=document.querySelector<HTMLElement>('main h1')
  if(!heading)return
  heading.tabIndex=-1
  heading.focus({preventScroll:true})
  window.scrollTo({top:0,left:0,behavior:'auto'})
}

export default function App() {
  const mobile=useMobile()
  const [doc, setDoc] = useState<RunDoc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [invalidExport, setInvalidExport] = useState(false)
  const [view, setView] = useView()
  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget | null>(null)
  const [lens, setLens] = useState<Lens>(() => readLens())

  useEffect(() => {
    fetch('/run.json')
      .then(r => r.json())
      .then((data: unknown) => {
        if (!validateRunDoc(data)) {
          setInvalidExport(true)
          return
        }
        setDoc(data)
      })
      .catch((e: Error) => setError(e.message || 'Failed to load run data'))
  }, [])

  useEffect(()=>{focusView()},[view,mobile])
  const handleViewChange=(next:View)=>{
    setView(next)
    if(mobile&&next===view)focusView()
  }

  const handleLensChange = (next: Lens) => {
    setLens(next)
    writeLens(next)
  }

  if(error)return <ViewState title="Unable to load run data" description={error} error/>
  if(invalidExport)return <ViewState title="Invalid or inconsistent export" description="Restore a valid export and reload to view run data." error/>
  if(!doc)return <ViewState title="Loading run data…"/>

  return (
    <div className="app-shell" data-lens={lens}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header mobile={mobile} trust={doc} runTitle={doc.run.project} onOpenRun={()=>setDrawerTarget({kind:'run',doc})} navigation={<Sidebar
        mobile={mobile}
        currentView={view}
        onViewChange={handleViewChange}
        lens={lens}
        onLensChange={handleLensChange}
        reviewRequired={doc.review_required}
      />}/>
      <div className="workspace terminal-workspace">
      <main id="main-content" tabIndex={-1}>
        <IntegrityNotice verified={doc.verified} integrity={doc.integrity} controls={mobile?<LensToggle lens={lens} onChange={handleLensChange}/>:undefined} />
        {view!=='overview'&&<div className="review-return"><Button variant="outline" size="sm" onClick={()=>handleViewChange('overview')}>Review criteria</Button></div>}
        {view === 'overview' && <Overview doc={doc} lens={lens} showRunAction={mobile} onOpenDrawer={setDrawerTarget} />}
        {view === 'claimed-vs-proven' && <ClaimedVsProven doc={doc} lens={lens} onOpenDrawer={setDrawerTarget} />}
        {view === 'timeline' && <RenderView input={{ kind: 'events', events: doc.events }} context={{ lens, onOpenDrawer: setDrawerTarget }} />}
        {view === 'agent-story' && <RenderView input={{ kind: 'run', doc }} context={{ lens, onOpenDrawer: setDrawerTarget }} />}
      </main>
      </div>
      {drawerTarget && (
        <Drawer
          target={drawerTarget}
          doc={doc}
          trust={doc}
          blobs={doc.blobs}
          lens={lens}
          onOpenDrawer={setDrawerTarget}
          onClose={() => setDrawerTarget(null)}
        />
      )}
    </div>
  )
}
