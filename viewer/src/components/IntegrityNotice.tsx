import type { Integrity } from '../types.ts'
import { StatusBadge } from './ui/badge.tsx'

export function IntegrityNotice({ verified, integrity }: { verified: boolean; integrity: Integrity }) {
  return <aside className="integrity-notice" aria-label="Trust boundaries">
    <div className="integrity-level"><span className="integrity-badge"><StatusBadge source="integrity" verified={verified} integrity={integrity} /></span>
      <strong>Integrität ≠ fachliche Freigabe</strong></div>
    <p>This browser checks the file's internal consistency only; it does not verify signatures.</p>
  </aside>
}
