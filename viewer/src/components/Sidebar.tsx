import type { View } from '../App.tsx'

export function Sidebar({ currentView, onViewChange }: {
  currentView: View
  onViewChange: (v: View) => void
}) {
  const items: { key: View; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'claimed-vs-proven', label: 'Claimed vs Proven' },
    { key: 'timeline', label: 'Timeline' },
  ]

  return (
    <nav className="sidebar">
      <div className="px-4 py-6 text-[#e6edf3] font-bold text-lg tracking-tight">TruthLens</div>
      <ul className="space-y-1 px-2">
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