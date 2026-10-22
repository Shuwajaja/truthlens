import { useState, useEffect } from 'react'
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

export default function App() {
  const [doc, setDoc] = useState<RunDoc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [invalidExport, setInvalidExport] = useState(false)
  const [view, setView] = useState<View>('overview')
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
        <p className="mt-3 max-w-md text-muted-foreground leading-relaxed">
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
      <a className="skip-link" href="#main-content">Zum Inhalt</a>
      <Header />
      <div className="workspace">
      <Sidebar
        currentView={view}
        onViewChange={setView}
        lens={lens}
        onLensChange={handleLensChange}
        reviewRequired={doc.review_required}
      />
      <main id="main-content" tabIndex={-1}>
        <IntegrityNotice verified={doc.verified} integrity={doc.integrity} />
        {view === 'overview' && <Overview doc={doc} lens={lens} onOpenDrawer={setDrawerTarget} />}
        {view === 'claimed-vs-proven' && <ClaimedVsProven doc={doc} lens={lens} />}
        {view === 'timeline' && <RenderView input={{ kind: 'events', events: doc.events }} context={{ lens, onOpenDrawer: setDrawerTarget }} />}
        {view === 'agent-story' && <RenderView input={{ kind: 'run', doc }} context={{ lens, onOpenDrawer: setDrawerTarget }} />}
      </main>
      <EvidenceRail doc={doc} onOpenDrawer={setDrawerTarget} />
      </div>
      {drawerTarget && (
        <Drawer
          target={drawerTarget}
          trust={doc}
          blobs={doc.blobs}
          lens={lens}
          onClose={() => setDrawerTarget(null)}
        />
      )}
    </div>
  )
}
