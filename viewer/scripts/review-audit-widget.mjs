// Manual release evidence only. Route fixtures are simulated, never live/VPS proof.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {preview} from 'vite'
import AxeBuilder from '@axe-core/playwright'
import {chromium} from 'playwright'
const output=process.env.WIDGET_OUTPUT??'.screenshots/audit-widget'
const run='run_00000000000000000000000001'
const results=[]
let server,browser
await mkdir(output,{recursive:true})
try {
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}})
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE})
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:844}]) {
  for(const fixture of ['disconnected','contradiction','interrupted']) {
   const context=await browser.newContext({viewport,locale:'en-GB',reducedMotion:'reduce'})
   const page=await context.newPage()
   const errors=[]
   page.on('pageerror',error=>errors.push(error.message))
   await page.clock.install()
   if(fixture!=='disconnected') await page.route('**/v1/runs/**/events?**',route=>fixture==='interrupted'
    ? route.abort()
    : route.fulfill({contentType:'application/json',body:JSON.stringify({run_id:run,events:[],next_seq:0,has_more:false,
     audit:{state:'completed',conclusion:'contradictory',connection:'not connected',last_activity:'2026-10-23T00:00:00Z',
      authentication:'not_checkable',integrity:'hash-only',verified:false,
      claim_checks:[{rule_id:'TL-AUD-005',outcome:'contradictory',message:'SIMULATED: Completion claim contradicts recorded failure.'}]}})}))
   await page.goto(`${origin}/widget.html${fixture==='disconnected'?'':`?run_id=${run}`}`)
   await page.getByRole('heading',{name:'Audit status'}).waitFor()
   await page.evaluate(async()=>{await document.fonts.ready;const note=document.createElement('p');note.textContent='SIMULATED REVIEW · NOT CONNECTED';document.querySelector('main').prepend(note)})
   if(fixture==='contradiction') await page.getByText('Contradiction found',{exact:true}).waitFor()
   if(fixture==='interrupted') {
    for(let count=0;count<4;count++){await page.clock.fastForward(2200);await page.waitForTimeout(50)}
    await page.getByText('Updates interrupted',{exact:true}).waitFor()
   }
   assert.equal(await page.locator('details').getAttribute('open'),null)
   assert(await page.getByText('Integrity is not approval',{exact:true}).isVisible())
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   const bounds=await page.locator('.audit-widget').boundingBox()
   assert(bounds.width<=360)
   if(fixture==='disconnected') assert(bounds.height>=220 && bounds.height<=280)
   await page.screenshot({path:`${output}/${fixture}-${viewport.width}.png`,animations:'disabled'})
   const closed=await new AxeBuilder({page}).analyze()
   const summary=page.locator('summary');await summary.focus();await page.keyboard.press('Enter')
   assert(await page.locator('details').evaluate(node=>node.open))
   await page.screenshot({path:`${output}/${fixture}-${viewport.width}-details.png`,animations:'disabled'})
   const opened=await new AxeBuilder({page}).analyze()
   await page.evaluate(()=>{const style=document.createElement('style');style.textContent='body {font-size:28px} .audit-widget * {font-size:inherit !important}';document.head.append(style)})
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   assert.equal(errors.length,0)
   for(const result of [closed,opened]) assert(!result.violations.some(v=>['serious','critical'].includes(v.impact)))
   results.push({viewport,fixture,bounds,source:'SIMULATED registry route; not live or host isolation evidence',errors,
    closed:{violations:closed.violations,incomplete:closed.incomplete},opened:{violations:opened.violations,incomplete:opened.incomplete}})
   await context.close()
  }
 }
} finally {
 await writeFile(`${output}/axe-summary.json`,JSON.stringify({commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  scope:'Manual release only; unrestricted axe and keyboard/reflow; simulated disconnected sources, no gateway/Mausbot/VPS acceptance',results},null,2))
 await browser?.close();await server?.close()
}
