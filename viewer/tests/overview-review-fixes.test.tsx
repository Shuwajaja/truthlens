// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it} from 'vitest'
import {cleanup,render,screen,within} from '@testing-library/react'
import {readFileSync} from 'node:fs'
import {RunsView} from '../src/workspace/RunsView.tsx'
import {OverviewLocale} from '../src/workspace/overview-language.ts'
import type {OverviewLanguage} from '../src/workspace/overview-copy.ts'
import type {RunDoc} from '../src/types.ts'
import fixture from '../fixtures/demo-run.json'

const css=readFileSync('src/workspace/runs-overview.css','utf8')
let style:HTMLStyleElement
beforeEach(()=>{
 style=document.createElement('style')
 // jsdom cannot resolve custom properties in background shorthands. Distinct
 // test colours exercise the real cascade/token selection, not browser layout.
 const colours:Record<string,string>={accent:'limegreen',ok:'green',fail:'red',info:'blue',neutral:'grey','text-2':'silver','surface-2':'whitesmoke'}
 style.textContent=css.replace(/var\(--([\w-]+)\)/g,(value,token:string)=>colours[token]??value)
 document.head.append(style)
})
afterEach(()=>{cleanup();style.remove()})
function overview(language:OverviewLanguage='en'){
 const doc=structuredClone(fixture) as RunDoc
 // Synthetic local civil time: the short display must work in either host TZ.
 doc.run.started=new Date(2026,9,11,16,46,1,809).toISOString()
 const source={sourceId:'review-fixture',label:'Synthetic test input',kind:'development-fixture' as const,runs:new Map([[doc.run.run_id,doc]])}
 const view=render(<OverviewLocale.Provider value={{language,setLanguage:()=>{}}}><RunsView sources={[source]} onOpenRun={()=>{}}/></OverviewLocale.Provider>)
 return {...view,doc}
}
it('keeps every score-ring circle hollow while retaining status strokes and filled columns',()=>{
 const {container}=overview()
 const circles=container.querySelectorAll('.score-ring circle')
 expect(circles.length).toBeGreaterThan(1)
 // jsdom normalizes SVG fill:none to transparent RGBA.
 for(const circle of circles)expect(['none','rgba(0, 0, 0, 0)']).toContain(getComputedStyle(circle).fill)
 for(const status of ['met','unmet','unverified']){
  const circle=container.querySelector(`.score-ring [data-criterion=${status}]`)!
  const column=container.querySelector(`.criteria-columns [data-criterion=${status}]`)!
  expect(getComputedStyle(circle).stroke).toBe(getComputedStyle(column).fill)
  expect(getComputedStyle(circle).stroke).not.toBe('none')
 }
})
it.each(['de','en'] as const)('includes the complete visible latest-run content in its accessible name (%s)',language=>{
 const {container,doc}=overview(language)
 const row=container.querySelector('.latest-run')!
 const time=row.querySelector('time')!.textContent!
 const status=row.querySelector('.run-status')!.textContent!
 const name=new RegExp(`${doc.run.project}.*${time}.*${doc.run.agent}.*${status}`.replace(/[()[\]]/g,'\\$&'))
 expect(screen.getByRole('button',{name})).toBe(row)
})
it('uses the green accent for evidence bars, without changing criterion statuses',()=>{
 const {container}=overview()
 const bars=container.querySelectorAll('.evidence-track > span')
 expect(bars.length).toBeGreaterThan(0)
 for(const bar of bars)expect(getComputedStyle(bar).backgroundColor).toBe('rgb(50, 205, 50)')
 expect(getComputedStyle(container.querySelector('.criterion-stack [data-criterion=unmet]')!).backgroundColor).toBe('rgb(255, 0, 0)')
})
it('truncates long agent names to one line and retains the complete name in a title and text',()=>{
 const {doc}=overview()
 const label=within(screen.getByRole('figure',{name:'Criteria by agent'})).getByText(doc.run.agent)
 expect(label.getAttribute('title')).toBe(doc.run.agent)
 expect(label.textContent).toBe(doc.run.agent)
 const computed=getComputedStyle(label)
 expect(computed.whiteSpace).toBe('nowrap')
 expect(computed.textOverflow).toBe('ellipsis')
 expect(computed.overflow).toBe('hidden')
})
it.each([
 ['de','So., 11.10., 16:46'],
 ['en','Sun, 11 Oct, 16:46'],
] as const)('shows a short localized latest-run time and retains the full time with zone (%s)',(language,expected)=>{
 const {container,doc}=overview(language)
 const time=container.querySelector('.latest-run time')!
 expect(time.textContent).toBe(expected)
 expect(time.getAttribute('datetime')).toBe(doc.run.started)
 expect(time.getAttribute('title')).toMatch(/2026.*16:46:01\.809.*(?:UTC|CEST)/)
})
