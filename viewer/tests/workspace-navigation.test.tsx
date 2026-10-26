// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import App from '../src/App.tsx'
import run from '../fixtures/demo-run.json'
afterEach(()=>{cleanup();localStorage.clear();history.replaceState(null,'','/');vi.restoreAllMocks();vi.unstubAllGlobals()})
function openTools(){const summary=screen.getByText('Menü');if(!summary.closest('details')!.open)fireEvent.click(summary)}
function load(url='/') {history.replaceState(null,'',url);vi.stubGlobal('scrollTo',()=>{});vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(run)})));render(<App/>)}
it('lists only the supplied run and opens its canonical Overview',async()=>{load('/?view=runs');await screen.findByRole('heading',{name:'Übersicht'});expect(screen.getAllByRole('button',{name:name=>name.startsWith(run.run.project)})).toHaveLength(1);fireEvent.click(screen.getByRole('button',{name:name=>name.startsWith(run.run.project)}));expect(new URL(location.href).searchParams.get('run')).toBe(run.run.run_id)})
it('lands on the overview and opens details only after selecting a run',async()=>{
 load('/');await screen.findByRole('heading',{name:'Übersicht'})
 expect(screen.queryByRole('region',{name:'Criteria and evidence'})).toBeNull()
 expect(screen.getAllByRole('figure')).toHaveLength(4)
 expect(fetch).toHaveBeenCalledTimes(1)
 fireEvent.click(screen.getByRole('button',{name:name=>name.startsWith(run.run.project)}))
 expect(screen.getByRole('region',{name:'Criteria and evidence'})).toBeTruthy()
 expect(fetch).toHaveBeenCalledTimes(1)
})
it('keeps unavailable explicit references inert and offers Runs without fetching them',async()=>{load('/?source=missing&run=absent&view=timeline');await screen.findByRole('heading',{name:'Run unavailable'});expect(fetch).toHaveBeenCalledTimes(1);expect(screen.queryByText(run.run.project)).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Return to Runs'}));expect(screen.getByRole('heading',{name:'Übersicht'})).toBeTruthy()})
it('pins, closes and restores with focus on the selected tab',async()=>{load();await screen.findByRole('main');openTools();const tabs=within(screen.getByRole('region',{name:'Workspace tabs'}));fireEvent.click(tabs.getByRole('button',{name:/^Pin /}));expect(tabs.getByRole('button',{name:/^Unpin /}).getAttribute('aria-pressed')).toBe('true');fireEvent.click(tabs.getByRole('button',{name:/^Close /}));expect(document.activeElement).toBe(tabs.getByRole('button',{name:'Open Runs'}));fireEvent.click(tabs.getByText(/Recently closed/));fireEvent.click(tabs.getByRole('button',{name:/^Restore /}));expect(document.activeElement?.getAttribute('aria-pressed')).toBe('true');expect(tabs.getByRole('button',{name:/^Unpin /})).toBeTruthy()})
it('reports storage failure while retaining usable navigation',async()=>{vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota')});load();await screen.findByText('Unsaved on this device.');openTools();fireEvent.click(within(screen.getByRole('navigation',{name:'Viewer navigation'})).getByRole('button',{name:'Timeline',exact:true}));expect(screen.getByRole('heading',{name:'Timeline',exact:true})).toBeTruthy()})
