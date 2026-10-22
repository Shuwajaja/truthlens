import {blockedPreviewScript} from './preview-console.mjs'
import {validateAudit} from './a11y-policy.mjs'
import {reviewDialog,reviewIncomplete,reviewScrollSample} from './a11y-review.mjs'
// Full unrestricted axe audit of the actual exported run. Run npm run build first.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {preview} from 'vite'
import AxeBuilder from '@axe-core/playwright'
process.env.PLAYWRIGHT_BROWSERS_PATH??=fileURLToPath(new URL('../../.venv/playwright',import.meta.url))
const {chromium}=await import('playwright')
const output=process.env.A11Y_OUTPUT??'.screenshots/a11y'
const axeVersion=(await import('axe-core')).default.version
const results=[],errors=[],keyboard=[],previewScriptBlocks=[],manual=[]
let server,browser,failure
const report=()=>({scope:'unrestricted axe; no rules/tags disabled or filtered',limitations:['AX-tree/keyboard checks are not spoken NVDA/VoiceOver output','CSS compositing is separate from occlusion/scroll samples; unresolved cases remain review items'],browserVersion:browser?.version(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),previewScriptBlocks,axeVersion,errors,keyboard,results,manual,failure})
try{
 await mkdir(output,{recursive:true})
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}})
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE})
 for(const viewport of [{width:1440,height:900},{width:390,height:844}])for(const lens of ['client','developer']){
  const mobile=viewport.width===390
  const context=await browser.newContext({viewport,locale:'en-GB',timezoneId:'Europe/Berlin',reducedMotion:'reduce',deviceScaleFactor:1})
  await context.addInitScript(value=>{if(window===window.top)localStorage.setItem('tl-lens',value)},lens)
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort())
  const page=await context.newPage()
  const cdp=await context.newCDPSession(page)
  await cdp.send('DOM.enable');await cdp.send('Accessibility.enable')
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{if(blockedPreviewScript(message))previewScriptBlocks.push({viewport,lens,message:message.text()});else if(message.type()==='error')errors.push(message.text())})
  await page.goto(origin);await page.locator('main h1').waitFor();await page.evaluate(()=>document.fonts.ready)
  const scan=async state=>{
   const result=await new AxeBuilder({page}).analyze()
   results.push({viewport,lens,state,violations:result.violations,incomplete:result.incomplete,passes:result.passes.map(rule=>rule.id)})
   await page.screenshot({path:`${output}/${state.toLowerCase().replaceAll(':','-')}-${viewport.width}-${lens}.png`,animations:'disabled'})
   const items=await reviewIncomplete(page,result),dialog=await reviewDialog(page,cdp)
   const scrollSample=await reviewScrollSample(page,items)
   manual.push({viewport,lens,state,dialog,items,scrollSample})
   assert(!items.some(item=>item.outcome==='low-contrast'),`composited contrast requires correction: ${state}`)
   console.log(`${viewport.width} ${lens} ${state}: ${result.violations.map(rule=>`${rule.id} (${rule.nodes.length})`).join(', ')||'no violations'}`)
  }
  const sheet=async(trigger,state)=>{
   await trigger.focus();await page.keyboard.press('Enter')
   const dialog=page.getByRole('dialog');await dialog.waitFor()
   assert(await dialog.getByText('Hash only · signature not checked',{exact:true}).isVisible())
   assert(await dialog.getByText('Integrity is not approval',{exact:true}).isVisible())
   await scan(state)
   const checkCode=async codeState=>{
   const blocks=dialog.locator('pre')
   for(let index=0;index<await blocks.count();index++){
    const block=blocks.nth(index)
    if(!await block.evaluate(el=>el.scrollWidth>el.clientWidth||el.scrollHeight>el.clientHeight))continue
    const reachable=await block.evaluate(el=>el.tabIndex===0)
    let reached=false
    if(reachable)for(let count=0;count<80;count++){
     await page.keyboard.press('Tab')
     if(await block.evaluate(el=>el===document.activeElement)){reached=true;break}
    }
    const focusVisible=reached&&await block.evaluate(el=>{
     const style=getComputedStyle(el)
     return el.matches(':focus-visible')&&style.outlineStyle!=='none'&&parseFloat(style.outlineWidth)>=2
    })
    let scrolled=false
    if(reached){
     const horizontal=await block.evaluate(el=>el.scrollWidth>el.clientWidth)
     await block.evaluate(el=>{el.scrollLeft=0;el.scrollTop=0})
     await page.keyboard.press(horizontal?'ArrowRight':'ArrowDown')
     try{await page.waitForFunction(el=>el.scrollLeft>0||el.scrollTop>0,await block.elementHandle(),{timeout:2000});scrolled=true}catch{ /* Report failure below. */ }
    }
    keyboard.push({viewport,lens,state:codeState,index,reachable,reached,focusVisible,scrolled})
   }
   }
   await checkCode(state)
   if(state==='criterion-drawer'||state==='criterion-sheet')for(const name of ['Tests','Files','Time']){
    await dialog.getByRole('tab',{selected:true}).focus();await page.keyboard.press('ArrowRight')
    const tab=dialog.getByRole('tab',{name,exact:true})
    await page.waitForFunction(el=>el.getAttribute('aria-selected')==='true',await tab.elementHandle())
    await scan(`${state}:tab:${name}`);await checkCode(`${state}:tab:${name}`)
   }
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'})
   await page.waitForFunction(el=>el===document.activeElement,await trigger.elementHandle(),{timeout:2000})
  }
  for(const [index,state] of ['overview','claims','timeline','agent-story'].entries()){
   await page.getByRole('navigation',{name:'Viewer navigation',exact:true}).getByRole('button').nth(index).click()
   await page.locator('main h1').waitFor();await page.evaluate(()=>window.scrollTo(0,0))
   if(index===0&&lens==='client')await page.screenshot({path:`${output}/${mobile?'mobile-390x844':'desktop-1440x900'}.png`,animations:'disabled'})
   await scan(state)
   if(!mobile&&index===0){await page.getByText('Recorded links and code diff',{exact:true}).click();for(const kind of ['claim','criterion','evidence','file'])await sheet(page.locator(`.react-flow__node[data-id^="${kind}:"] button`).first(),`${kind}-drawer`);await page.getByText('Recorded links and code diff',{exact:true}).click()}
   if(mobile){
    await sheet(page.locator('.compact-trust'),`${state}-trust-sheet`)
    if(index===0){
     await sheet(page.getByRole('button',{name:/^Open run:/}),'run-sheet')
     await page.locator('.criterion-button').first().click();await sheet(page.getByRole('button',{name:'Open criterion record',exact:true}),'criterion-sheet')
    }
   }
  }
  await context.close()
 }
 validateAudit(report())
 const outcomes=manual.flatMap(state=>state.items).reduce((counts,item)=>({...counts,[item.outcome]:(counts[item.outcome]??0)+1}),{})
 console.log('Incomplete review outcomes: '+JSON.stringify(outcomes))
 console.log(`PASS: ${results.length} full axe scans; ${keyboard.length} keyboard checks; no violations or browser errors. Manual/AX evidence retained. ${output}`)
}catch(error){failure={name:error.name,message:error.message};throw error}
finally{
 await mkdir(output,{recursive:true})
 await writeFile(`${output}/axe-results.json`,JSON.stringify(report(),null,2)+'\n')
 await browser?.close();await server?.close()
}
