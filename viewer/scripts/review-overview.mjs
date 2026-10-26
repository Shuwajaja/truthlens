// Local manual review only. Uses the recorded dev fixture, never product sample data.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {createServer,preview} from 'vite'
import {chromium} from 'playwright'
import AxeBuilder from '@axe-core/playwright'
const output=process.env.OVERVIEW_OUTPUT??'.screenshots/run-detail-v3'
await mkdir(output,{recursive:true})
const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()!=='' ,fixture:'viewer/fixtures/demo-run.json; recorded development fixture only',scans:[],checks:[],pageErrors:[],blockedExternal:[]}
let browser,server,production
async function scan(page,name){
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: page overflow`)
 const result=await new AxeBuilder({page}).analyze()
 report.scans.push({name,violations:result.violations,incomplete:result.incomplete,passes:result.passes.map(item=>item.id)})
 assert(!result.violations.some(item=>item.impact==='serious'||item.impact==='critical'),`${name}: serious/critical axe findings (see summary.json)`)
}
try{
 // Launch before starting any listener, so an unavailable browser leaves no server.
 browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE})
 server=await createServer({mode:'development',server:{host:'127.0.0.1',port:0,strictPort:true}})
 await server.listen()
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const context=await browser.newContext({viewport,locale:'de-DE',timezoneId:'Europe/Berlin',reducedMotion:'reduce'})
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();report.blockedExternal.push(url.origin);return route.abort()})
  const page=await context.newPage()
  page.on('pageerror',error=>report.pageErrors.push(error.message))
  await page.goto(origin)
  await page.getByRole('heading',{name:'Übersicht',exact:true}).waitFor()
  await page.evaluate(()=>document.fonts.ready)
  assert.equal(await page.getByRole('figure').count(),4)
  assert.equal(await page.locator('.overview-tools').getAttribute('open'),null)
  await page.screenshot({path:`${output}/overview-${viewport.width}.png`,animations:'disabled'})
  await page.screenshot({path:`${output}/full-${viewport.width}.png`,animations:'disabled',fullPage:true})
  await scan(page,`German overview ${viewport.width}`)
  if(viewport.width===390){
   const charts=page.getByRole('region',{name:'Laufdiagramme'})
   await charts.focus();await page.keyboard.press('ArrowRight')
   await page.getByRole('button',{name:'Nächstes Diagramm'}).click()
   assert(await charts.evaluate(el=>el.scrollLeft>0),'chart navigation scrolls the strip')
   report.checks.push('390: native keyboard chart strip and next button')
  }
  const menu=page.locator('.overview-tools > summary')
  await menu.focus();await page.keyboard.press('Enter')
  await page.getByRole('button',{name:'Open local folder',exact:true}).waitFor({state:'visible'})
  await scan(page,`Open menu ${viewport.width}`)
  await page.getByRole('combobox',{name:'Sprache'}).selectOption('en')
  assert.equal(await page.locator('html').getAttribute('lang'),'en')
  await scan(page,`English overview and menu ${viewport.width}`)
  await page.keyboard.press('Escape')
  assert(await menu.evaluate(el=>el===document.activeElement),'Escape restores menu summary focus')
  const run=page.locator('.latest-run').first()
  await run.focus();await page.keyboard.press('Enter')
  await page.getByRole('region',{name:'Claim vs. evidence'}).waitFor()
  assert(await page.locator('main h1').evaluate(el=>el===document.activeElement),'keyboard run opening focuses its heading')
  await page.locator('.overview-tools > summary').click()
  await page.getByRole('combobox',{name:'Language'}).selectOption('de')
  await page.keyboard.press('Escape')
  await page.locator('main h1').focus()
  await page.evaluate(()=>window.scrollTo(0,0))
  await page.screenshot({path:`${output}/run-detail-${viewport.width}.png`,animations:'disabled'})
  await page.screenshot({path:`${output}/run-detail-full-${viewport.width}.png`,animations:'disabled',fullPage:true})
  await scan(page,`German run detail ${viewport.width}`)
  const why=page.locator('.claim-why > summary').first()
  await why.focus();await page.keyboard.press('Enter')
  assert(await why.evaluate(el=>el.parentElement.open),'Why opens by keyboard')
  await scan(page,`Run detail Why ${viewport.width}`)
  await page.keyboard.press('Enter')
  if(viewport.width===390){
   const strip=page.getByRole('region',{name:'Aufgezeichnete Kriterien und Behauptungen'})
   await strip.focus();await page.keyboard.press('ArrowRight')
   await page.getByRole('button',{name:'Nächste Behauptung'}).click()
   assert(await strip.evaluate(el=>el.scrollLeft>0),'claim strip responds to keys and tap control')
  }
  await page.locator('.overview-tools > summary').click()
  await scan(page,`Run detail menu ${viewport.width}`)
  await page.getByRole('combobox',{name:'Sprache'}).selectOption('en')
  await page.keyboard.press('Escape')
  await scan(page,`English run detail ${viewport.width}`)
  await page.getByRole('button',{name:'Details',exact:true}).click()
  await page.getByRole('region',{name:'Criteria and evidence'}).waitFor()
  await scan(page,`Existing Details workspace ${viewport.width}`)
  await page.getByRole('button',{name:'Back to run',exact:true}).click()
  await page.getByRole('region',{name:'Claim vs. evidence'}).waitFor()
  report.checks.push(`${viewport.width}: run screenshots, unrestricted axe, native Why, claim strip, language, menu, preserved Details and return`)

  assert(await page.locator('main h1').evaluate(el=>el===document.activeElement),'return to run focuses its heading')
  assert(new URL(page.url()).searchParams.has('run'),'existing canonical run route')
  report.checks.push(`${viewport.width}: menu Enter/Escape, local-open reachable, fixed language switch, keyboard run opening`)
  await page.route('**/run.json',async route=>{
   const response=await route.fetch(),doc=await response.json()
   doc.criteria=[];doc.claims=[];doc.events=[];doc.artifacts=[];doc.blobs={}
   doc.counts={green:0,yellow:0,red:0,gray:0,outline:0};doc.run.events=0;doc.run.started=''
   await route.fulfill({json:doc})
  })
  await page.reload()
  await page.getByRole('img',{name:'Keine Kriterien aufgezeichnet'}).waitFor()
  await page.getByText('Keine Ereignisse aufgezeichnet.',{exact:true}).waitFor()
  await page.screenshot({path:`${output}/run-empty-synthetic-${viewport.width}.png`,animations:'disabled',fullPage:true})
  await scan(page,`Synthetic empty run detail ${viewport.width}`)
  report.checks.push(`${viewport.width}: synthetic empty RunDoc only; not a recorded witness`)
  await context.close()
 }
 production=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}})
 const productionOrigin=`http://127.0.0.1:${production.httpServer.address().port}`
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'})
 const page=await context.newPage(),requests=[]
 page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/v1/')||new URL(request.url()).pathname==='/run.json')requests.push(request.url())})
 await context.route('**/*',route=>new URL(route.request().url()).origin===productionOrigin?route.continue():route.abort())
 await page.goto(productionOrigin)
 await page.getByText('Noch keine geladenen Läufe.',{exact:true}).waitFor()
 assert.equal(await page.getByRole('figure').count(),0)
 assert.deepEqual(requests,[],'production empty state makes no data request')
 await page.screenshot({path:`${output}/empty.png`,animations:'disabled',fullPage:true})
 await scan(page,'Production empty 390')
 report.checks.push('Production empty: no fixture, chart or data request')
 assert.deepEqual(report.pageErrors,[])
 assert.deepEqual(report.blockedExternal,[])
 report.outcome='passed scoped checks; review axe incomplete items manually; no screen-reader or live service qualification'
}catch(error){report.outcome='failed or unavailable';report.error=error.message;process.exitCode=1}
finally{
 await browser?.close();await server?.close();await production?.close()
 await writeFile(`${output}/summary.json`,JSON.stringify(report,null,2)+'\n')
 console.log(`${report.outcome}: ${output}/summary.json`)
}
