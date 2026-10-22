// Actual run export: shared links, reload and native browser history, both sizes/lenses.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {preview} from 'vite'
import {blockedPreviewScript} from './preview-console.mjs'
process.env.PLAYWRIGHT_BROWSERS_PATH??=fileURLToPath(new URL('../../.venv/playwright',import.meta.url))
const {chromium}=await import('playwright')
const output=process.env.VIEW_URL_OUTPUT??'/tmp/truthlens-view-urls'
const views=['overview','claimed-vs-proven','timeline','agent-story'],checks=[],errors=[],previewScriptBlocks=[]
let server,browser
try{
 await mkdir(output,{recursive:true})
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}})
 const origin='http://127.0.0.1:'+server.httpServer.address().port
 browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE})
 for(const viewport of [{width:1440,height:900},{width:390,height:844}])for(const lens of ['client','developer']){
  const context=await browser.newContext({viewport,reducedMotion:'reduce',locale:'en-GB',timezoneId:'Europe/Berlin'})
  await context.addInitScript(value=>{if(window===window.top)localStorage.setItem('tl-lens',value)},lens)
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort())
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(e.message))
  page.on('console',m=>{if(blockedPreviewScript(m))previewScriptBlocks.push(m.text());else if(m.type()==='error')errors.push(m.text())})
  const selected=()=>page.getByRole('navigation',{name:'Viewer navigation',exact:true}).locator('[aria-current=page]')
  async function expectView(index){
   await page.locator('main h1').waitFor()
   await page.waitForFunction(index=>Array.from(document.querySelectorAll('.nav-item')).findIndex(el=>el.getAttribute('aria-current')==='page')===index,index)
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   assert.equal(await page.evaluate(()=>localStorage.getItem('tl-lens')),lens)
   assert(await page.getByText('Integrity is not approval',{exact:true}).first().isVisible())
  }
  for(const [index,view] of views.entries()){
   await page.goto(`${origin}/?source=review&view=${view}#main-content`);await expectView(index)
   await page.reload();await expectView(index)
   const copied=await context.newPage();await copied.goto(page.url());await copied.locator('main h1').waitFor()
   assert.equal(await copied.getByRole('navigation',{name:'Viewer navigation',exact:true}).locator('[aria-current=page]').innerText(),await selected().innerText());await copied.close()
   checks.push({viewport,lens,view,direct:true,reload:true,copiedUrl:true})
  }
  await page.goto(`${origin}/?source=review#main-content`);await expectView(0)
  const buttons=page.getByRole('navigation',{name:'Viewer navigation',exact:true}).getByRole('button')
  for(const index of [2,3]){
   await buttons.nth(index).focus();await page.keyboard.press('Enter');await expectView(index)
   const url=new URL(page.url());assert.equal(url.searchParams.get('view'),views[index]);assert.equal(url.searchParams.get('source'),'review');assert.equal(url.hash,'#main-content')
  }
  const length=await page.evaluate(()=>history.length);await buttons.nth(3).click();assert.equal(await page.evaluate(()=>history.length),length)
  await page.goBack();await expectView(2);await page.goBack();await expectView(0)
  await page.goForward();await expectView(2);await page.goForward();await expectView(3)
  assert.equal(await page.evaluate(()=>history.length),length)
  await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${output}/story-${viewport.width}-${lens}.png`,animations:'disabled'})
  await page.goto(`${origin}/?view=invalid`);await expectView(0)
  checks.push({viewport,lens,keyboard:true,backForward:true,sameViewNoDuplicate:true,preservesQueryHash:true,unknownFallback:true})
  await context.close()
 }
 assert.deepEqual(errors,[])
 await writeFile(output+'/view-url-checks.json',JSON.stringify({browserVersion:browser.version(),checks,errors,previewScriptBlocks},null,2)+'\n')
 console.log('PASS:16 direct/reload/copied-URL cases;4 keyboard/history/fallback cases, both exact sizes and lenses; no overflow or unexpected errors.')
}finally{await browser?.close();await server?.close()}
