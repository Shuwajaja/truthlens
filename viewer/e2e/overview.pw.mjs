// Manual review only. Production UI + synthetic private-reader responses, no live service.
import assert from 'node:assert/strict'
import {test,before,after} from 'node:test'
import {execFileSync} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {preview} from 'vite'
import {chromium} from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import {reviewIncomplete} from '../scripts/a11y-review.mjs'

const fixture=JSON.parse(await readFile(new URL('../fixtures/demo-run.json',import.meta.url),'utf8'))
const workspace='a'.repeat(64),reports=[],errors=[],external=[]
const output=process.env.OVERVIEW_OUTPUT??'../docs/screenshots/design/overview-v1'
const summaries=Array.from({length:4},(_,i)=>({run_id:`synthetic_overview_${i}`,source_id:String(i+1).repeat(64),registration_id:`synthetic_${i}`,ledger_last_hash:fixture.run.ledger_last_hash,capture_closed_at:'2026-10-25T02:30:00Z'}))
const documents=summaries.map((summary,i)=>{
 const doc=structuredClone(fixture)
 doc.run={...doc.run,run_id:summary.run_id,project:['Synthetic: landing-page checks','Synthetic: import review','Synthetic: documentation checks','Synthetic: unverified criteria'][i],agent:`Synthetic agent ${i%2?'B':'A'}`,started:`2026-10-${22+i}T02:30:00Z`}
 return {source_id:summary.source_id,document:doc}
})
let server,browser,origin,testedCommit,tree
before(async()=>{
 testedCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
 tree=execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
 await mkdir(output,{recursive:true})
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}})
 origin=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE})
})
after(async()=>{
 await browser?.close();await server?.close()
 await writeFile(`${output}/axe-summary.json`,JSON.stringify({testedCommit,modifiedFiles:tree,timezone:process.env.TZ??'UTC',viewports:[[1440,900],[390,844]],scope:'Synthetic reader responses in a real local production browser. No real service, signature validation, D34 admission or human approval established.',reports,errors,external},null,2)+'\n')
})
async function scan(page,name){
 await page.evaluate(()=>document.fonts.ready)
 const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}))
 assert(geometry.scroll<=geometry.width,JSON.stringify(geometry))
 const result=await new AxeBuilder({page}).analyze(),manual=await reviewIncomplete(page,result)
 reports.push({name,geometry,violations:result.violations.map(({id,impact,nodes})=>({id,impact,nodes:nodes.map(({target,failureSummary})=>({target,failureSummary}))})),incomplete:result.incomplete.map(({id,nodes})=>({id,targets:nodes.map(n=>n.target)})),manual})
 await page.screenshot({path:`${output}/${name}.png`})
 if(name.endsWith('-loaded'))await page.screenshot({path:`${output}/${name}-full.png`,fullPage:true})
 assert.equal(result.violations.length,0,JSON.stringify(result.violations.map(v=>({id:v.id,impact:v.impact}))))
 assert(!manual.some(item=>item.outcome==='low-contrast'))
 assert.deepEqual(errors,[]);assert.deepEqual(external,[])
}
for(const width of [1440,390])for(const theme of ['petrol-porcelain','cool-graphite'])for(const lens of ['client','developer'])test(`${width} ${theme} ${lens}: overview, empty state, keyboard run opening and no new reads`,{timeout:60000},async t=>{
 const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce',timezoneId:process.env.TZ??'UTC'})
 t.after(()=>context.close())
 await context.addInitScript(({theme,lens})=>{if(window===window.top){localStorage.setItem('truthlens.theme',theme);localStorage.setItem('tl-lens',lens)}},{theme,lens})
 const prefix=`${width}-${theme}${lens==='developer'?'-developer':''}`
 const page=await context.newPage(),requests=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url())
  if(url.origin!==origin){external.push(url.origin);await route.abort();return}
  if(!url.pathname.startsWith('/v1/')){await route.continue();return}
  requests.push(url.pathname)
  const i=summaries.findIndex(s=>url.pathname.includes(s.run_id))
  const body=url.pathname==='/v1/health'?{source_id:workspace,service:'available'}:url.pathname==='/v1/runs'?{source_id:workspace,runs:summaries,next_offset:null}:i>=0&&url.pathname.endsWith('/document')?documents[i]:null
  assert(body,'unexpected reader request')
  await route.fulfill({json:body})
 })
 await page.goto(origin)
 await page.getByRole('heading',{name:'Not connected',exact:true}).waitFor()
 assert.deepEqual(requests,[],'production does not fetch on mount')
 await scan(page,`${prefix}-empty`)
 await page.getByRole('button',{name:'Connect',exact:true}).click()
 await page.getByRole('heading',{name:'Runs',exact:true}).waitFor()
 assert(await page.getByText('No loaded runs to summarize.',{exact:true}).count())
 await scan(page,`${prefix}-catalog-empty`)
 for(const summary of summaries){
  await page.getByRole('button',{name:`Open run ${summary.run_id}`,exact:true}).click()
  await page.getByRole('heading',{name:documents[summaries.indexOf(summary)].document.run.project,exact:true}).waitFor()
  await page.getByRole('button',{name:'Open Runs',exact:true}).click()
  await page.getByRole('heading',{name:'Runs',exact:true}).waitFor()
 }
 const overview=page.locator('.cross-run-overview')
 assert.equal(await overview.getByRole('figure').count(),4)
 assert(await overview.getByText('4 of 12 criteria met',{exact:true}).count())
 assert.equal(await overview.getByText(/runs passed|signature checked/i).count(),0)
 await scan(page,`${prefix}-loaded`)
 const reads=requests.length,open=overview.getByRole('button',{name:`Open run: ${documents[3].document.run.project}`,exact:true})
 await open.focus();await page.keyboard.press('Enter')
 await page.getByRole('heading',{name:documents[3].document.run.project,exact:true}).waitFor()
 assert.equal(requests.length,reads,'overview reopening uses the existing loaded document')
 assert(await page.getByText('Integrity is not approval',{exact:true}).count())
 await scan(page,`${prefix}-existing-review`)
 await page.getByRole('button',{name:'Open Runs',exact:true}).click()
 await page.goBack()
 await page.getByRole('heading',{name:documents[3].document.run.project,exact:true}).waitFor()
})
