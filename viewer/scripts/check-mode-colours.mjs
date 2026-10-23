// Phase A supersedes the former Stitch geometry/colour assertions.
const {readFile:readShellSource}=await import('node:fs/promises');
if((await readShellSource(new URL('../src/App.tsx',import.meta.url),'utf8')).includes('<WorkspaceShell')){
 process.env.WORKSPACE_OUTPUT??=process.env.MODE_OUTPUT??'.screenshots/modes';
 await (await import('./review-workspace.mjs')).reviewWorkspace({mode:'modes'});
 process.exit(0);
}
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {preview} from 'vite'
import {blockedPreviewScript} from './preview-console.mjs'
process.env.PLAYWRIGHT_BROWSERS_PATH??=fileURLToPath(new URL('../../.venv/playwright',import.meta.url))
const {chromium}=await import('playwright')
const before=process.env.MODE_PHASE==='before',output=process.env.MODE_OUTPUT??'.screenshots/modes'
const checks=[],errors=[]
let server,browser
try{
 await mkdir(output,{recursive:true})
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}})
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE})
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce',locale:'en-GB',timezoneId:'Europe/Berlin'})
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort())
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!blockedPreviewScript(m))errors.push(m.text())})
  await page.goto(origin);await page.locator('main h1').waitFor();await page.evaluate(()=>document.fonts.ready)
  for(const lens of ['client','developer']){
   const button=page.getByRole('group',{name:'View lens'}).getByRole('button',{name:lens==='client'?'Client':'Developer',exact:true})
   await button.focus();await page.keyboard.press('Enter')
   assert.equal(await button.getAttribute('aria-pressed'),'true')
   for(const [index,view] of ['overview','claims','timeline','agent-story'].entries()){
    await page.getByRole('navigation',{name:'Viewer navigation',exact:true}).getByRole('button').nth(index).click()
    await page.locator('main h1').waitFor();await page.evaluate(()=>window.scrollTo(0,0))
    assert(await button.isVisible());assert.equal(await button.getAttribute('aria-pressed'),'true')
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow')
    if(!before){
     assert.equal(await page.locator('.app-shell').getAttribute('data-lens'),lens)
     if(viewport.width===390){
      const label=page.locator('.compact-header .mode-label');assert.equal(await label.textContent(),lens==='client'?'Client':'Developer')
      await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await page.evaluate(()=>new Promise(requestAnimationFrame))
      assert(await label.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.top>=0&&r.bottom<=56&&el.contains(hit)}),'mobile mode label stays visible while scrolled')
      await page.evaluate(()=>window.scrollTo(0,0))
     }
     const proof=await page.evaluate(lens=>{
      const rgb=value=>{const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width=canvas.height=1;ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>v/255)}
      const lum=c=>c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)
      const ratio=(a,b)=>{const x=lum(rgb(a)),y=lum(rgb(b));return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
      const root=getComputedStyle(document.documentElement),header=getComputedStyle(document.querySelector('.compact-header')),active=getComputedStyle(document.querySelector('.lens-toggle [aria-pressed=true]'))
      const token=name=>root.getPropertyValue('--'+name).trim(),measurements=[]
      const add=(name,fg,bg,threshold)=>measurements.push({name,fg,bg,threshold,ratio:ratio(fg,bg)})
      add('active label',active.color,active.backgroundColor,4.5)
      for(const surface of ['bg','surface','surface-2']){
       add('header rail/'+surface,header.borderTopColor,token(surface),3)
       add('selected outline/'+surface,active.borderBottomColor,token(surface),3)
       add('mode text/'+surface,token('mode-'+lens),token(surface),4.5)
      }
      add('selected outline/inside',active.borderBottomColor,active.backgroundColor,3)
      add('focus/selected fill',token('focus'),active.backgroundColor,3)
      for(const el of document.querySelectorAll('.developer-only')){
       const style=getComputedStyle(el);add('developer detail rail',style.borderInlineStartColor,token('surface'),3)
       add('developer rail/surface-2',style.borderInlineStartColor,token('surface-2'),3)
      }
      const visibleLabel=document.querySelector('.lens-toggle [aria-pressed=true]').textContent
      return{measurements,visibleLabel,headerRailWidth:header.borderTopWidth,selectedRailWidth:active.borderBottomWidth,modeToken:token('mode-'+lens),statusTokens:['success','error','warning'].map(token)}
     },lens)
     assert.equal(proof.visibleLabel,lens==='client'?'Client':'Developer')
     assert(parseFloat(proof.headerRailWidth)>=2&&parseFloat(proof.selectedRailWidth)>=2)
     assert(!proof.statusTokens.includes(proof.modeToken),'mode is not status')
     for(const m of proof.measurements)assert(m.ratio>=m.threshold,`${m.name}: ${m.ratio} < ${m.threshold}`)
     assert.equal(await page.locator('.developer-only').count()>0,lens==='developer'&&(view==='overview'||view==='timeline'||view==='agent-story'))
     checks.push({viewport,lens,view,...proof})
    }
    await page.screenshot({path:`${output}/${view}-${viewport.width}-${lens}.png`,animations:'disabled'})
   }
  }
  await context.close()
 }
 assert.equal(errors.length,0,'unexpected browser errors')
 await writeFile(`${output}/mode-results.json`,JSON.stringify({commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),phase:before?'before':'after',checks,errors},null,2)+'\n')
 console.log(`PASS: 16 ${before?'baseline captures':'mode/contrast states'}; no page overflow or unexpected errors. ${output}`)
}finally{await browser?.close();await server?.close()}
