// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,render,screen,within} from '@testing-library/react'
import {RunsView} from '../src/workspace/RunsView.tsx'
import {RunDetail} from '../src/workspace/RunDetail.tsx'
import {WorkspaceShell} from '../src/workspace/WorkspaceShell.tsx'
import {OverviewLocale} from '../src/workspace/overview-language.ts'
import type {RunDoc} from '../src/types.ts'
import fixture from '../fixtures/demo-run.json'

afterEach(cleanup)
const doc=(id='a',started='2026-10-25T00:30:00Z')=>{
 const value=structuredClone(fixture) as RunDoc
 value.run.run_id=id;value.run.started=started
 return value
}
const source=(docs:RunDoc[])=>({sourceId:'loaded',kind:'development-fixture' as const,label:'Synthetic test documents',runs:new Map(docs.map(d=>[d.run.run_id,d]))})
function show(docs:RunDoc[],language:'de'|'en'='de'){
 return render(<OverviewLocale.Provider value={{language,setLanguage:vi.fn()}}><RunsView sources={[source(docs)]} onOpenRun={vi.fn()}/></OverviewLocale.Provider>)
}
it.each([
 [true,'hmac','Protokoll unverändert · HMAC im Export geprüft','signature-checked'],
 [false,'hmac','Signatur nicht geprüft','open'],
 [false,'hash-only','Nur Hash · Signatur nicht geprüft','hash-only'],
 [true,'hash-only','Nur Hash · Signatur nicht geprüft','hash-only'],
 [false,'failed','Integritätsprüfung fehlgeschlagen','failed'],
] as const)('uses the exact integrity guard for the score and run detail (%s, %s)',(verified,integrity,label,variant)=>{
 const value=doc();value.verified=verified;value.integrity=integrity
 // Inconsistent/failed pairs are defensive component inputs, not accepted loader exports.
 const {container,unmount}=show([value])
 const seal=container.querySelector('.overview-score .overview-seal')!
 expect(seal?.textContent).toBe(label)
 expect(seal?.getAttribute('data-integrity')).toBe(variant)
 expect(screen.getByText('Prüfergebnis beim Export; diese Ansicht prüft keine Signaturen.')).toBeTruthy()
 expect(screen.getByText(/Integrity is not approval/)).toBeTruthy()
 unmount()
 render(<OverviewLocale.Provider value={{language:'de',setLanguage:vi.fn()}}><RunDetail doc={value} onRuns={vi.fn()}/></OverviewLocale.Provider>)
 expect(screen.getByText(label).closest('[data-integrity]')?.getAttribute('data-integrity')).toBe(variant)
})
it('counts mixed integrity across all unique accepted runs, including runs beyond the latest fourteen',()=>{
 const docs=Array.from({length:16},(_,i)=>doc(String(i)))
 docs[0].verified=true;docs[0].integrity='hmac'
 const {container}=show([...docs,structuredClone(docs[0])])
 const seals=container.querySelector('.overview-score .overview-integrity')!
 expect(seals?.textContent).toContain('1 · Protokoll unverändert · HMAC im Export geprüft')
 expect(seals?.textContent).toContain('15 · Nur Hash · Signatur nicht geprüft')
 expect(container.querySelectorAll('.latest-run')).toHaveLength(14)
 expect(seals?.textContent).not.toMatch(/alle|all /i)
 const details=container.querySelector('.latest-details')!
 expect(within(details).getAllByText('Protokoll unverändert · HMAC im Export geprüft')).toHaveLength(1)
})
it('never infers Phase F verdicts from all-met criteria, supported claims, exit zero or HMAC',()=>{
 const value=doc();value.verified=true;value.integrity='hmac';value.run.exit_code=0
 value.criteria=value.criteria.map(c=>({...c,status:'met'}))
 value.claims=value.claims.map(c=>({...c,finding:'supported'}))
 const {container}=show([value])
 expect(screen.getByText('3 von 3 Kriterien erfüllt')).toBeTruthy()
 expect(screen.getByText('Kriterien: TRUE')).toBeTruthy()
 expect(container.textContent).not.toMatch(/Läufe bestanden|Bestanden-Quote|checks_passed|checks_failed/)
 const audit=render(<OverviewLocale.Provider value={{language:'de',setLanguage:vi.fn()}}><RunDetail doc={value} onRuns={vi.fn()}/></OverviewLocale.Provider>)
 expect(audit.getByRole('region',{name:'Geschützter Audit'}).textContent).toMatch(/UNKNOWN/)
 expect(audit.container.textContent).not.toMatch(/checks_passed/)
})
it('keeps a hash-only all-met run on UNKNOWN',()=>{
 const value=doc();value.criteria=value.criteria.map(c=>({...c,status:'met'}))
 show([value])
 expect(screen.getByText('3 von 3 Kriterien erfüllt')).toBeTruthy()
 expect(screen.getByText('Kriterien: UNKNOWN')).toBeTruthy()
 expect(screen.queryByText('Kriterien: TRUE')).toBeNull()
})
it('does not claim hash checks for an empty workspace',()=>{
 const {container}=show([])
 expect(screen.getByText('Kein Integritätsprüfergebnis geladen.')).toBeTruthy()
 expect(container.querySelector('[data-integrity]')).toBeNull()
 expect(screen.queryByText('Nur Hash · Signatur nicht geprüft')).toBeNull()
})
function header(docs:RunDoc[],language:'de'|'en'='de'){
 return render(<OverviewLocale.Provider value={{language,setLanguage:vi.fn()}}><WorkspaceShell sources={[source(docs)]} overview navigation={null} inspector={null} lens="client" mobile={false} wide inspectorOpen={false} onInspectorOpenChange={vi.fn()} ref={null}><div/></WorkspaceShell></OverviewLocale.Provider>)
}
it.each([
 ['2026-07-01T22:30:00Z','02.07.','00:30','CEST'],
 ['2026-10-25T00:30:00Z','25.10.','02:30','CEST'],
 ['2026-10-25T01:30:00Z','25.10.','02:30','CET'],
] as const)('shows the latest loaded start in Berlin independently of process TZ (%s)',(started,day,time,zone)=>{
 const {container}=header([doc('older','2025-01-01T00:00:00Z'),doc('latest',started),doc('undated','')])
 const stand=within(screen.getByRole('banner')).getByText(/Stand/)
 const timestamp=stand.querySelector('time')!
 expect(timestamp?.getAttribute('datetime')).toBe(started)
 expect(timestamp?.textContent).toContain(day);expect(timestamp?.textContent).toContain(time)
 expect(timestamp?.title).toContain(zone)
 expect(stand.textContent).toContain('Europe/Berlin')
 expect(stand.getAttribute('title')).toBe('Neuester geladener Laufstart')
 expect(container.textContent).not.toMatch(/Beispiel|example/)
})
it('uses the first loaded snapshot for duplicate run IDs and excludes malformed entries from Stand',()=>{
 const a=doc(),duplicate=doc('a','2030-01-01T00:00:00Z'),bad=doc('bad','2031-01-01T00:00:00Z')
 bad.criteria[0].status='unknown'
 const sources=[source([a,bad]),{...source([duplicate]),sourceId:'duplicate'}]
 render(<WorkspaceShell sources={sources} overview navigation={null} inspector={null} lens="client" mobile={false} wide inspectorOpen={false} onInspectorOpenChange={vi.fn()} ref={null}><div/></WorkspaceShell>)
 expect(screen.getByRole('banner').querySelector('time')?.dateTime).toBe(a.run.started)
})
it.each([[],[doc('undated','')],[doc('unzoned','2026-10-25T12:00:00')]].map(docs=>({docs})))('shows unavailable time without inventing a date',({docs})=>{
 header(docs)
 expect(within(screen.getByRole('banner')).getByText('Stand: Zeitpunkt nicht aufgezeichnet')).toBeTruthy()
 expect(screen.getByRole('banner').querySelector('time')).toBeNull()
})
it('translates Stand while preserving the fixed Berlin zone',()=>{
 header([doc()],'en')
 expect(within(screen.getByRole('banner')).getByText(/As of/).textContent).toContain('Europe/Berlin')
})
