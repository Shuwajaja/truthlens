import { useState, useEffect } from 'react'
import type { RunDoc } from './types.ts'
import { Sidebar } from './components/Sidebar.tsx'
import { Overview } from './components/Overview.tsx'
import { ClaimedVsProven } from './components/ClaimedVsProven.tsx'
import { Timeline } from './components/Timeline.tsx'
import { Drawer, type DrawerTarget } from './components/Drawer.tsx'

export type View = 'overview' | 'claimed-vs-proven' | 'timeline'

export default function App() {
  const [doc, setDoc] = useState<RunDoc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('overview')
  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget | null>(null)

  useEffect(() => {
    fetch('/run.json')
      .then(r => r.json())
      .then((data: unknown) => setDoc(data as RunDoc))
      .catch((e: Error) => setError(e.message || 'Failed to load run data'))
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d1117] text-[#e6edf3] font-sans">
        <p className="text-[#f85149]">{error}</p>
      </div>
    )
  }
  if (!doc) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d1117] text-[#e6edf3] font-sans">
        <p>Loading run data…</p>
      </div>
    )
  }

  return (
    <div className="flex bg-[#0d1117] text-[#e6edf3] font-sans min-h-screen">
      <Sidebar currentView={view} onViewChange={setView} />
      {doc.verified && <div className="verified-badge">Verified run</div>}
      <main className="ml-[220px] p-8 min-h-screen flex-1">
        {view === 'overview' && <Overview doc={doc} onOpenDrawer={setDrawerTarget} />}
        {view === 'claimed-vs-proven' && <ClaimedVsProven doc={doc} />}
        {view === 'timeline' && <Timeline events={doc.events} onOpenDrawer={setDrawerTarget} />}
      </main>
      {drawerTarget && <Drawer target={drawerTarget} onClose={() => setDrawerTarget(null)} />}
    </div>
  )
}