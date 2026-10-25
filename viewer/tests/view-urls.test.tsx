// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import App from '../src/App.tsx'
import publicRun from '../fixtures/demo-run.json'

beforeEach(()=>{
 history.replaceState(null,'','/')
 vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(publicRun)})))
})
afterEach(()=>{cleanup();history.replaceState(null,'','/');localStorage.clear();vi.unstubAllGlobals()})
const navigation=()=>within(screen.getByRole('navigation',{name:'Viewer navigation'}))
const selected=()=>screen.getByRole('navigation',{name:'Viewer navigation'}).querySelector('[aria-current="page"]')?.textContent

it.each([
 ['overview','Overview'],['claimed-vs-proven','Claimed vs proven'],['timeline','Timeline'],['agent-story','Agent story'],
])('restores the real %s view from a shared URL',async(view,label)=>{
 history.replaceState(null,'',`/?view=${view}`)
 render(<App/>);await screen.findByRole('main')
 expect(selected()).toBe(label)
 expect(screen.getByRole('main').textContent).toContain(view==='overview'?publicRun.run.project:view==='agent-story'?'Agent Story':view==='claimed-vs-proven'?'Claims and recorded results':label)
})
it.each(['/?view=unknown','/?view='])('safely opens the run Overview for an unrecognized legacy view: %s',async(url)=>{
 history.replaceState(null,'',url)
 render(<App/>);await screen.findByRole('main')
 expect(selected()).toBe('Overview')
})
it('starts a fresh workspace at the overview of runs',async()=>{
 render(<App/>);await screen.findByRole('main')
 expect(selected()).toBe('Runs')
 expect(screen.queryByRole('button',{name:'Run details',exact:true})).toBeNull()
})
it('updates the shareable URL without losing other parameters/hash or adding duplicate entries',async()=>{
 history.replaceState({unrelated:'kept'},'','/review/run?filter=review#main-content')
 localStorage.setItem('tl-lens','developer')
 render(<App/>);await screen.findByRole('main')
 fireEvent.click(navigation().getByRole('button',{name:'Timeline',exact:true}))
 expect(new URL(location.href).searchParams.get('filter')).toBe('review')
 expect(new URL(location.href).searchParams.get('source')).toBe('local-fixture')
 expect(new URL(location.href).searchParams.get('view')).toBe('timeline')
 expect(location.pathname).toBe('/review/run')
 expect(location.hash).toBe('#main-content')
 expect(history.state).toEqual({unrelated:'kept'})
 const length=history.length
 fireEvent.click(navigation().getByRole('button',{name:'Timeline',exact:true}))
 expect(history.length).toBe(length)
 expect(localStorage.getItem('tl-lens')).toBe('developer')
 fireEvent.click(navigation().getByRole('button',{name:'Overview',exact:true}))
 expect(new URL(location.href).searchParams.get('view')).toBe('overview')
})
it('restores navigation on a browser history event without writing another entry',async()=>{
 render(<App/>);await screen.findByRole('main')
 history.pushState(null,'','/?view=agent-story')
 const length=history.length
 fireEvent.popState(window)
 expect(selected()).toBe('Agent story')
 expect(history.length).toBe(length)
 history.replaceState(null,'','/?view=invalid')
 fireEvent.popState(window)
 expect(selected()).toBe('Overview')
})
