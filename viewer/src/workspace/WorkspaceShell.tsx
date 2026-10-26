import {useEffect,useImperativeHandle,useLayoutEffect,useRef,useState,type ReactNode,type Ref} from 'react'
import {PanelLeft,PanelRight} from 'lucide-react'
import {Button} from '../components/ui/button.tsx'
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from '../components/ui/sheet.tsx'
import {readTheme,saveTheme,type ViewerTheme} from './theme.ts'
import {overviewCopy} from './overview-copy.ts'
import {useOverviewLanguage} from './overview-language.ts'
import type {Lens} from '../lens.ts'

export type WorkspaceHandle={inspect:()=>void}
export function WorkspaceShell({children,tabs,overview=false,tools,navigation,inspector,lens,mobile,wide,onOpenRun,inspectorOpen,onInspectorOpenChange,inspectorAvailable=true,sourceLabel,sourceDescription,ref}:{children:ReactNode;tabs?:ReactNode;overview?:boolean;tools?:ReactNode;navigation:ReactNode;inspector:ReactNode;lens:Lens;mobile:boolean;wide:boolean;onOpenRun?:()=>void;inspectorOpen:boolean;onInspectorOpenChange:(open:boolean)=>void;inspectorAvailable?:boolean;sourceLabel?:string;sourceDescription?:ReactNode;ref:Ref<WorkspaceHandle>}) {
 const {language,setLanguage}=useOverviewLanguage(),copy=overviewCopy[language]
 useEffect(()=>{document.documentElement.lang=overview?language:'en';return ()=>{document.documentElement.lang='en'}},[overview,language])
 const root=useRef<HTMLDivElement>(null),previousOverview=useRef(overview)
 // Reparented workspace tabs cannot retain DOM focus across presentations.
 useLayoutEffect(()=>{
  if(previousOverview.current!==overview){
   previousOverview.current=overview
   if(document.activeElement===document.body||!document.activeElement?.isConnected){
    root.current?.querySelector<HTMLElement>(overview?'.overview-tools > summary':'[data-tab-select][aria-pressed="true"]')?.focus()
   }
  }
 },[overview])
 const [navigationOpen,setNavigationOpen]=useState(true)
 const [sheet,setSheet]=useState<'navigation'|'inspector'|null>(null)
 const [theme,setTheme]=useState<ViewerTheme>(readTheme)
 const returnFocus=useRef<HTMLElement|null>(null)
 const inspectorToggle=useRef<HTMLButtonElement>(null)
 const layout=mobile?'mobile':wide?'desktop':'compact'
 const [previousLayout,setPreviousLayout]=useState(layout)
 // Adjust only transient state when the subscribed viewport changes.
 if(previousLayout!==layout){setPreviousLayout(layout);setSheet(null)}
 useImperativeHandle(ref,()=>({inspect(){
  if(wide)return
  if(sheet===null)returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null
  setSheet('inspector')
 }}),[wide,sheet])
 const toggleSheet=(next:'navigation'|'inspector')=>{returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setSheet(current=>current===next?null:next)}
 if(overview)return <div ref={root} className="app-shell workspace-app overview-shell" data-lens={lens} data-overview="true">
  <a className="skip-link" href="#main-content">{copy.overview}</a>
  <header className="overview-header">
   <div className="overview-brand"><span className="overview-monogram" aria-hidden="true">T</span><div><strong>TruthLens</strong><p>{copy.overview} · <span lang={sourceLabel?'en':language}>{sourceLabel??(import.meta.env.DEV?copy.fixture:copy.workspace)}</span></p></div></div>
   <details className="overview-tools" onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus()}}}>
    <summary>{copy.menu}</summary>
    <div className="overview-tools-panel">
     <label className="overview-language">{copy.language}<select value={language} onChange={event=>{if(event.target.value==='en'||event.target.value==='de')setLanguage(event.target.value)}}><option value="de" lang="de">Deutsch</option><option value="en" lang="en">English</option></select></label>
     <div lang="en">{tabs}{tools}{navigation}</div>
    </div>
   </details>
  </header>
  <main id="main-content" tabIndex={-1}>{children}</main>
 </div>
 return <div ref={root} className="app-shell workspace-app" data-lens={lens} data-navigation-open={!mobile&&navigationOpen} data-inspector-open={wide&&inspectorOpen&&inspectorAvailable}>
  <a className="skip-link" href="#main-content">Skip to content</a>
  <header className="workspace-header workspace-frame">
   <div className="workspace-brand"><img src="/logo-icon.svg" alt="" width="24" height="30"/><span>TruthLens</span></div>
   <span className="workspace-source">{sourceLabel??(import.meta.env.DEV?'Local development · fixture':'Local workspace')}</span>
   <div className="workspace-controls">
    <Button variant="ghost" aria-expanded={mobile?sheet==='navigation':navigationOpen} onClick={()=>mobile?toggleSheet('navigation'):setNavigationOpen(value=>!value)}><PanelLeft aria-hidden="true"/><span>Navigation</span></Button>
    {inspectorAvailable&&<Button ref={inspectorToggle} variant="ghost" aria-expanded={wide?inspectorOpen:sheet==='inspector'} onClick={()=>wide?onInspectorOpenChange(!inspectorOpen):toggleSheet('inspector')}><PanelRight aria-hidden="true"/><span>Inspector</span></Button>}
    <label className="theme-select"><span className="sr-only">Theme</span><select value={theme} onChange={event=>{const next=event.target.value as ViewerTheme;setTheme(next);saveTheme(next)}}><option value="petrol-porcelain">Petrol &amp; Porcelain</option><option value="cool-graphite">Cool Graphite</option></select></label>
   </div>
  </header>
  {tabs}
  <div className="workspace-grid">
   {!mobile&&navigationOpen&&<aside className="workspace-navigation workspace-frame" aria-label="Workspace navigation">{navigation}{onOpenRun&&<div className="workspace-run-link"><Button variant="outline" onClick={onOpenRun}>Run details</Button><p>{sourceDescription??<>Local test fixture.<br/>No live server connection.</>}</p></div>}</aside>}
   <main id="main-content" tabIndex={-1}>{children}</main>
   {wide&&inspectorOpen&&inspectorAvailable&&<aside className="workspace-inspector" aria-label="Context inspector"><div className="inspector-heading"><h2>Inspector</h2><Button variant="ghost" size="sm" onClick={()=>{onInspectorOpenChange(false);inspectorToggle.current?.focus()}}>Close inspector</Button></div>{inspector}</aside>}
  </div>
  <Sheet open={sheet!==null} onOpenChange={open=>{if(!open)setSheet(null)}}>
   {sheet&&<SheetContent aria-modal="true" side={sheet==='navigation'?'left':'bottom'} className={`workspace-sheet ${sheet==='navigation'?'workspace-frame':''}`} onCloseAutoFocus={event=>{event.preventDefault();if(returnFocus.current?.isConnected&&(document.activeElement===document.body||document.activeElement?.closest('[role="dialog"]')))returnFocus.current.focus()}}>
    <SheetHeader><SheetTitle>{sheet==='navigation'?'Navigation':'Context inspector'}</SheetTitle><SheetDescription className="sr-only">Local workspace. Reading evidence does not grant approval.</SheetDescription></SheetHeader>
    <div className="workspace-sheet-body" onClick={event=>{if(sheet==='navigation'&&(event.target as HTMLElement).closest('.nav-item'))setSheet(null)}}>{sheet==='navigation'?<>{navigation}{onOpenRun&&<Button variant="outline" onClick={()=>{setSheet(null);onOpenRun()}}>Run details</Button>}</>:inspector}</div>
   </SheetContent>}
  </Sheet>
 </div>
}
