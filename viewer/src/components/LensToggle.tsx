import type { Lens } from '../lens.ts'

export function LensToggle({ lens, onChange }: { lens: Lens; onChange: (l: Lens) => void }) {
  return <div className="lens-toggle" role="group" aria-label="View lens">
    {(['client', 'developer'] as const).map(value => <button key={value} type="button" aria-pressed={lens === value}
      onClick={() => onChange(value)}>{value === 'client' ? 'Client' : 'Developer'}</button>)}
  </div>
}
