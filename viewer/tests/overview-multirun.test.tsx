// @vitest-environment jsdom
import './browser-env.ts'
import {readFileSync} from 'node:fs'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import {overviewMultirunFixture} from '../fixtures/overview-multirun.fixture.mjs'
import {aggregateRuns} from '../src/workspace/cross-run-data.ts'
import {RunsView} from '../src/workspace/RunsView.tsx'
import {OverviewLocale} from '../src/workspace/overview-language.ts'
import {validateRunDoc} from '../src/validateRunDoc.ts'
import type {RunDoc} from '../src/types.ts'

afterEach(cleanup)
function show(docs=overviewMultirunFixture() as RunDoc[],language:'de'|'en'='de'){
 const onOpenRun=vi.fn()
 const source={sourceId:'multi-fixture',kind:'development-fixture' as const,label:'Synthetic development fixtures',runs:new Map(docs.map(doc=>[doc.run.run_id,doc]))}
 return {...render(<OverviewLocale.Provider value={{language,setLanguage:()=>{}}}><RunsView sources={[source]} onOpenRun={onOpenRun}/></OverviewLocale.Provider>),onOpenRun}
}
it('aggregates fourteen synthetic runs and three agents with exact counts, stable order and no verdict',()=>{
 const docs=overviewMultirunFixture(),before=JSON.stringify(docs)
 for(const doc of docs)expect(validateRunDoc(doc)).toBe(true)
 const entries=docs.map(doc=>({sourceId:'multi-fixture',doc}))
 const data=aggregateRuns([...entries,{sourceId:'duplicate',doc:docs[13]}])
 expect(data).toMatchObject({totalRuns:14,criteria:{met:83,unmet:3,unverified:8,proposed:0},excluded:0,duplicates:1,omitted:0})
 expect(data.agents).toEqual([
  {agent:'Fixture Agent A',runs:7,criteria:{met:52,unmet:1,unverified:1,proposed:0}},
  {agent:'Fixture Agent B',runs:4,criteria:{met:21,unmet:0,unverified:3,proposed:0}},
  {agent:'FixtureAgentWithAnIntentionallyLongUnbrokenNameForEllipsisReview',runs:3,criteria:{met:10,unmet:2,unverified:4,proposed:0}},
 ])
 expect(data.evidence).toEqual([{kind:'Test reports',count:86},{kind:'Commands',count:14},{kind:'File changes',count:14},{kind:'Test-file changes',count:14}])
 expect(data.latest.map(row=>row.runId)).toEqual(Array.from({length:14},(_,i)=>`fixture-overview-${String(14-i).padStart(2,'0')}`))
 expect(data.latest.every(row=>!('status' in row))).toBe(true)
 expect(JSON.stringify(docs)).toBe(before)
})
it('renders the multi-run line, stacked columns, agent counts, criterion pills and existing run identities',()=>{
 const {container,onOpenRun}=show()
 expect(screen.getByText('83 von 94 Kriterien erfüllt')).toBeTruthy()
 const trend=screen.getByRole('figure',{name:'Erfüllte Kriterien im Verlauf'})
 expect(trend.querySelector('polyline')?.getAttribute('points')?.split(' ')).toHaveLength(14)
 expect(trend.querySelectorAll('circle')).toHaveLength(14)
 const columns=screen.getByRole('figure',{name:'Kriterien pro Lauf'})
 expect(columns.querySelectorAll('svg > g')).toHaveLength(14)
 for(const state of ['met','unmet','unverified'])expect(columns.querySelector(`rect[data-criterion=${state}]`)).toBeTruthy()
 const agents=screen.getByRole('figure',{name:'Agenten im Vergleich'})
 for(const count of ['52/54','21/24','10/16'])expect(within(agents).getByText(count)).toBeTruthy()
 const rows=container.querySelectorAll<HTMLButtonElement>('.latest-run')
 expect(rows).toHaveLength(14)
 for(const text of ['Kriterien: erfüllt','Kriterien: nicht erfüllt','Kriterien: nicht prüfbar'])expect(container.textContent).toContain(text)
 fireEvent.click(rows[0])
 expect(onOpenRun).toHaveBeenCalledWith({kind:'run',sourceId:'multi-fixture',runId:'fixture-overview-14'})
 expect(container.textContent).not.toMatch(/Läufe bestanden|runs passed|Signatur geprüft/)
})
it.each(['de','en'] as const)('shows a calm single-run explanation and count summary instead of isolated chart marks (%s)',language=>{
 const {container}=show((overviewMultirunFixture() as RunDoc[]).slice(-1),language)
 const trend=screen.getByRole('figure',{name:language==='de'?'Erfüllte Kriterien im Verlauf':'Criteria met over recent runs'})
 expect(within(trend).queryByRole('img')).toBeNull()
 expect(trend.textContent).toContain(language==='de'?'Ein Verlauf braucht mindestens 2 geladene Läufe mit Datum und Kriterien.':'A trend needs at least 2 loaded runs with dates and criteria.')
 const criteria=screen.getByRole('figure',{name:language==='de'?'Kriterien pro Lauf':'Criteria per run'})
 expect(within(criteria).queryByRole('img')).toBeNull()
 expect(criteria.textContent).toContain(language==='de'?'1 geladener Lauf.':'1 loaded run.')
 expect(within(criteria).getAllByText(language==='de'?'7 erfüllt':'7 met').length).toBeGreaterThan(0)
 expect(container.querySelector('.overview-score .overview-summary')?.textContent).toBe(language==='de'?'1 nicht erfüllt · 1 nicht prüfbar · 0 vorgeschlagen.':'1 unmet · 1 not checkable · 0 proposed.')
})
it('does not draw a trend when only one of many runs has dated criteria',()=>{
 const docs=overviewMultirunFixture() as RunDoc[]
 for(const doc of docs.slice(1))doc.run.started=''
 show(docs)
 const trend=screen.getByRole('figure',{name:'Erfüllte Kriterien im Verlauf'})
 expect(within(trend).queryByRole('img')).toBeNull()
 expect(trend.textContent).toContain('mindestens 2')
})
it('replaces the single narrow column with visible status counts and a single-run explanation',()=>{
 show((overviewMultirunFixture() as RunDoc[]).slice(-1))
 const chart=screen.getByRole('figure',{name:'Kriterien pro Lauf'})
 expect(within(chart).queryByRole('img')).toBeNull()
 expect(within(chart).getByText('1 geladener Lauf. Ein Vergleich ist ab 2 geladenen Läufen möglich.')).toBeTruthy()
 for(const text of ['7 erfüllt','1 nicht erfüllt','1 nicht prüfbar','0 vorgeschlagen'])expect(within(chart).getAllByText(text).length).toBeGreaterThan(0)
})
it('summarizes the remaining criterion counts calmly under the ring without a run verdict',()=>{
 const {container}=show()
 expect(container.querySelector('.overview-score .overview-summary')?.textContent).toBe('3 nicht erfüllt · 8 nicht prüfbar · 0 vorgeschlagen.')
})
it('keeps full long agent names accessible while ellipsizing both chart and run-row labels',()=>{
 const style=document.createElement('style');style.textContent=readFileSync('src/workspace/runs-overview.css','utf8');document.head.append(style)
 try{
  const docs=overviewMultirunFixture() as RunDoc[],{container}=show(docs),agent=docs[3].run.agent
  const chartLabel=within(screen.getByRole('figure',{name:'Agenten im Vergleich'})).getByText(agent)
  const rowLabel=container.querySelector('.latest-run-agent [title]')!
  expect(rowLabel).toBeTruthy()
  for(const label of [chartLabel,rowLabel]){
   expect(label.getAttribute('title')).toBe(label.textContent)
   const css=getComputedStyle(label)
   expect(css.whiteSpace).toBe('nowrap');expect(css.textOverflow).toBe('ellipsis');expect(css.overflow).toBe('hidden')
  }
  expect(screen.getAllByRole('button',{name:name=>name.includes(agent)})).toHaveLength(3)
 }finally{style.remove()}
})
