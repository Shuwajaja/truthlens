// Real export + isolated hostile fixture: layout, selection and static preview boundary.
import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {preview} from 'vite'
import {blockedPreviewScript} from './preview-console.mjs'
process.env.PLAYWRIGHT_BROWSERS_PATH??=fileURLToPath(new URL('../../.venv/playwright',import.meta.url))
const {chromium}=await import('playwright')
const doc=JSON.parse(await readFile(new URL('../public/run.json',import.meta.url),'utf8'))
const output=process.env.STITCH_OUTPUT??'.screenshots/review/stitch'
await mkdir(output,{recursive:true})
let server,browser
const report={actualExport:[],fixture:'Synthetic hostile/missing-body scenarios; never recorded evidence',externalRequests:[],unexpectedErrors:[],expectedScriptBlocks:0}
try{
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}})
 const origin='http://127.0.0.1:'+server.httpServer.address().port
 browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE})
 for(const viewport of [{width:1440,height:900},{width:390,height:844}])for(const lens of ['client','developer']){
  const context=await browser.newContext({viewport,timezoneId:'Europe/Berlin',reducedMotion:'reduce'})
  await context.addInitScript(lens=>{if(window===window.top)localStorage.setItem('tl-lens',lens)},lens)
  await context.route('**/*',route=>{
   if(new URL(route.request().url()).origin!==origin){report.externalRequests.push(route.request().url());return route.abort()}
   return route.continue()
  })
  const page=await context.newPage()
  page.on('console',m=>{if(blockedPreviewScript(m))report.expectedScriptBlocks++;else if(m.type()==='error')report.unexpectedErrors.push(m.text())})
  page.on('pageerror',e=>report.unexpectedErrors.push(e.message))
  await page.goto(origin);await page.locator('main h1').waitFor();await page.evaluate(()=>document.fonts.ready)
  assert.equal(await page.locator('.status-card').count(),3)
  assert.equal((await page.getByTestId('met-count').innerText()).replace(/\s+/g,' '),'1 / 3')
  assert.equal(await page.getByTestId('approval-status').innerText(),'OPEN')
  const semantics=await page.evaluate(()=>{
   const status=document.querySelector('[data-testid=approval-status]')
   const nav=document.querySelector('.nav-item-active'),navStyle=getComputedStyle(nav)
   return {profile:document.documentElement.dataset.viewerTheme,bg:getComputedStyle(document.body).backgroundColor,approval:getComputedStyle(status).color,approvalState:status.dataset.state,font:getComputedStyle(document.body).fontFamily,
    dots:[...document.querySelectorAll('.status-card .status-dot')].map(el=>getComputedStyle(el).backgroundColor),
    activeBorder:innerWidth<=760?navStyle.borderTopColor:navStyle.borderBottomColor,
    forbidden:[...document.querySelectorAll('body *')].some(el=>{if(!el.checkVisibility())return false;const style=getComputedStyle(el);return /Inter Variable/i.test(style.fontFamily)||['color','backgroundColor','borderColor'].some(key=>['rgb(59, 130, 246)','rgb(139, 92, 246)'].includes(style[key]))})}
  })
  assert.equal(semantics.profile,'stitch')
  assert.equal(semantics.bg,'rgb(9, 9, 11)')
  assert.equal(semantics.approval,'rgb(245, 158, 11)')
  assert.equal(semantics.approvalState,'open')
  assert.deepEqual(semantics.dots,['rgb(16, 185, 129)','rgb(244, 63, 94)','rgb(113, 113, 122)'])
  assert.equal(semantics.activeBorder,'rgb(244, 244, 245)')
  assert(semantics.font.includes('Plus Jakarta Sans')&&!semantics.forbidden,'provisional Stitch font/colours in Overview UI')
  assert.equal(await page.locator('.sidebar .nav-list button').count(),4)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  const geometry=await page.locator('.overview-workspace').evaluate(el=>Object.fromEntries(['criteria-panel','project-preview','criterion-detail','timeline-panel'].map(name=>{const b=el.querySelector('.'+name).getBoundingClientRect();return [name,{x:b.x,y:b.y,right:b.right}]})))
  if(viewport.width===1440){assert(geometry['criteria-panel'].right<geometry['project-preview'].x);assert(geometry['project-preview'].right<geometry['criterion-detail'].x)}
  else assert(geometry['criteria-panel'].y<geometry['project-preview'].y&&geometry['project-preview'].y<geometry['criterion-detail'].y&&geometry['criterion-detail'].y<geometry['timeline-panel'].y)
  const iframe=page.locator('.preview-canvas iframe')
  assert.equal(await iframe.getAttribute('sandbox'),'')
  assert(await page.locator('.preview-canvas').evaluate(el=>el.inert))
  const frame=await iframe.elementHandle().then(el=>el.contentFrame())
  assert.equal(await frame.evaluate(()=>{try{void parent.document.body;return true}catch{return false}}),false)
  await frame.waitForFunction(()=>document.readyState==='complete'&&document.body?.textContent.trim().length>0)
  await frame.evaluate(()=>document.fonts.ready)
  await page.screenshot({path:`${output}/overview-${viewport.width}-${lens}.png`,animations:'disabled'})
  // A scrolled cross-origin frame can have layout before Chromium paints it.
  // Check actual pixels, rather than publishing a blank compositor capture.
  await page.locator('.project-preview').scrollIntoViewIfNeeded()
  let paintedColours=0
  for(let attempt=0;attempt<5&&paintedColours<32;attempt++){
    const png=await iframe.screenshot({animations:'disabled'})
   paintedColours=await page.evaluate(async base64=>{
    const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode()
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height
    const context=canvas.getContext('2d');context.drawImage(image,0,0)
    const data=context.getImageData(0,0,image.width,image.height).data,colours=new Set()
    for(let i=0;i<data.length&&colours.size<64;i+=4)colours.add(`${data[i]},${data[i+1]},${data[i+2]}`)
    return colours.size
   },png.toString('base64'))
  }
  assert(paintedColours>=32,'actual exported preview is visibly painted')
  if(viewport.width===390)await page.screenshot({path:`${output}/preview-${viewport.width}-${lens}.png`,animations:'disabled'})

  for(const criterion of doc.criteria){
   const trigger=page.locator('.criterion-button').filter({hasText:criterion.text})
   await trigger.click();assert.equal(await trigger.getAttribute('aria-pressed'),'true')
   const detail=page.getByRole('region',{name:'Criterion detail'})
   assert(await detail.getByText(criterion.text,{exact:true}).isVisible())
   if(criterion.evidence.length===0)assert(await detail.getByText('No evidence events exported for this criterion.').isVisible())
  }
  report.actualExport.push({viewport,lens,geometry,selectionChecks:doc.criteria.length,sandboxOpaqueOrigin:true,inert:true,paintedColours,semantics})
  await context.close()
 }
 // Fixtures exercise denied behavior independently from the real-export screenshots.
 const context=await browser.newContext()
 const page=await context.newPage(),denials=[]
 page.on('console',m=>{if(m.type()==='error')denials.push(m.text())})
 const fixture=structuredClone(doc),artifact=fixture.artifacts.find(a=>/\.html?$/i.test(a.path))
 assert(artifact,'actual export has an HTML artifact')
 fixture.blobs[artifact.sha256]='<h1>Isolated synthetic preview fixture</h1><script>window.__previewExecuted=true;fetch("https://preview-probe.invalid/script")</script><img src="https://preview-probe.invalid/image"><form action="https://preview-probe.invalid/form" method="post"><button>Submit fixture</button></form>'
 await context.route('**/*',route=>{
  const url=new URL(route.request().url())
  if(url.origin!==origin){report.externalRequests.push(url.href);return route.abort()}
  if(url.pathname==='/run.json')return route.fulfill({json:fixture})
  return route.continue()
 })
 await page.goto(origin);await page.locator('iframe').waitFor()
 const frame=await page.locator('iframe').elementHandle().then(el=>el.contentFrame())
 await frame.getByRole('heading',{name:'Isolated synthetic preview fixture'}).waitFor()
 assert.equal(await frame.evaluate(()=>window.__previewExecuted),undefined)
 await frame.waitForLoadState('load')
 await frame.evaluate(()=>document.forms[0].submit())
 // Observe queued network/navigation attempts after the synchronous denials.
 await page.waitForTimeout(300)
 assert.equal(report.externalRequests.length,0,'no outgoing request from preview scripts/images/forms')
 assert(denials.some(text=>text.includes('Blocked script execution')),'script denial witnessed')
 assert(denials.some(text=>/form submission|form-action|allow-forms/i.test(text)),'form denial witnessed')
 fixture.blobs={};await page.reload();await page.getByText('No project preview available.',{exact:true}).waitFor()
 assert.equal(await page.locator('iframe').count(),0)
 report.fixtureDenials=denials
 await context.close()
 assert.equal(report.unexpectedErrors.length,0)
 await writeFile(output+'/stitch-check.json',JSON.stringify(report,null,2)+'\n')
 console.log(`PASS: 4 real-export viewport/lens states, 12 real criterion selections, opaque/inert preview; hostile script/form/network denied; missing-body empty state. ${output}`)
}finally{await browser?.close();await server?.close()}
