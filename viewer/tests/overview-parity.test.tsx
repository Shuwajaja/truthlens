// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import App from '../src/App.tsx'
import {RunsView} from '../src/workspace/RunsView.tsx'
import type {RunDoc} from '../src/types.ts'
import fixture from '../fixtures/demo-run.json'

const source=(doc=structuredClone(fixture) as RunDoc)=>({sourceId:'fixture-source',label:'Synthetic test input',kind:'development-fixture' as const,runs:new Map([[doc.run.run_id,doc]])})
afterEach(()=>{cleanup();localStorage.clear();history.replaceState(null,'','/');vi.unstubAllGlobals();vi.unstubAllEnvs()})
function load(){
 vi.stubGlobal('scrollTo',()=>{})
 vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(fixture)})))
 render(<App/>)
}
it('draws an accessible SVG ring from the recorded criterion counts',()=>{
 const doc=structuredClone(fixture) as RunDoc
 render(<RunsView sources={[source(doc)]} onOpenRun={()=>{}}/>)
 const met=doc.criteria.filter(c=>c.status==='met').length
 const ring=screen.getByRole('img',{name:`${met} of ${doc.criteria.length} criteria met`})
 expect(ring.tagName.toLowerCase()).toBe('svg')
 expect(ring.querySelectorAll('circle[data-criterion]').length).toBeGreaterThan(0)
 expect(screen.getByText('Hash only · signature not checked')).toBeTruthy()
})
it('shows criteria as vertical stacked columns with an exact text equivalent per run',()=>{
 const doc=structuredClone(fixture) as RunDoc
 render(<RunsView sources={[source(doc)]} onOpenRun={()=>{}}/>)
 const chart=screen.getByRole('figure',{name:'Criteria per run'})
 const image=within(chart).getByRole('img')
 expect(image.tagName.toLowerCase()).toBe('svg')
 expect(image.querySelectorAll('rect[data-criterion]').length).toBeGreaterThan(0)
 expect(within(chart).getByText(doc.run.run_id)).toBeTruthy()
 expect(within(chart).getByText(`${doc.criteria.filter(c=>c.status==='met').length} met`)).toBeTruthy()
})
it('uses a single real trend point without manufacturing a line for one dated run',()=>{
 render(<RunsView sources={[source()]} onOpenRun={()=>{}}/>)
 const chart=screen.getByRole('figure',{name:'Criteria met over recent runs'})
 expect(within(chart).getByRole('img').querySelectorAll('circle')).toHaveLength(1)
 expect(chart.querySelector('polyline')).toBeNull()
})
it('keeps zero criteria neutral and never calls criterion completion a run pass',()=>{
 const doc=structuredClone(fixture) as RunDoc;doc.criteria=[];doc.claims=[]
 render(<RunsView sources={[source(doc)]} onOpenRun={()=>{}}/>)
 expect(screen.getByRole('img',{name:'No criteria recorded'})).toBeTruthy()
 expect(screen.queryByText(/0\/0|0 of 0|NaN|runs passed/i)).toBeNull()
 expect(screen.getByText('Criteria: not checkable')).toBeTruthy()
})
it('labels latest-run pills as criteria and retains the existing run reference',()=>{
 const doc=structuredClone(fixture) as RunDoc
 doc.criteria=doc.criteria.map(c=>({...c,status:'met'}))
 const open=vi.fn()
 render(<RunsView sources={[source(doc)]} onOpenRun={open}/>)
 const button=screen.getByRole('button',{name:name=>name.startsWith(doc.run.project)})
 expect(within(button).getByText('Criteria: met')).toBeTruthy()
 const statusId=button.getAttribute('aria-describedby')
 expect(statusId).toBeTruthy()
 expect(document.getElementById(statusId!)?.textContent).toBe('Criteria: met')
 fireEvent.click(button)
 expect(open).toHaveBeenCalledWith({kind:'run',sourceId:'fixture-source',runId:doc.run.run_id})
 expect(screen.queryByText(/runs passed|signature checked/i)).toBeNull()
})
it('lands on the German overview with chrome in a closed menu and switches fixed copy to English',async()=>{
 load()
 await screen.findByText('TruthLens prüft, ob KI-Agenten wirklich getan haben, was sie behaupten.')
 const main=screen.getByRole('main'),shell=main.closest('.workspace-app')!
 expect(shell.getAttribute('data-overview')).toBe('true')
 expect(within(screen.getByRole('banner')).getByText('Lokale Testaufzeichnung')).toBeTruthy()
 const tools=screen.getByText('Menü').closest('details')!
 expect(tools.open).toBe(false)
 expect(within(tools).getByText('Open local folder')).toBeTruthy()
 expect(within(tools).getByRole('region',{name:'Workspace tabs',hidden:true})).toBeTruthy()
 expect(main.querySelector('.local-open,.workspace-tabs,.workspace-navigation')).toBeNull()
 expect(document.documentElement.lang).toBe('de')
 fireEvent.click(screen.getByText('Menü'))
 fireEvent.change(screen.getByRole('combobox',{name:'Sprache'}),{target:{value:'en'}})
 expect(screen.getByText('TruthLens checks whether AI agents really did what they claim.')).toBeTruthy()
 expect(document.documentElement.lang).toBe('en')
 expect(within(screen.getByRole('button',{name:name=>name.startsWith(fixture.run.project)})).getByText(fixture.run.project)).toBeTruthy()
 expect(fetch).toHaveBeenCalledTimes(1)
 fireEvent.click(screen.getByRole('button',{name:name=>name.startsWith(fixture.run.project)}))
 expect(screen.getByRole('region',{name:'Claim vs. evidence'})).toBeTruthy()
 expect(document.activeElement).toBe(screen.getByRole('heading',{level:1}))
 expect(document.documentElement.lang).toBe('en')
 expect(fetch).toHaveBeenCalledTimes(1)
})
it('shows a German empty overview before disconnected controls and performs no production request',()=>{
 vi.stubEnv('DEV',false);vi.stubGlobal('fetch',vi.fn());render(<App/>)
 expect(screen.getByText('Noch keine geladenen Läufe.')).toBeTruthy()
 expect(screen.queryByRole('figure')).toBeNull()
 expect(screen.queryByText(/0\/0|0 von 0/)).toBeNull()
 const menu=screen.getByText('Menü').closest('details')!
 expect(menu.open).toBe(false)
 expect(within(menu).getByRole('button',{name:'Connect',hidden:true})).toBeTruthy()
 expect(screen.getByText(/Integrity is not approval/)).toBeTruthy()
 expect(fetch).not.toHaveBeenCalled()
})

it('keeps focus reachable when closing a detail tab returns to the compact overview',async()=>{
 history.replaceState(null,'','/?view=overview');load()
 await screen.findByRole('region',{name:'Behauptung gegen Beweis'});fireEvent.click(screen.getByText('Menü'))
 const tabs=screen.getByRole('region',{name:'Workspace tabs'})
 const selected=within(tabs).getAllByRole('button',{name:/^Close /}).at(-1)!
 selected.focus();fireEvent.click(selected)
 await screen.findByRole('heading',{name:'Übersicht'})
 expect(document.activeElement).toBe(screen.getByRole('button',{name:'Open Runs'}))
 expect(screen.getByText('Menü').closest('details')!.open).toBe(true)
 fireEvent.click(screen.getByText(/Recently closed/))
 fireEvent.click(screen.getByRole('button',{name:/^Restore Overview/}))
 expect(screen.getByRole('region',{name:'Behauptung gegen Beweis'})).toBeTruthy()
 expect(document.activeElement?.getAttribute('data-tab-select')).not.toBeNull()
})
