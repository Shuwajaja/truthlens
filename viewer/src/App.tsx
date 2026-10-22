import {useMobile} from './lib/use-mobile.ts'
import {LensToggle} from './components/LensToggle.tsx'
import { useState, useEffect, useLayoutEffect } from 'react'
import type { RunDoc } from './types.ts'
import { validateRunDoc } from './validateRunDoc.ts'
import { readLens, writeLens, type Lens } from './lens.ts'
import { EvidenceRail } from './components/EvidenceRail.tsx'
import { Header } from './components/Header.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { Overview } from './components/Overview.tsx'
import { ClaimedVsProven } from './components/ClaimedVsProven.tsx'
import { RenderView } from './renderkit/RenderView.tsx'
import { Drawer, type DrawerTarget } from './components/Drawer.tsx'
import { IntegrityNotice } from './components/IntegrityNotice.tsx'

export type View = 'overview' | 'claimed-vs-proven' | 'timeline' | 'agent-story'

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
  const [view, setView] = useState<View>('overview')
  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget | null>(null)
  const [lens, setLens] = useState<Lens>(() => readLens())

  useLayoutEffect(()=>{
    document.documentElement.dataset.viewerTheme=view==='overview'?'stitch':'werk'
    return ()=>{delete document.documentElement.dataset.viewerTheme}
  },[view])

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

  useEffect(()=>{if(mobile)focusView()},[view,mobile])
  const handleViewChange=(next:View)=>{
    setView(next)
    if(mobile&&next===view)focusView()
  }

  const handleLensChange = (next: Lens) => {
    setLens(next)
    writeLens(next)
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground font-sans">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }
  if (invalidExport) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground font-sans px-6 text-center">
        <h1 className="text-xl font-semibold text-destructive">Invalid or inconsistent export</h1>
        <p className="mt-4 max-w-md text-muted-foreground leading-relaxed">
          Restore a valid export and reload to view run data.
        </p>
      </div>
    )
  }
  if (!doc) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground font-sans">
        <p>Loading run data…</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header mobile={mobile} trust={doc} onOpenRun={()=>setDrawerTarget({kind:'run',doc})} navigation={<Sidebar
        mobile={mobile}
        currentView={view}
        onViewChange={handleViewChange}
        lens={lens}
        onLensChange={handleLensChange}
        reviewRequired={doc.review_required}
      />}/>
      <div className={`workspace terminal-workspace ${view==='overview'?'overview-shell':''}`}>
      <main id="main-content" tabIndex={-1}>
        <IntegrityNotice verified={doc.verified} integrity={doc.integrity} controls={mobile?<LensToggle lens={lens} onChange={handleLensChange}/>:undefined} />
        {view === 'overview' && <Overview doc={doc} lens={lens} onOpenDrawer={setDrawerTarget} />}
        {view === 'claimed-vs-proven' && <ClaimedVsProven doc={doc} lens={lens} />}
        {view === 'timeline' && <RenderView input={{ kind: 'events', events: doc.events }} context={{ lens, onOpenDrawer: setDrawerTarget }} />}
        {view === 'agent-story' && <RenderView input={{ kind: 'run', doc }} context={{ lens, onOpenDrawer: setDrawerTarget }} />}
      </main>
      {!mobile&&view!=='overview'&&<EvidenceRail doc={doc} onOpenDrawer={setDrawerTarget} />}
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
