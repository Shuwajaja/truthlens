// Build real deployment variants; never deploy or use credentials.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {build,preview} from 'vite'
const original=process.env.VERCEL_ENV
const browserCheck=process.argv.includes('--browser')
const output=process.env.TOOLBAR_OUTPUT??'../docs/screenshots/w4/issue-126-toolbar-rules'
const run=Date.now(),checks=[]
let browser
async function inspect(environment,outDir){
 const server=await preview({logLevel:'silent',build:{outDir},preview:{host:'127.0.0.1',port:0,strictPort:true}})
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`
 try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const context=await browser.newContext({viewport,locale:'en-GB',timezoneId:'Europe/Berlin',reducedMotion:'reduce'})
   const page=await context.newPage(),errors=[],warnings=[]
   let requests=0
   page.on('pageerror',error=>errors.push(error.message))
   page.on('console',message=>{if(message.type()==='warning')warnings.push(message.text())})
   await page.route('https://vercel.live/**',route=>{
    requests++;return route.fulfill({status:503,contentType:'text/javascript',body:''})
   })
   const unavailable=environment==='preview'?page.waitForEvent('console',{predicate:message=>message.type()==='warning'&&message.text()==='Preview comments unavailable.'}):null
   await page.goto(origin);await page.locator('main h1').waitFor();await page.evaluate(()=>document.fonts.ready)
   if(unavailable)await unavailable
   assert.equal(requests,environment==='preview'?1:0,'only preview requests the loader once')
   const scripts=page.locator('script[src^="https://vercel.live/"]')
   assert.equal(await scripts.count(),environment==='preview'?1:0)
   if(environment==='preview')assert.equal(await scripts.getAttribute('data-explicit-opt-in'),'true')
   await page.screenshot({path:`${output}/${environment}-${viewport.width}x${viewport.height}.png`,animations:'disabled'})
   if(!(await page.getByRole('navigation',{name:'Viewer navigation',exact:true}).isVisible()))await page.getByRole('button',{name:'Navigation',exact:true}).click()
   await page.getByRole('navigation',{name:'Viewer navigation',exact:true}).getByRole('button').nth(2).click()
   assert(await page.getByRole('heading',{name:'Timeline',exact:true}).isVisible(),'viewer works after toolbar failure')
   assert.equal(errors.length,0,'page errors')
   checks.push({environment,viewport,loaderRequests:requests,pageErrors:errors,simulatedHttp503:environment==='preview',warnings,viewerNavigation:'passed'})
   await context.close()
  }
  if(environment==='preview')for(const tag of ['script','vercel-live-feedback']){
   const context=await browser.newContext()
   await context.addInitScript(tag=>{
    const el=document.createElement(tag)
    if(tag==='script'){el.setAttribute('type','text/plain');el.setAttribute('src','https://vercel.live/_next-live/feedback/feedback.js')}
    document.documentElement.append(el)
   },tag)
   const page=await context.newPage()
   await page.goto(origin);await page.locator('main h1').waitFor();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('vercel-live-feedback,script[src^="https://vercel.live/"]').count(),1,'platform loader reused')
   checks.push({environment,simulatedPlatformElement:tag,duplicateLoader:false})
   await context.close()
  }
  if(environment==='preview')for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const context=await browser.newContext({viewport})
   let requests=0
   // Reproduce Vercel's raw response: an async platform script after </html>.
   await context.route(origin+'/',async route=>{
    const response=await route.fetch()
    const html=await response.text()
    assert(html.includes('</html>'),'fixture contains the real document end')
    await route.fulfill({response,body:html+'<script async data-explicit-opt-in="true" data-deployment-id="dpl_test_preview" src="https://vercel.live/_next-live/feedback/feedback.js"></script>'})
   })
   await context.route('https://vercel.live/**',route=>{
    requests++;return route.fulfill({status:503,contentType:'text/javascript',body:''})
   })
   const page=await context.newPage(),errors=[]
   page.on('pageerror',error=>errors.push(error.message))
   await page.goto(origin);await page.locator('main h1').waitFor();await page.waitForLoadState('networkidle')
   const scripts=page.locator('script[src^="https://vercel.live/_next-live/feedback/feedback.js"]')
   assert.equal(await scripts.count(),1,'trailing async platform script is reused')
   assert.equal(requests,1,'no second platform loader request')
   assert.equal(await scripts.getAttribute('data-deployment-id'),'dpl_test_preview','original platform script retained')
   assert.equal(await scripts.getAttribute('data-explicit-opt-in'),'true')
   assert(await scripts.evaluate(el=>el.async),'platform async attribute retained')
   assert.equal(errors.length,0,'trailing-script fixture page errors')
   checks.push({environment,viewport,simulatedPlatformScriptAfterHtml:true,async:true,loaderRequests:requests,scriptCount:1,domParent:await scripts.evaluate(el=>el.parentElement.tagName),pageErrors:errors})
   await context.close()
  }
 }finally{await server.close()}
}
try{
 if(browserCheck){
  await mkdir(output,{recursive:true})
  process.env.PLAYWRIGHT_BROWSERS_PATH??=fileURLToPath(new URL('../../.venv/playwright',import.meta.url))
  const {chromium}=await import('playwright')
  browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE})
 }
 for(const environment of [undefined,'production','development','staging','preview']){
  if(environment===undefined)delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV=environment
  const runBrowser=browserCheck&&['production','preview'].includes(environment)
  const outDir=`.screenshots/toolbar-builds/${run}/${environment}`
  const built=await build({logLevel:'silent',build:{write:runBrowser,outDir,emptyOutDir:false}})
  const files=(Array.isArray(built)?built:[built]).flatMap(result=>result.output)
  const javascript=files.filter(file=>file.type==='chunk').map(file=>file.code).join('\n')
  const injected=javascript.includes('/_next-live/feedback/feedback.js')
  assert.equal(injected,environment==='preview',`${environment??'unset'}: only previews may contain the toolbar loader`)
  if(environment!=='preview')assert(!files.some(file=>file.fileName.includes('preview-toolbar')),'toolbar chunk must be removed')
  checks.push({environment:environment??'unset',toolbarInBuild:injected})
  console.log(`Toolbar build gate: ${environment??'unset'} — ${injected?'included':'absent'}`)
  if(runBrowser)await inspect(environment,outDir)
 }
 if(browserCheck)await writeFile(`${output}/toolbar-checks.json`,JSON.stringify({browserVersion:browser.version(),checks},null,2)+'\n')
 console.log(`PASS: preview-only build gate${browserCheck?'; Chromium loader/reuse/failure checks (no authenticated comments test)':''}`)
}finally{
 await browser?.close()
 if(original===undefined)delete process.env.VERCEL_ENV
 else process.env.VERCEL_ENV=original
}
