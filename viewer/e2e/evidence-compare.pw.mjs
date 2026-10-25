// Manual Phase D acceptance. Synthetic API fixtures against the real production build.
import assert from 'node:assert/strict'
import {after,before,test} from 'node:test'
import {execFileSync} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {preview} from 'vite'
import {chromium} from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import {reviewIncomplete} from '../scripts/a11y-review.mjs'
const fixture=JSON.parse(await readFile(new URL('../fixtures/demo-run.json',import.meta.url),'utf8'))
const output=process.env.EVIDENCE_OUTPUT??'../docs/screenshots/feat/phase-d-evidence-compare'
const workspace='a'.repeat(64),reports=[],errors=[]
const runs=['intact','broken','partial'].map((run_id,index)=>({run_id,source_id:String(index+1).repeat(64),registration_id:run_id,ledger_last_hash:fixture.run.ledger_last_hash,capture_closed_at:'2026-10-25T00:00:00.000Z'}))
const check=(outcome,rule_id='TL-AUD-001')=>({rule_id,outcome,required:true,message:`Synthetic recorded ${outcome}`,event_ids:[fixture.events[0].id],criterion_ids:[]})
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
 await writeFile(`${output}/review.json`,JSON.stringify({testedCommit,dirty,timezone:process.env.TZ??'UTC',scope:'Synthetic UI fixtures only; no live service, independent signature check or human approval.',reports,errors},null,2)+'\n')
})
async function scan(page,name){
 await page.evaluate(()=>document.fonts.ready)
 const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('main *')].filter(node=>node.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(node=>({tag:node.tagName,css:node.className,width:node.getBoundingClientRect().width}))}))
 assert(overflow.scroll<=overflow.width,`no page overflow: ${JSON.stringify(overflow)}`)
 const result=await new AxeBuilder({page}).analyze(),manual=await reviewIncomplete(page,result)
 reports.push({name,violations:result.violations,incomplete:result.incomplete,manual})
 await page.screenshot({path:`${output}/${name}.png`})
 assert.equal(result.violations.filter(v=>['serious','critical'].includes(v.impact)).length,0)
 assert(!manual.some(v=>v.outcome==='low-contrast'))
 assert.deepEqual(errors,[])
}
for(const width of [1440,390])for(const theme of ['petrol-porcelain','cool-graphite'])test(`${width} ${theme}: evidence, diff, compare and sheets`,{timeout:90000},async t=>{
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce',timezoneId:process.env.TZ??'UTC'})
 t.after(()=>context.close())
 await context.addInitScript(theme=>{if(window===window.top)localStorage.setItem('truthlens.theme',theme)},theme)
 const page=await context.newPage(),requests=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/v1/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;requests.push(path);assert.equal(request.method(),'GET')
  let body
  if(path==='/v1/health')body={source_id:workspace,service:'available'}
  else if(path==='/v1/runs')body={source_id:workspace,runs,next_offset:null}
  else{
   const item=runs.find(item=>path.startsWith(`/v1/runs/${item.run_id}/`));assert(item)
   if(path.endsWith('/document'))body={source_id:item.source_id,document:{...fixture,...(item.run_id==='partial'?{blobs:{}}:{}),run:{...fixture.run,run_id:item.run_id,project:`Snapshot ${item.run_id}`}}}
   else{
    assert(path.endsWith('/audits'))
    const chain=[check('supported'),...(item.run_id==='intact'?[]:[check(item.run_id==='broken'?'contradictory':'not_checkable')])]
    body={source_id:item.source_id,audit:{audit_version:1,run_id:item.run_id,ledger_last_hash:item.ledger_last_hash,checks:[...chain,check('not_checkable','TL-AUD-003'),check('not_checkable','TL-AUD-004'),check('not_applicable','TL-AUD-012')],limitations:['Synthetic UI fixture; no live verification.']}}
   }
  }
  await route.fulfill({json:body})
 })
 const navigate=async name=>{
  if(width===390)await page.getByRole('button',{name:'Navigation',exact:true}).click()
  await page.getByRole('navigation',{name:'Viewer navigation'}).getByRole('button',{name,exact:true}).click()
  if(width===390)await page.getByRole('dialog').waitFor({state:'hidden'})
 }
 await page.goto(origin);await page.getByRole('heading',{name:'Not connected',exact:true}).waitFor();assert.deepEqual(requests,[])
 await page.getByRole('button',{name:'Connect',exact:true}).click()
 for(const [index,label] of ['Checked within scope','Check failed','Partially checked'].entries()){
  await page.getByRole('button',{name:`Open run ${runs[index].run_id}`,exact:true}).click()
  await page.getByRole('heading',{name:`Snapshot ${runs[index].run_id}`,exact:true}).waitFor()
  await navigate('Chain');await page.getByTestId('review-outcome').filter({hasText:label}).waitFor()
  await scan(page,`${width}-${theme}-${runs[index].run_id}-chain`)
  await page.getByRole('region',{name:'Workspace tabs'}).getByRole('button',{name:'Open Runs',exact:true}).click()
 }
 await page.getByRole('button',{name:'Open run partial',exact:true}).click();await page.getByRole('heading',{name:'Snapshot partial',exact:true}).waitFor()
 await navigate('Coverage');await page.getByTestId('review-outcome').waitFor();await scan(page,`${width}-${theme}-coverage`)
 await page.getByRole('button',{name:`Open event ${fixture.events[0].id}`,exact:true}).click()
 if(width===390)await page.getByRole('dialog').waitFor()
 await scan(page,`${width}-${theme}-event-inspector`)
 if(width===390){await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert(await page.getByRole('button',{name:`Open event ${fixture.events[0].id}`,exact:true}).evaluate(node=>node===document.activeElement),'focus restored')}
 await navigate('Gated actions');await page.getByTestId('review-outcome').filter({hasText:'Not applicable'}).waitFor();await scan(page,`${width}-${theme}-gated`)
 await navigate('Changes');await page.getByText(/No stored diff content/).waitFor();await scan(page,`${width}-${theme}-missing-diff`)
 await navigate('Claimed vs proven');await page.getByRole('heading',{name:'Claims and recorded results'}).waitFor();await scan(page,`${width}-${theme}-claims`)
 await navigate('Compare');await page.getByLabel('Comparison snapshot').selectOption(JSON.stringify([runs[0].source_id,runs[0].run_id]))
 await page.getByRole('region',{name:'Right snapshot'}).waitFor()
 assert(await page.getByRole('region',{name:'Left snapshot'}).getByText(runs[2].source_id,{exact:true}).count())
 assert(await page.getByRole('region',{name:'Right snapshot'}).getByText(runs[0].source_id,{exact:true}).count())
 await scan(page,`${width}-${theme}-compare`)
 await page.getByRole('region',{name:'Workspace tabs'}).getByRole('button',{name:'Open Runs',exact:true}).click()
 await page.getByRole('button',{name:'Open run intact',exact:true}).click();await page.getByRole('heading',{name:'Snapshot intact',exact:true}).waitFor()
 await navigate('Changes');await page.getByRole('region',{name:'Stored unified diff',exact:true}).waitFor()
 await scan(page,`${width}-${theme}-stored-diff`)
 await page.getByRole('button',{name:'Open diff event',exact:true}).click()
 if(width===390)await page.getByRole('dialog').waitFor()
 await scan(page,`${width}-${theme}-diff-inspector`)
 if(width===390){await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert(await page.getByRole('button',{name:'Open diff event',exact:true}).evaluate(node=>node===document.activeElement),'diff trigger focus restored')}
})
