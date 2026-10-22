import { LayoutDashboard, ListChecks, ListTree, Route } from 'lucide-react'
import type { View } from '../App.tsx'
import type { Lens } from '../lens.ts'
import { LensToggle } from './LensToggle.tsx'
import { Badge } from './ui/badge.tsx'

const items = [
  { key: 'overview', label: 'Übersicht', Icon: LayoutDashboard },
  { key: 'claimed-vs-proven', label: 'Behauptet vs. belegt', Icon: ListChecks },
  { key: 'timeline', label: 'Zeitachse', Icon: ListTree },
  { key: 'agent-story', label: 'Agent-Verlauf', Icon: Route },
] as const

export function Sidebar({ currentView, onViewChange, lens, onLensChange, reviewRequired }: {
  currentView: View; onViewChange: (v: View) => void
  lens: Lens; onLensChange: (l: Lens) => void; reviewRequired: boolean
}) {
  return <nav className="sidebar" aria-label="Viewer navigation">
    <div className="sidebar-content">
    <ul className="nav-list">
      {items.map(({ key, label, Icon }) => <li key={key}>
        <button type="button" className={`nav-item ${currentView === key ? 'nav-item-active' : ''}`}
          aria-current={currentView === key ? 'page' : undefined} onClick={() => onViewChange(key)}>
          <Icon size={18} aria-hidden="true" /><span>{label}</span>
        </button>
      </li>)}
    </ul>
    <div className="sidebar-meta">
      <LensToggle lens={lens} onChange={onLensChange} />
      {reviewRequired && <Badge>Review required</Badge>}
      <p>Lokaler RunDoc-Export.<br />Keine fachliche Freigabe im Browser.</p>
    </div>
    </div>
  </nav>
}
