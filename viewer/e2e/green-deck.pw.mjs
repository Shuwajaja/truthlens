// Manual Phase F qualification: synthetic signed audit bytes, human UI only.
import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import {execFileSync} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {preview} from 'vite'
import {chromium} from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import {reviewIncomplete} from '../scripts/a11y-review.mjs'

const output=process.env.EVIDENCE_OUTPUT??'../docs/screenshots/feat/phase-f-green-deck/utc'
const reports=[],errors=[],workspace='a'.repeat(64),source='b'.repeat(64)
let server,browser,origin,fixture,testedCommit,dirty
before(async()=>{
 testedCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
 dirty=execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
 // Generate every status with the actual shared Python projection, not JS rules.
 fixture=JSON.parse(execFileSync(resolve('../.venv/bin/python'),['-c',`
import copy,json,tempfile
from pathlib import Path
from tests.audit_support import make_run,TEST_KEY
from truthlens.audit import audit_run
from truthlens.export import build
from truthlens.ledger import Ledger
from truthlens.status_projection import project_status
root=make_run(Path(tempfile.mkdtemp(prefix='phase-f-browser-fixtures-',dir='.cache')))
report=audit_run(root,hmac_key=TEST_KEY)
doc=build(Ledger(root/'ledger.jsonl',TEST_KEY,'test-key').read(),json.loads((root/'manifest.json').read_bytes()))
bad=copy.deepcopy(report);bad['checks'][0]['outcome']='contradictory';bad['conclusion']='contradictory'
gap=copy.deepcopy(report);gap['conclusion']='not_checkable'
variants={name:{'report':r,'status':project_status(r,**opts)} for name,r,opts in [
 ('passed',report,{}),('failed',bad,{}),('not_checkable',gap,{}),
 ('running',report,{'state':'running'}),('error',report,{'state':'error'}),
 ('interrupted',report,{'state':'interrupted'})]}
print(json.dumps({'doc':doc,'variants':variants}))
`],{cwd:resolve('..'),env:{...process.env,PYTHONPATH:resolve('../src')},encoding:'utf8',maxBuffer:1024*1024}))
 await mkdir(output,{recursive:true})
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}})
 origin=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE})
})
after(async()=>{
 await browser?.close();await server?.close()
 await writeFile(`${output}/review.json`,JSON.stringify({testedCommit,dirty,timezone:process.env.TZ??'UTC',scope:'Synthetic fixtures only. Unrestricted axe; computed CSS font sizes doubled for 200% text enlargement, not native browser zoom. No live SSH/service, agent broker, cryptographic browser check, spoken screenreader or human acceptance.',reports,errors},null,2)+'\n')
})
async function textSize(page,factor){
 await page.evaluate(factor=>{
  for(const el of document.querySelectorAll('[data-review-font]')){el.style.fontSize=el.dataset.reviewFont;delete el.dataset.reviewFont}
  if(factor===1)return
  const sizes=[...document.querySelectorAll('body,body *')].map(el=>({el,size:parseFloat(getComputedStyle(el).fontSize)*factor,original:el.style.fontSize}))
  for(const {el,size,original} of sizes){el.dataset.reviewFont=original;el.style.fontSize=`${size}px`}
 },factor)
}
async function scan(page,name,textZoom,screenshot=false,widget=false){
 await textSize(page,textZoom);await page.evaluate(()=>document.fonts.ready)
 const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
  overflow:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(el).position!=='fixed').slice(0,10).map(el=>({tag:el.tagName,css:el.className,right:el.getBoundingClientRect().right,text:el.textContent.slice(0,60)}))}))
 assert(layout.scroll<=layout.width,`${name}: no page overflow ${JSON.stringify(layout)}`)
 const result=await new AxeBuilder({page}).analyze(),manual=await reviewIncomplete(page,result)
 reports.push({name,textZoom,layout,violations:result.violations.map(({id,impact,nodes})=>({id,impact,targets:nodes.map(n=>n.target)})),incomplete:result.incomplete.map(({id,nodes})=>({id,targets:nodes.map(n=>n.target)})),manual})
 if(screenshot){
  if(widget)await page.locator('main').screenshot({path:`${output}/${name}.png`})
  else await page.screenshot({path:`${output}/${name}.png`})
 }
 assert.equal(result.violations.length,0,`${name}: ${JSON.stringify(result.violations.map(({id,impact})=>({id,impact})))}`)
 assert(!manual.some(item=>item.outcome==='low-contrast'));assert.deepEqual(errors,[])
 await textSize(page,1)
}
for(const width of [1440,390,320])for(const theme of ['petrol-porcelain','cool-graphite'])test(`${width} ${theme}: widget and viewer use the same status`,{timeout:120000},async t=>{
 const context=await browser.newContext({viewport:{width,height:width===1440?900:844},reducedMotion:'reduce',timezoneId:process.env.TZ??'UTC'})
 t.after(()=>context.close())
 await context.addInitScript(theme=>{if(window===window.top)localStorage.setItem('truthlens.theme',theme)},theme)
 const page=await context.newPage(),requests=[],run=fixture.doc.run
 const item={run_id:run.run_id,source_id:source,registration_id:'synthetic-registration',ledger_last_hash:run.ledger_last_hash,capture_closed_at:run.finished}
 let variant='passed',unavailable=false,hold=null
 page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/v1/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname
  requests.push(request.method()+' '+path);assert.equal(request.method(),'GET')
  if(unavailable){await route.fulfill({status:503,json:{error:'unavailable'}});return}
  let body
  if(path==='/v1/health')body={source_id:workspace,service:'available'}
  else if(path==='/v1/runs')body={source_id:workspace,runs:[item],next_offset:null}
  else if(path.endsWith('/document'))body={source_id:source,document:fixture.doc}
  else{
   assert.equal(path,`/v1/runs/${run.run_id}/audits`)
   if(hold)await hold
   body={source_id:source,audit:fixture.variants[variant].report,status:fixture.variants[variant].status}
  }
  await route.fulfill({json:body})
 })
 await page.goto(`${origin}/widget.html?run_id=${run.run_id}`)
 await page.getByText('Not connected',{exact:true}).waitFor();assert.deepEqual(requests,[])
 await scan(page,`${width}-${theme}-widget-disconnected`,1)
 await page.getByRole('button',{name:'Connect',exact:true}).click()
 await page.getByTestId('audit-status').filter({hasText:'Passed'}).waitFor()
 assert.equal(await page.locator('details,ol').count(),0)
 assert(!(await page.locator('main').innerText()).includes(run.run_id))
 for(const name of ['passed','failed','not_checkable','running','error','interrupted']){
  variant=name
  await page.getByRole('button',{name:'Refresh status',exact:true}).click()
  await page.waitForFunction(expected=>document.querySelector('[data-testid=audit-status]')?.getAttribute('data-status')===expected,fixture.variants[name].status.status)
  await page.getByRole('button',{name:'Refresh status',exact:true}).waitFor({state:'visible'})
  await page.waitForFunction(()=>!document.querySelector('button')?.disabled)
  for(const zoom of [1,2])await scan(page,`${width}-${theme}-widget-${name}-${zoom}x`,zoom,name==='passed'&&zoom===2,true)
 }
 variant='passed';await page.getByRole('button',{name:'Refresh status',exact:true}).click()
 await page.getByTestId('audit-status').filter({hasText:'Passed'}).waitFor()
 let release;hold=new Promise(resolve=>{release=resolve})
 await page.getByRole('button',{name:'Refresh status',exact:true}).click()
 await page.getByTestId('audit-status').filter({hasText:'Not checkable'}).waitFor()
 assert.equal(await page.getByText('Passed',{exact:true}).count(),0,'loading clears cached green')
 release();hold=null;await page.getByTestId('audit-status').filter({hasText:'Passed'}).waitFor()
 unavailable=true;await page.getByRole('button',{name:'Refresh status',exact:true}).click()
 await page.getByText('Not connected',{exact:true}).waitFor()
 for(const zoom of [1,2])await scan(page,`${width}-${theme}-widget-unavailable-${zoom}x`,zoom,false,true)
 unavailable=false;requests.length=0
 await page.goto(origin);await page.getByRole('heading',{name:'Not connected',exact:true}).waitFor();assert.deepEqual(requests,[])
 await page.getByRole('button',{name:'Connect',exact:true}).click()
 await page.getByRole('button',{name:`Open run ${run.run_id}`,exact:true}).click()
 await page.getByRole('heading',{name:run.project,exact:true}).waitFor()
 if(width<768)await page.getByRole('button',{name:'Navigation',exact:true}).click()
 await page.getByRole('navigation',{name:'Viewer navigation'}).getByRole('button',{name:'Chain',exact:true}).click()
 if(width<768)await page.getByRole('dialog').waitFor({state:'hidden'})
 await page.getByTestId('audit-status').filter({hasText:'Passed'}).waitFor()
 assert(await page.getByText('Hash only · signature not checked',{exact:true}).count())
 assert.equal(await page.getByText('Signature checked',{exact:true}).count(),0)
 for(const zoom of [1,2])await scan(page,`${width}-${theme}-viewer-passed-${zoom}x`,zoom,width===320&&zoom===2)
 const button=page.getByRole('button',{name:width<768?'Navigation':'Open Runs',exact:true}).first()
 await button.focus();assert(await button.evaluate(el=>el===document.activeElement))
})
