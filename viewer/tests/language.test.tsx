// @vitest-environment jsdom
import './browser-env.ts'
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within,waitFor} from '@testing-library/react'
import {germanUI} from '../scripts/check-language.mjs'
import App from '../src/App.tsx'
import publicRun from '../public/run.json'
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
 const directory=mkdtempSync(resolve('../.venv/language-check-'))
 const script=resolve('scripts/check-language.mjs')
 try{
  for(const text of ['<p>Belege</p>','<button aria-label="Öffnen"/>','<p>Auftrag</p>','<p>Claim · ohne belegte Verbindung</p>']){
   writeFileSync(directory+'/copy.tsx',text)
   expect(spawnSync(process.execPath,[script,directory]).status).toBe(1)
  }
  writeFileSync(directory+'/copy.tsx','<p title="Open record">Hash only · signature not checked; claim_unwitnessed</p>')
  expect(spawnSync(process.execPath,[script,directory]).status).toBe(0)
 }finally{rmSync(directory,{recursive:true,force:true})}
})

for(const mobile of [false,true])for(const lens of ['client','developer']){
 it(`all four ${mobile?'mobile':'desktop'} views and evidence sheets are English in the ${lens} lens`,async()=>{
  vi.stubEnv('TZ','UTC')
  vi.stubGlobal('scrollTo',()=>{})
  vi.stubGlobal('matchMedia',()=>({matches:mobile,addEventListener(){},removeEventListener(){}}))
  vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(publicRun)})))
  localStorage.setItem('tl-lens',lens)
  render(<App/>);await screen.findByRole('main')
  const navigation=screen.getByRole('navigation',{name:'Viewer navigation'})
  const close=async()=>{fireEvent.keyDown(document.activeElement!,{key:'Escape'});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())}
  const inspectSheet=async(trigger:HTMLElement)=>{
   fireEvent.click(trigger)
   const dialog=screen.getByRole('dialog');expectEnglish(dialog)
   for(const tab of within(dialog).getAllByRole('tab')){
    fireEvent.mouseDown(tab,{button:0,ctrlKey:false});expectEnglish(dialog)
   }
   await close()
  }
  for(const button of within(navigation).getAllByRole('button')){
   fireEvent.click(button);expectEnglish()
   await inspectSheet(mobile?document.querySelector<HTMLElement>('.compact-trust')!:within(screen.getByRole('complementary',{name:'Evidence drawer'})).getAllByRole('button')[0])
  }
  fireEvent.click(within(navigation).getAllByRole('button')[0])
  await inspectSheet(screen.getByRole('button',{name:`Open run: ${publicRun.run.project}`}))
  await inspectSheet(screen.getByRole('button',{name:`Evidence: ${publicRun.criteria[0].text}`}))
  fireEvent.click(screen.getByText('All records and links as a list'))
  const records=within(screen.getByRole('list',{name:'Graph records'}))
  await inspectSheet(records.getByRole('button',{name:`Claim: ${publicRun.claims[1].text}`}))
  await inspectSheet(records.getByRole('button',{name:`File: ${publicRun.artifacts[0].path}`}))
 })
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
