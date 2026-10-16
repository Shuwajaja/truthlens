import { useState, useEffect } from 'react'
import type { RunDoc } from './types.ts'
import { validateRunDoc } from './validateRunDoc.ts'
import { readLens, writeLens, type Lens } from './lens.ts'
import { Sidebar } from './components/Sidebar.tsx'
import { Overview } from './components/Overview.tsx'
import { ClaimedVsProven } from './components/ClaimedVsProven.tsx'
import { Timeline } from './components/Timeline.tsx'
import { Drawer, type DrawerTarget } from './components/Drawer.tsx'

export type View = 'overview' | 'claimed-vs-proven' | 'timeline'

export default function App() {
  const [doc, setDoc] = useState<RunDoc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verificationFailed, setVerificationFailed] = useState(false)
  const [view, setView] = useState<View>('overview')
  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget | null>(null)
  const [lens, setLens] = useState<Lens>(() => readLens())

  useEffect(() => {
    fetch('/run.json')
      .then(r => r.json())
      .then((data: unknown) => {
        if (!validateRunDoc(data)) {
          setVerificationFailed(true)
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
      <div className="flex items-center justify-center h-screen bg-[#0d1117] text-[#e6edf3] font-sans">
        <p className="text-[#f85149]">{error}</p>
      </div>
    )
  }
  if (verificationFailed) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0d1117] text-[#e6edf3] font-sans px-6 text-center">
        <h1 className="text-xl font-semibold text-[#f85149]">Verification failed</h1>
        <p className="mt-3 max-w-md text-[#8b949e] leading-relaxed">
          This run export could not be verified. Restore a valid export and reload to view run data.
        </p>
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
      <Sidebar
        currentView={view}
        onViewChange={setView}
        lens={lens}
        onLensChange={handleLensChange}
        reviewRequired={doc.review_required}
      />
      <div className="verified-badge">Verified run</div>
      <main className="ml-[220px] p-8 min-h-screen flex-1">
        {view === 'overview' && <Overview doc={doc} onOpenDrawer={setDrawerTarget} />}
        {view === 'claimed-vs-proven' && <ClaimedVsProven doc={doc} lens={lens} />}
        {view === 'timeline' && <Timeline events={doc.events} lens={lens} onOpenDrawer={setDrawerTarget} />}
      </main>
      {drawerTarget && (
        <Drawer
          target={drawerTarget}
          blobs={doc.blobs}
          lens={lens}
          onClose={() => setDrawerTarget(null)}
        />
      )}
    </div>
  )
}
