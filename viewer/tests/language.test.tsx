// @vitest-environment jsdom
import './browser-env.ts'
import {mkdirSync,mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within,waitFor} from '@testing-library/react'
import {overviewCopy} from '../src/workspace/overview-copy.ts'
import {germanUI,referenceCopyViolations} from '../scripts/check-language.mjs'
import App from '../src/App.tsx'
import publicRun from '../fixtures/demo-run.json'
import {recordedTime,recordedDuration} from '../src/components/overview-data.ts'

afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.unstubAllEnvs();localStorage.clear()})
function expectEnglish(root:ParentNode=document.body){
 const text=document.createTreeWalker(root as Node,NodeFilter.SHOW_TEXT)
 while(text.nextNode())expect(germanUI.exec(text.currentNode.textContent??'')?.[0]??null).toBeNull()
 for(const element of root.querySelectorAll('[aria-label],[title],[placeholder],[alt]')){
  for(const attribute of ['aria-label','title','placeholder','alt'])expect(germanUI.exec(element.getAttribute(attribute)??'')?.[0]??null).toBeNull()
 }
}

it('the source check rejects German copy and attributes but allows English and export identifiers',()=>{
 mkdirSync(resolve('../.venv'),{recursive:true})
 const directory=mkdtempSync(resolve('../.venv/language-check-'))
 const script=resolve('scripts/check-language.mjs')
 try{
  mkdirSync(directory+'/components')
  for(const text of ['<p>Belege</p>','<button aria-label="Öffnen"/>','<p>Auftrag</p>','<p>Claim · ohne belegte Verbindung</p>']){
   writeFileSync(directory+'/components/copy.tsx',text)
   expect(spawnSync(process.execPath,[script,directory]).status).toBe(1)
  }
  writeFileSync(directory+'/components/copy.tsx','<p title="Open record">Hash only · signature not checked; claim_unwitnessed</p>')
  expect(spawnSync(process.execPath,[script,directory]).status).toBe(0)
 }finally{rmSync(directory,{recursive:true,force:true})}
})

for(const mobile of [false,true])for(const lens of ['client','developer']){
 it(`all four ${mobile?'mobile':'desktop'} views and evidence sheets are English in the ${lens} lens`,async()=>{
  vi.stubEnv('TZ','UTC')
  vi.stubGlobal('scrollTo',()=>{})
  vi.stubGlobal('matchMedia',(query:string)=>({matches:query.includes('min-width')?!mobile:mobile,addEventListener(){},removeEventListener(){}}))
  vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(publicRun)})))
  localStorage.setItem('tl-lens',lens)
  history.replaceState(null,'','/?view=overview')
  render(<App/>);await screen.findByRole('main')
  const menu=screen.getByText('Menü');if(!menu.closest('details')!.open)fireEvent.click(menu)
  fireEvent.change(screen.getByRole('combobox',{name:'Sprache'}),{target:{value:'en'}})
  fireEvent.click(screen.getByRole('button',{name:'Details',exact:true}))
  const navigate=(name:string)=>{
   if(mobile)fireEvent.click(screen.getByRole('button',{name:'Navigation',exact:true}))
   fireEvent.click(within(screen.getByRole('navigation',{name:'Viewer navigation'})).getByRole('button',{name,exact:true}))
   if(name==='Overview'&&screen.queryByRole('button',{name:'Details',exact:true}))fireEvent.click(screen.getByRole('button',{name:'Details',exact:true}))
  }
  const close=async()=>{if(mobile){fireEvent.keyDown(document.activeElement!,{key:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())}else fireEvent.click(screen.getByRole('button',{name:'Back to criterion'}))}
  const inspectRecord=async(trigger:HTMLElement)=>{
   fireEvent.click(trigger)
   const detail=mobile?screen.getByRole('dialog',{name:'Context inspector'}):screen.getByRole('complementary',{name:'Context inspector'})
   expectEnglish(detail)
   for(const tab of within(detail).queryAllByRole('tab')){fireEvent.mouseDown(tab,{button:0,ctrlKey:false});expectEnglish(detail)}
   await close()
  }
  for(const name of ['Overview','Claimed vs proven','Timeline','Agent story']){
   navigate(name);expectEnglish()
   if(mobile)fireEvent.click(screen.getByRole('button',{name:'Navigation',exact:true}))
   await inspectRecord(screen.getByRole('button',{name:'Run details',exact:true}))
  }
  navigate('Overview')
  fireEvent.click(screen.getByRole('button',{name:name=>name.startsWith('Evidence:')&&name.includes(publicRun.criteria[0].text)}))
  await inspectRecord(screen.getByRole('button',{name:'Open criterion record'}))
  fireEvent.click(screen.getByText('Recorded links and code diff'))
  fireEvent.click(screen.getByText('All records and links as a list'))
  const records=within(screen.getByRole('list',{name:'Graph records'}))
  await inspectRecord(records.getByRole('button',{name:`Claim: ${publicRun.claims[1].text}`}))
  await inspectRecord(records.getByRole('button',{name:`File: ${publicRun.artifacts[0].path}`}))
 },15_000)
}

it('formats local dates in English with a 24-hour clock and a zone',()=>{
 vi.stubEnv('TZ','UTC')
 expect(recordedTime('2026-10-11T14:46:01.809Z')).toBe('11/10/2026, 14:46:01.809 UTC')
 expect(recordedDuration(publicRun.run.started,publicRun.run.finished)).toBe('20.846 s')
})

it('the document uses English language metadata',()=>{
 const html=readFileSync('index.html','utf8')
 expect(new DOMParser().parseFromString(html,'text/html').documentElement.lang).toBe('en')
 expect(new DOMParser().parseFromString(html,'text/html').title).toBe('TruthLens')
})

 it('permits only the fixed overview translation table and keeps complete English copy',()=>{
  expect(Object.keys(overviewCopy.de).sort()).toEqual(Object.keys(overviewCopy.en).sort())
  for(const value of Object.values(overviewCopy.en))expect(germanUI.test(value)).toBe(false)
  expect(spawnSync(process.execPath,[resolve('scripts/check-language.mjs')]).status).toBe(0)
 })

it('checks reference copy outside its dictionary',()=>{
 const source=readFileSync('src/reference/copy.ts','utf8')
 expect(referenceCopyViolations(source)).toEqual([])
 expect(referenceCopyViolations(source+'\nconst extra = "Öffnen"\n').length).toBeGreaterThan(0)
})
