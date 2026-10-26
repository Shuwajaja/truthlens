// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,expect,it} from 'vitest'
import {cleanup,render,screen,within} from '@testing-library/react'
import {RunDetail} from '../src/workspace/RunDetail.tsx'
import {OverviewLanguageProvider} from '../src/workspace/OverviewLanguageProvider.tsx'
import type {RunDoc} from '../src/types.ts'
import fixture from '../fixtures/demo-run.json'
import {readFileSync} from 'node:fs'

const detailStyles=readFileSync('src/workspace/run-detail.css','utf8')

afterEach(cleanup)
function show(change?:(doc:RunDoc)=>void){
 const doc=structuredClone(fixture) as RunDoc;change?.(doc)
 render(<OverviewLanguageProvider><RunDetail doc={doc} onRuns={()=>{}}/></OverviewLanguageProvider>)
 return doc
}

it('puts each recorded finding beside an SVG status icon and the native Why control',()=>{
 show()
 const cards=screen.getAllByRole('article')
 for(const [index,tone,label] of [[0,'ok','belegt'],[1,'fail','ohne Zeugen'],[2,'fail','ohne Zeugen']] as const){
  const summary=cards[index].querySelector('.claim-why > summary')!
  expect(within(summary as HTMLElement).getByText(label)).toBeTruthy()
  expect(within(summary as HTMLElement).getByText('Warum?')).toBeTruthy()
  expect(summary.querySelector(`.result-status[data-tone=${tone}] svg[aria-hidden=true]`)).toBeTruthy()
 }
 // The unverified criterion does not erase its unwitnessed claim.
 expect(within(cards[2]).getByText('Nicht prüfbar')).toBeTruthy()
})

it('keeps conflicting findings visible rather than promoting a whole card to supported',()=>{
 show(doc=>doc.claims.push({claim_id:'second',text:'Separate unwitnessed claim',criterion_ids:['c1'],finding:'claim_unwitnessed'}))
 const summary=screen.getAllByRole('article')[0].querySelector('.claim-why > summary')!
 expect(summary.querySelectorAll('.result-status[data-tone=ok]')).toHaveLength(1)
 expect(summary.querySelectorAll('.result-status[data-tone=fail]')).toHaveLength(1)
 expect(summary.textContent).toContain('belegt')
 expect(summary.textContent).toContain('ohne Zeugen')
})

it('renders criterion-only not-checkable and proposed states as neutral questions',()=>{
 show(doc=>{doc.claims=[];doc.criteria[0].status='proposed'})
 const cards=screen.getAllByRole('article')
 for(const [index,label] of [[0,'Vorgeschlagen'],[2,'Nicht prüfbar']] as const){
  const summary=cards[index].querySelector('.claim-why > summary')!
  expect(summary.querySelector('.result-status[data-tone=open] svg[data-symbol=question]')).toBeTruthy()
  expect(summary.textContent).toContain(label)
 }
})

it('prefixes actual comparison findings and criterion states with distinct status shapes',()=>{
 show()
 const comparison=screen.getByRole('region',{name:'Behauptung gegen Beweis'})
 const supported=comparison.querySelector('[data-finding=supported]')!
 expect(supported.querySelector('.gap-evidence .result-status[data-tone=ok] svg[data-symbol=check]')).toBeTruthy()
 const gaps=comparison.querySelectorAll('[data-finding=claim_unwitnessed]')
 for(const gap of gaps){
  expect(gap.querySelector('.gap-evidence .result-status[data-tone=fail] svg[data-symbol=cross]')).toBeTruthy()
  expect(gap.querySelector('.gap-connector')?.textContent).toBe('Lücke')
  expect(gap.textContent).not.toMatch(/Kein Beweis gefunden|Keine Änderung an Testdateien/)
 }
 expect(gaps[1].querySelector('.criterion-result[data-tone=open] svg[data-symbol=question]')).toBeTruthy()
})

it.each([
 ['human','criteria.confirmed',{},'human'],
 ['human','test.reported',{passed:1,failed:0},'human'],
 ['wrapper','test.reported',{passed:3,failed:0,exit_code:0},'ok'],
 ['system','test.reported',{passed:3,failed:0},'ok'],
 ['wrapper','test.reported',{passed:3,failed:1},'fail'],
 ['wrapper','test.reported',{passed:0,failed:0,skipped:2,exit_code:125},'open'],
 ['wrapper','test.reported',{passed:3,failed:0,exit_code:125},'open'],
 ['wrapper','test.reported',{passed:3,failed:0,exit_code:124},'open'],
 ['agent','test.reported',{passed:3,failed:0},'open'],
 ['agent','agent.claim',{result:'passed'},'open'],
 ['wrapper','evidence.attached',{exit_code:0},'open'],
 ['wrapper','evidence.attached',{exit_code:1},'fail'],
 ['system','run.finished',{status:'failed'},'fail'],
 ['system','run.finished',{status:'ok',exit_code:0},'open'],
 ['system','action.blocked',{},'fail'],
 ['system','artifact.recorded',{},'open'],
] as const)('assigns timeline tone from recorded %s / %s / %j only', (kind,type,payload,tone)=>{
 show(doc=>{doc.events=[{...doc.events[0],actor:{kind,id:'recorded actor'},type,payload}]})
 const row=within(screen.getByRole('region',{name:'Was aufgezeichnet wurde'})).getByRole('listitem')
 expect(row.querySelector('.timeline-marker')?.getAttribute('data-tone')).toBe(tone)
 expect(row.textContent).toContain(`${type} · ${kind} · recorded actor`)
})

it('uses a German finding label while preserving the recorded finding value',()=>{
 show()
 const details=screen.getAllByRole('article')[0].querySelector('.claim-reason')!
 expect(details.textContent).toContain('Befund: supported')
 expect(details.textContent).not.toContain('finding:')
})

it('retains semantic status colours through the card summary CSS cascade',()=>{
 const style=document.createElement('style');style.textContent=detailStyles;document.head.append(style)
 try{
  show()
  const cards=screen.getAllByRole('article')
  expect(getComputedStyle(cards[0].querySelector('.claim-results .result-status')!).color).toBe('var(--ok)')
  expect(getComputedStyle(cards[1].querySelector('.claim-results .result-status')!).color).toBe('var(--fail)')
 }finally{style.remove()}
})
