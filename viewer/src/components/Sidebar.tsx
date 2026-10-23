import { LayoutDashboard, ListChecks, ListTree, Route } from 'lucide-react'
import type { WorkspaceView as View } from '../workspace/navigation-types.ts'
import type { Lens } from '../lens.ts'
import { LensToggle } from './LensToggle.tsx'
import { Badge } from './ui/badge.tsx'

const items = [
  { key: 'runs', label: 'Runs', short: 'Runs', Icon: ListTree },
  { key: 'overview', label: 'Overview', short: 'Overview', Icon: LayoutDashboard },
  { key: 'claimed-vs-proven', label: 'Claimed vs proven', short: 'Claims', Icon: ListChecks },
  { key: 'timeline', label: 'Timeline', short: 'Timeline', Icon: ListTree },
  { key: 'agent-story', label: 'Agent story', short: 'Story', Icon: Route },
] as const

export function Sidebar({ currentView, onViewChange, lens, onLensChange, reviewRequired, mobile=false }: {
  currentView: View; onViewChange: (v: View) => void
  lens: Lens; onLensChange: (l: Lens) => void; reviewRequired: boolean; mobile?:boolean
}) {
  return <nav className="sidebar" aria-label="Viewer navigation">
    <div className="sidebar-content">
    {!mobile&&<div className="sidebar-brand"><img src="/logo-icon.svg" alt="" width="24" height="30"/><span>Truth<span className="brand-lens">Lens</span></span></div>}
    <ul className="nav-list">
      {items.map(({ key, label, short, Icon }) => <li key={key}>
        <button type="button" className={`nav-item ${currentView === key ? 'nav-item-active' : ''}`}
          aria-label={mobile?short:label} aria-current={currentView === key ? 'page' : undefined} onClick={() => onViewChange(key)}>
          <Icon size={18} aria-hidden="true" /><span>{mobile?short:label}</span>
        </button>
      </li>)}
    </ul>
    {!mobile&&<div className="sidebar-meta">
      <LensToggle lens={lens} onChange={onLensChange} />
      {reviewRequired && <Badge>Review required</Badge>}
      <p>Local run export.<br />No approval in the browser.</p>
    </div>}
    </div>
  </nav>
}
