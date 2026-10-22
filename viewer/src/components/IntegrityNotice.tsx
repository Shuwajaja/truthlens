import type {ReactNode} from 'react'
import type { Integrity } from '../types.ts'
import { StatusBadge } from './ui/badge.tsx'

export function IntegrityNotice({ verified, integrity, controls }: { verified: boolean; integrity: Integrity; controls?:ReactNode }) {
  return <aside className="integrity-notice" aria-label="Trust boundaries">
    <div className="integrity-level"><span className="integrity-badge"><StatusBadge source="integrity" verified={verified} integrity={integrity} /></span>
      <strong>Integrity is not approval</strong></div>
    <p>This browser checks the file's internal consistency only; it does not verify signatures.</p>
    {controls&&<div className="integrity-controls">{controls}</div>}
  </aside>
}
