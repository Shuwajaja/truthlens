import type { View } from '../App.tsx'
import type { Lens } from '../lens.ts'
import { LensToggle } from './LensToggle.tsx'

export function Sidebar({
  currentView,
  onViewChange,
  lens,
  onLensChange,
  reviewRequired,
}: {
  currentView: View
  onViewChange: (v: View) => void
  lens: Lens
  onLensChange: (l: Lens) => void
  reviewRequired: boolean
}) {
  const items: { key: View; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'claimed-vs-proven', label: 'Claimed vs Proven' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'agent-story', label: 'Agent Story' },
  ]

  return (
    <nav className="sidebar">
      <div className="px-4 py-6 text-[#e6edf3] font-bold text-lg tracking-tight">TruthLens</div>
      <div className="px-4 pb-4 space-y-3">
        <LensToggle lens={lens} onChange={onLensChange} />
        {reviewRequired && (
          <span className="inline-flex text-xs px-2 py-[1px] rounded-[4px] border border-[#30363d] text-[#e6edf3]">
            Review required
          </span>
        )}
      </div>
      <ul className="space-y-1 px-2 flex-1">
        {items.map(item => (
          <li key={item.key}>
            <button
              type="button"
              className={`w-full text-left px-4 py-2 text-sm rounded-lg nav-item ${currentView === item.key ? 'nav-item-active' : ''}`}
              onClick={() => onViewChange(item.key)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
