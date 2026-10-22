import type {RunDoc} from '../types.ts'
import {StatusBadge} from './ui/badge.tsx'
/** Shapes from Shu's supplied SVGs; all paints come from the shared theme. */
export function Header({mobile=false,trust,onOpenRun}:{mobile?:boolean;trust?:Pick<RunDoc,'verified'|'integrity'>;onOpenRun?:()=>void}) {
  return <header className="mountain-header">
    {!mobile&&<svg className="mountain-art" viewBox="0 0 1440 150" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="ridge" x2="0" y2="1"><stop stopColor="var(--border)"/><stop offset="1" stopColor="var(--bg)"/></linearGradient><linearGradient id="foothills" x2="0" y2="1"><stop stopColor="var(--surface-2)"/><stop offset="1" stopColor="var(--bg)"/></linearGradient></defs>
      <path d="M380 150 L560 70 L640 95 L760 20 L840 60 L900 40 L1010 95 L1120 55 L1260 110 L1440 70 L1440 150Z" fill="url(#ridge)"/>
      <path d="M760 20 L780 45 L770 60 L800 52 L840 60 L800 40Z" fill="var(--text-3)" opacity=".2"/>
      <path d="M300 150 L520 110 L700 125 L860 90 L1000 130 L1200 100 L1440 135 L1440 150Z" fill="url(#foothills)"/>
    </svg>}
    <div className="brand">
      {mobile?<><img className="brand-icon" src="/logo-icon.svg" alt="" width="24" height="30"/><span className="brand-name">Truth<span className="brand-lens">Lens</span></span></>:<div><img className="brand-wordmark" src="/logo-wordmark.svg" alt="TruthLens" width="224" height="64"/><p>See what your agent actually did.</p></div>}
    </div>
    {mobile&&trust&&<button type="button" className="compact-trust" title="Open export details" onClick={onOpenRun}><StatusBadge source="integrity" verified={trust.verified} integrity={trust.integrity} compact/></button>}
    <div className="brand-note"><p>Evidence · transparency · trust</p><strong>Evidence, not claims.</strong></div>
  </header>
}
