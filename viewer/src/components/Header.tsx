import type {ReactNode} from 'react'
import type {RunDoc} from '../types.ts'
import {StatusBadge} from './ui/badge.tsx'
/** Existing shield and shared WERK colours; no synthetic run status. */
export function Header({mobile=false,trust,onOpenRun,navigation}:{mobile?:boolean;trust?:Pick<RunDoc,'verified'|'integrity'>;onOpenRun?:()=>void;navigation?:ReactNode}){
 return <header className="mountain-header compact-header">
  <div className="brand"><img className="brand-icon" src="/logo-icon.svg" alt="" width="24" height="30"/><span className="brand-name">Truth<span className="brand-lens">Lens</span></span></div>
  {navigation}
  {mobile&&trust&&<button type="button" className="compact-trust" title="Open export details" onClick={onOpenRun}><StatusBadge source="integrity" verified={trust.verified} integrity={trust.integrity} compact/></button>}
 </header>
}
