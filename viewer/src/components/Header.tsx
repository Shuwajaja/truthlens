import type {ReactNode} from 'react'
import type {Lens} from '../lens.ts'
import type {RunDoc} from '../types.ts'
import {Button} from './ui/button.tsx'
import {StatusBadge} from './ui/badge.tsx'
/** Existing shield and central Stitch colours; no synthetic run status. */
export function Header({mobile=false,trust,onOpenRun,navigation,runTitle,lens}:{lens?:Lens;mobile?:boolean;trust?:Pick<RunDoc,'verified'|'integrity'>;onOpenRun?:()=>void;navigation?:ReactNode;runTitle?:string}){
 return <header className="mountain-header compact-header">
  <div className="brand"><img className="brand-icon" src="/logo-icon.svg" alt="" width="24" height="30"/><span className="brand-name">Truth<span className="brand-lens">Lens</span></span></div>
  {navigation}
  {mobile&&lens&&<span className="mode-label">{lens==='client'?'Client':'Developer'}</span>}
  {!mobile&&onOpenRun&&<Button variant="outline" size="sm" aria-label={`Open run: ${runTitle??'Exported run'} · Run details`} onClick={onOpenRun}>Run details</Button>}
  {mobile&&trust&&<button type="button" className="compact-trust" title="Open export details" onClick={onOpenRun}><StatusBadge source="integrity" verified={trust.verified} integrity={trust.integrity} compact/></button>}
 </header>
}
