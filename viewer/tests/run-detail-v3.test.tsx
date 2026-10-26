// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import App from '../src/App.tsx'
import type {RunDoc} from '../src/types.ts'
import fixture from '../fixtures/demo-run.json'

afterEach(()=>{cleanup();localStorage.clear();history.replaceState(null,'','/');vi.unstubAllGlobals()})
async function load(change?:(doc:RunDoc)=>void){
 const doc=structuredClone(fixture) as RunDoc;change?.(doc)
 history.replaceState(null,'','/?view=overview')
 vi.stubGlobal('scrollTo',()=>{})
 vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>doc})))
 render(<App/>);await screen.findByRole('heading',{name:doc.run.project})
 return {doc,main:screen.getByRole('main')}
}
it('opens a German run summary with compact chrome and retains tools in the menu',async()=>{
 const {main}=await load()
 expect(main.closest('.overview-shell')).toBeTruthy()
 expect(document.documentElement.lang).toBe('de')
 expect(screen.getByRole('button',{name:'← Übersicht'})).toBeTruthy()
 expect(screen.getByRole('img',{name:'1 von 3 Kriterien erfüllt'})).toBeTruthy()
 expect(screen.getByText('3 Behauptungen aufgezeichnet; 1 belegt, 2 ohne Zeugen. 1 von 3 Kriterien erfüllt.')).toBeTruthy()
 expect(screen.getByText('Menü').closest('details')!.open).toBe(false)
 expect(main.querySelector('.workspace-tabs,.workspace-navigation,.local-open')).toBeNull()
 expect(screen.queryByText(/Durchgefallen|Bestanden|Protokoll unverändert/)).toBeNull()
 expect(screen.getByText(/Integrity is not approval/)).toBeTruthy()
 expect(screen.getByText('Nur Hash · Signatur nicht geprüft')).toBeTruthy()
 expect(fetch).toHaveBeenCalledTimes(1)
})
it('shows one card per criterion, exact claims, results and only linked recorded evidence',async()=>{
 const {doc}=await load()
 const cards=screen.getAllByRole('article')
 expect(cards).toHaveLength(3)
 const card=within(cards[0])
 expect(card.getByRole('heading',{name:doc.criteria[0].text})).toBeTruthy()
 expect(card.getByText(doc.claims[0].text)).toBeTruthy()
 expect(card.getByText('Erfüllt')).toBeTruthy()
 fireEvent.click(card.getByText('Warum?'))
 expect(card.getByText(/Status: Erfüllt/)).toBeTruthy()
 expect(card.getByText(/Exit-Code: 0/)).toBeTruthy()
 expect(card.getByText(/finding: supported/)).toBeTruthy()
})
it('does not borrow an unrelated test or invent reasons when evidence is missing',async()=>{
 const {doc}=await load()
 const card=within(screen.getAllByRole('article')[2])
 expect(card.getByText(doc.claims[2].text)).toBeTruthy()
 fireEvent.click(card.getByText('Warum?'))
 expect(card.getByText(/Keine Begründung aufgezeichnet/)).toBeTruthy()
 expect(card.queryByText(/Exit-Code:|bestanden|Isolation/)).toBeNull()
})
it('retains unmatched claims and proposed criteria without assigning a criterion verdict to a claim',async()=>{
 await load(doc=>{
  doc.criteria.push({criterion_id:'proposed',text:'Unconfirmed criterion',status:'proposed',claimed:false,card:'outline',plain:''});doc.counts.outline++
  doc.claims.push({claim_id:'unmatched',text:'Unmapped claim',criterion_ids:['absent'],finding:'supported'})
 })
 const cards=screen.getAllByRole('article');expect(cards).toHaveLength(5)
 expect(within(cards[3]).getByText('Vorgeschlagen')).toBeTruthy()
 expect(within(cards[3]).getByText('Keine Behauptung zu diesem Kriterium aufgezeichnet.')).toBeTruthy()
 expect(within(cards[4]).getByText('Unmapped claim')).toBeTruthy()
 expect(within(cards[4]).getByText('Kein zugeordnetes Kriterium aufgezeichnet.')).toBeTruthy()
 expect(within(cards[4]).queryByText('Erfüllt')).toBeNull()
})
it('counts claim findings independently of criterion statuses in the gap visual',async()=>{
 await load()
 const comparison=screen.getByRole('region',{name:'Behauptung gegen Beweis'})
 expect(within(comparison).getByText('1 belegt · 2 ohne Zeugen')).toBeTruthy()
 expect(comparison.querySelectorAll('[data-finding=supported]')).toHaveLength(1)
 expect(comparison.querySelectorAll('[data-finding=claim_unwitnessed]')).toHaveLength(2)
 expect(within(comparison).getAllByText('Lücke')).toHaveLength(2)
})
it('orders the timeline by sequence, displays local short dates and preserves raw text as text nodes',async()=>{
 const {doc}=await load(doc=>{
  doc.events.reverse();doc.events[0].summary='<img src=x onerror=alert(1)>'
  doc.events[0].ts=new Date(2026,9,11,16,46,1,809).toISOString()
 })
 const timeline=screen.getByRole('region',{name:'Was aufgezeichnet wurde'})
 const rows=within(timeline).getAllByRole('listitem')
 expect(rows.map(row=>Number(row.getAttribute('data-seq')))).toEqual([...doc.events].sort((a,b)=>a.seq-b.seq).map(e=>e.seq))
 expect(within(timeline).getByText('<img src=x onerror=alert(1)>')).toBeTruthy()
 expect(timeline.querySelector('img')).toBeNull()
 const time=rows.at(-1)!.querySelector('time')!
 expect(time.textContent).toBe('So., 11.10., 16:46')
 expect(time.title).toMatch(/2026.*16:46:01\.809.*(?:UTC|CEST)/)
 expect(time.dateTime).toBe(doc.events[0].ts)
})
it('keeps empty records neutral and missing timestamps explicit without invented values',async()=>{
 await load(doc=>{doc.criteria=[];doc.claims=[];doc.events=[];doc.counts={green:0,yellow:0,red:0,gray:0,outline:0};doc.run.started='';doc.run.events=0})
 expect(screen.getByRole('img',{name:'Keine Kriterien aufgezeichnet'})).toBeTruthy()
 expect(screen.getByText('Keine Behauptungen aufgezeichnet.')).toBeTruthy()
 expect(screen.getByText('Keine Ereignisse aufgezeichnet.')).toBeTruthy()
 expect(screen.getByText('Startzeit nicht aufgezeichnet')).toBeTruthy()
 expect(screen.queryByText(/0\/0|NaN|undefined/)).toBeNull()
})
it('switches fixed run copy to English, retains recorded content and returns to overview without fetching',async()=>{
 const {doc}=await load()
 fireEvent.click(screen.getByText('Menü'))
 fireEvent.change(screen.getByRole('combobox',{name:'Sprache'}),{target:{value:'en'}})
 expect(screen.getByRole('region',{name:'Claim vs. evidence'})).toBeTruthy()
 expect(screen.getByRole('heading',{name:doc.run.project})).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'← Runs'}))
 expect(screen.getByRole('heading',{name:'Runs',exact:true})).toBeTruthy()
 expect(document.activeElement).toBe(screen.getByRole('heading',{level:1}))
 expect(fetch).toHaveBeenCalledTimes(1)
})
it('keeps the existing review and record inspection reachable through Details',async()=>{
 await load()
 fireEvent.click(screen.getByRole('button',{name:'Details',exact:true}))
 expect(screen.getByRole('region',{name:'Criteria and evidence'})).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Open event record'}))
 expect(screen.getByRole('heading',{name:/^Event:/})).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Zurück zum Lauf'}))
 expect(screen.getByRole('region',{name:'Behauptung gegen Beweis'})).toBeTruthy()
})
