// Manual/release specs: Node's test runner + the repository's pinned Playwright.
// Run after npm run build. API responses below are synthetic UI-boundary fixtures.
import assert from 'node:assert/strict'
import {after,before,test} from 'node:test'
import {execFileSync} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {preview} from 'vite'
import {chromium} from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import {reviewIncomplete} from '../scripts/a11y-review.mjs'

const fixture=JSON.parse(await readFile(new URL('../fixtures/demo-run.json',import.meta.url),'utf8'))
const workspace='a'.repeat(64),output=process.env.CATALOG_OUTPUT??'.screenshots/phase-c'
const runs=Array.from({length:42},(_,index)=>({run_id:`catalog_run_${index}`,source_id:(index+1).toString(16).padStart(64,'0'),registration_id:`registration_${index}`,ledger_last_hash:fixture.run.ledger_last_hash,capture_closed_at:'2026-10-23T00:00:00.000Z'}))
const doc=item=>({source_id:item.source_id,document:{...fixture,run:{...fixture.run,run_id:item.run_id,project:`Catalog run ${item.run_id}`}}})
const reports=[],errors=[]
let server,browser,origin,testedCommit,dirty
before(async()=>{
 testedCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
 dirty=execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
 await mkdir(output,{recursive:true})
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}})
 origin=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE})
})
after(async()=>{
 await browser?.close();await server?.close()
 await writeFile(`${output}/review.json`,JSON.stringify({testedCommit,dirty,viewports:[[1440,900],[390,844]],timezone:process.env.TZ??'host default',scope:'Production build with synthetic same-origin API responses; no live private run, SSH or OS isolation claim.',reports,errors},null,2)+'\n')
})
async function pageFor(t,{width=1440,height=900,theme='petrol-porcelain',storageFailure=false,load}={}){
 const context=await browser.newContext({viewport:{width,height},timezoneId:process.env.TZ??'UTC',reducedMotion:'reduce'})
 t.after(()=>context.close())
 await context.addInitScript(({theme,storageFailure})=>{
  if(window!==window.top)return
  localStorage.setItem('truthlens.theme',theme)
  if(storageFailure)Storage.prototype.setItem=function(){throw Error('Storage unavailable')}
 },{theme,storageFailure})
 const page=await context.newPage(),requests=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/v1/**',async route=>{
  const request=route.request(),url=new URL(request.url());requests.push(url.pathname+url.search)
  assert.equal(request.method(),'GET')
  let body
  if(url.pathname==='/v1/health')body={source_id:workspace,service:'available'}
  else if(url.pathname==='/v1/runs')body={source_id:workspace,runs,next_offset:null}
  else{
   const run=runs.find(item=>url.pathname===`/v1/runs/${item.run_id}/document`)
   assert(run,'only registered fixture documents requested')
   if(load)await load(run)
   body=doc(run)
  }
  await route.fulfill({json:body})
 })
 await page.goto(origin+'/?filter=kept#anchor')
 await page.getByRole('heading',{name:'Not connected',exact:true}).waitFor()
 assert.deepEqual(requests,[],'no source request before Connect')
 await page.getByRole('button',{name:'Connect',exact:true}).click()
 await page.getByRole('heading',{name:'Runs',exact:true}).waitFor()
 return {page,requests}
}
const tabs=page=>page.getByRole('region',{name:'Workspace tabs'})
async function open(page,index){await page.getByRole('button',{name:`Open run ${runs[index].run_id}`,exact:true}).click()}
async function loaded(page,index){await page.getByRole('heading',{name:`Catalog run ${runs[index].run_id}`,exact:true}).waitFor()}
async function navigate(page,name,mobile=false){
 if(mobile)await page.getByRole('button',{name:'Navigation',exact:true}).click()
 await page.getByRole('navigation',{name:'Viewer navigation'}).getByRole('button',{name,exact:true}).click()
 if(mobile)await page.getByRole('dialog').waitFor({state:'hidden'})
}
async function scan(page,name){
 await page.evaluate(()=>document.fonts.ready)
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow')
 const result=await new AxeBuilder({page}).analyze(),manual=await reviewIncomplete(page,result)
 reports.push({name,violations:result.violations,incomplete:result.incomplete,manual})
 await page.screenshot({path:`${output}/${name}.png`})
 assert.equal(result.violations.filter(item=>['serious','critical'].includes(item.impact)).length,0,'no serious/critical axe violations')
 assert(!manual.some(item=>item.outcome==='low-contrast'),'incomplete contrast review')
 assert.deepEqual(errors,[],'no browser errors')
}

test('catalog identities, actual Back/Forward and renderer dedupe',{timeout:45000},async t=>{
 const {page,requests}=await pageFor(t)
 assert.equal(new URL(page.url()).searchParams.get('source'),workspace)
 assert.equal(await page.getByText(workspace,{exact:true}).count(),1)
 assert.equal(await page.getByText(runs[0].source_id,{exact:true}).count(),1)
 await scan(page,'1440-catalog')
 await open(page,0);await loaded(page,0)
 await navigate(page,'Claimed vs proven');await navigate(page,'Claimed vs proven')
 assert.equal(await tabs(page).getByRole('button',{name:/^Select Claimed vs proven/}).count(),1)
 await page.goBack();await loaded(page,0)
 await page.goBack();await page.getByRole('heading',{name:'Runs',exact:true}).waitFor()
 await page.goForward();await loaded(page,0)
 await page.goForward();await page.getByRole('heading',{name:'Claims and recorded results',exact:true}).waitFor()
 assert.equal(new URL(page.url()).searchParams.get('filter'),'kept');assert.equal(new URL(page.url()).hash,'#anchor')
 assert.equal(requests.filter(path=>path.endsWith('/document')).length,1,'renderer navigation uses cached document')
 await scan(page,'1440-claims')
})

test('pin, close, restore and bounded metadata survive reload',{timeout:45000},async t=>{
 const {page}=await pageFor(t)
 await open(page,0);await loaded(page,0)
 await tabs(page).getByRole('button',{name:/^Pin Overview/}).click()
 await tabs(page).getByRole('button',{name:/^Close Overview/}).click()
 await tabs(page).locator('summary').click()
 await tabs(page).getByRole('button',{name:/^Restore Overview/}).click()
 assert(await tabs(page).getByRole('button',{name:/^Select Overview/}).evaluate(node=>node===document.activeElement),'restore focus')
 const stored=await page.evaluate(()=>localStorage.getItem('truthlens.workspace-navigation.v1'))
 assert(!stored.includes('document')&&!stored.includes('criteria')&&!stored.includes('blobs'),'metadata only')
 assert(new TextEncoder().encode(stored).byteLength<=64*1024)
 await page.reload();await page.getByRole('button',{name:'Connect',exact:true}).click();await loaded(page,0)
 assert.equal(await tabs(page).getByRole('button',{name:/^Unpin Overview/}).getAttribute('aria-pressed'),'true')
})

test('storage failure and late responses keep the selected run',{timeout:45000},async t=>{
 let release;const gate=new Promise(resolve=>{release=resolve})
 const {page}=await pageFor(t,{storageFailure:true,load:async item=>{if(item===runs[0])await gate}})
 t.after(()=>release())
 await page.getByText('Unsaved on this device.').waitFor()
 const requested=page.waitForRequest(request=>request.url().endsWith(`/${runs[0].run_id}/document`))
 await open(page,0);await requested
 await tabs(page).getByRole('button',{name:'Open Runs',exact:true}).click()
 await open(page,1);await loaded(page,1);release()
 await navigate(page,'Claimed vs proven')
 assert.equal(new URL(page.url()).searchParams.get('run'),runs[1].run_id)
 await scan(page,'1440-unsaved-late-response')
})

test('40 open tabs reject new targets and restores without eviction',{timeout:45000},async t=>{
 const {page}=await pageFor(t)
 for(let index=0;index<39;index++){
  await open(page,index);await loaded(page,index)
  await tabs(page).getByRole('button',{name:'Open Runs',exact:true}).click()
 }
 await open(page,39);await page.getByRole('alert').waitFor()
 assert.equal(await tabs(page).getByRole('button',{name:/^Select /}).count(),40)
 await tabs(page).getByRole('button',{name:/^Close Overview/}).first().click()
 await open(page,39);await loaded(page,39)
 await tabs(page).locator('summary').click();await tabs(page).getByRole('button',{name:/^Restore Overview/}).click()
 await page.getByRole('alert').waitFor()
 assert.equal(await tabs(page).getByRole('button',{name:/^Select /}).count(),40)
 assert.equal(await tabs(page).getByRole('button',{name:/^Restore Overview/}).count(),1)
})

for(const theme of ['petrol-porcelain','cool-graphite'])test(`390×844 last criterion reachable: ${theme}`,{timeout:45000},async t=>{
 const {page}=await pageFor(t,{width:390,height:844,theme})
 await scan(page,`390-${theme}-catalog`)
 await open(page,0);await loaded(page,0)
 await navigate(page,'Claimed vs proven',true);await navigate(page,'Overview',true)
 const last=page.locator('.criterion-button').filter({hasText:fixture.criteria.at(-1).text})
 await last.scrollIntoViewIfNeeded()
 assert(await last.evaluate(node=>{const rect=node.getBoundingClientRect();return node.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2))}),'last criterion hit-testable')
 await last.focus();await page.keyboard.press('Enter');await page.getByRole('dialog').waitFor()
 await scan(page,`390-${theme}-last-criterion`)
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'})
 assert(await last.evaluate(node=>document.activeElement===node),'sheet restores criterion focus')
})
