// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within,waitFor} from '@testing-library/react'
import {validateRunDoc} from '../src/validateRunDoc.ts'
import App from '../src/App.tsx'
import type {RunDoc} from '../src/types.ts'
import fixture from '../fixtures/demo-run.json'

afterEach(()=>{cleanup();localStorage.clear();history.replaceState(null,'','/');vi.unstubAllGlobals()})
async function load(change?:(doc:RunDoc)=>void){
 const doc=structuredClone(fixture) as RunDoc;change?.(doc);expect(validateRunDoc(doc)).toBe(true)
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
 expect(screen.getAllByText(/Integrity is not approval/).length).toBeGreaterThan(0)
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
 expect(card.getAllByText(/Befund: supported/).length).toBeGreaterThan(0)
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
  doc.criteria.push({criterion_id:'proposed',text:'Unconfirmed criterion',status:'proposed',evidence:[],claimed:false,card:'outline',plain:''});doc.counts.outline++
  doc.claims.push({claim_id:'unmatched',text:'Unmapped claim',criterion_ids:['absent'],finding:'supported'})
 })
 const cards=screen.getAllByRole('article');expect(cards).toHaveLength(5)
 expect(within(cards[3]).getByText('Vorgeschlagen')).toBeTruthy()
 expect(within(cards[3]).getByText('Keine Behauptung zu diesem Kriterium aufgezeichnet.')).toBeTruthy()
 expect(within(cards[4]).getByRole('heading',{name:'Unmapped claim'})).toBeTruthy()
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
 expect(within(screen.getByRole('region',{name:'Behauptung gegen Beweis'})).getByText('Keine Behauptungen aufgezeichnet.')).toBeTruthy()
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

it('moves focus to the heading after Details and back to the summary, with one h1',async()=>{
 await load()
 const details=screen.getByRole('button',{name:'Details',exact:true});details.focus();fireEvent.click(details)
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('heading',{level:1})))
 fireEvent.click(screen.getByRole('button',{name:'Zurück zum Lauf'}))
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('heading',{level:1})))
 expect(screen.getAllByRole('heading',{level:1})).toHaveLength(1)
})

it('returns to the summary when navigating back from another evidence view',async()=>{
 await load()
 fireEvent.click(screen.getByRole('button',{name:'Details',exact:true}))
 fireEvent.click(screen.getByRole('button',{name:'Timeline',exact:true}))
 fireEvent.click(screen.getByRole('button',{name:'Review criteria',exact:true}))
 expect(screen.getByRole('region',{name:'Behauptung gegen Beweis'})).toBeTruthy()
})

it('preserves multiple claims and missing evidence references without borrowing unrelated results',async()=>{
 await load(doc=>{
  doc.claims.push({claim_id:'second',text:'<svg onload=alert(1)>',criterion_ids:['c3','missing'],finding:'claim_unwitnessed'})
  doc.criteria[2].evidence=['missing-event']
 })
 const cards=screen.getAllByRole('article');expect(cards).toHaveLength(3)
 const card=within(cards[2])
 expect(card.getByText('<svg onload=alert(1)>')).toBeTruthy()
 // Static status SVGs are allowed; recorded claim markup must stay text.
 expect(cards[2].querySelector('.claim-words svg')).toBeNull()
 expect(cards[2].querySelector('[onload]')).toBeNull()
 expect(card.getByText('Referenzierte Kriterien fehlen: 1.')).toBeTruthy()
 fireEvent.click(card.getByText('Warum?'))
 expect(card.getByText('Referenzierte Beleg-Ereignisse fehlen: 1.')).toBeTruthy()
 expect(card.getByText('Keine Begründung aufgezeichnet.')).toBeTruthy()
 expect(card.queryByText(/Exit-Code:/)).toBeNull()
})
it('shows recorded test fields without inventing an isolation diagnosis or changing criterion status',async()=>{
 await load(doc=>{
  const report=doc.events[0];report.type='test.reported';report.payload={exit_code:125,passed:0,failed:0,skipped:2}
  doc.criteria[2].evidence=[report.id]
 })
 const card=within(screen.getAllByRole('article')[2])
 expect(card.getByText('Nicht prüfbar')).toBeTruthy()
 fireEvent.click(card.getByText('Warum?'))
 expect(card.getByText(/Exit-Code: 125/)).toBeTruthy()
 expect(card.getByText(/bestanden: 0/)).toBeTruthy()
 expect(card.getByText(/übersprungen: 2/)).toBeTruthy()
 expect(card.queryByText(/Isolation|erfolgreich/)).toBeNull()
})
