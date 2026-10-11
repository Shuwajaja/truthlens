import type { Lens } from '../lens.ts'

export function LensToggle({ lens, onChange }: { lens: Lens; onChange: (l: Lens) => void }) {
  return (
    <div
      className="flex rounded-lg border border-[#30363d] overflow-hidden text-xs"
      role="group"
      aria-label="View lens"
    >
      <button
        type="button"
        className={`flex-1 px-3 py-1.5 ${lens === 'client' ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#8b949e] hover:bg-[#21262d]/50'}`}
        aria-pressed={lens === 'client'}
        onClick={() => onChange('client')}
      >
        Client
      </button>
      <button
        type="button"
        className={`flex-1 px-3 py-1.5 border-l border-[#30363d] ${lens === 'developer' ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#8b949e] hover:bg-[#21262d]/50'}`}
        aria-pressed={lens === 'developer'}
        onClick={() => onChange('developer')}
      >
        Developer
      </button>
    </div>
  )
}
