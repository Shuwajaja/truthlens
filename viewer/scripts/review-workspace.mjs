// Manual/release only: actual demo evidence path, both approved themes and viewports.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createServer,preview} from 'vite';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {execFileSync} from 'node:child_process';
import axe from 'axe-core';
import {reviewDialog,reviewIncomplete,reviewScrollSample} from './a11y-review.mjs';
export async function reviewWorkspace({mode='full'}={}){
 const output=process.env.WORKSPACE_OUTPUT??'.screenshots/review';await mkdir(output,{recursive:true});
 const doc=JSON.parse(await readFile(new URL('../fixtures/demo-run.json',import.meta.url),'utf8'));
 const reports=[],regressions=[],errors=[],manual=[],keyboard=[];
 const sessions=new WeakMap();let isolation,production;
 const server=await createServer({mode:'development',server:{host:'127.0.0.1',port:0,strictPort:true}});await server.listen();
 const browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE});
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 async function scan(page,name){
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name}: no page overflow`);
  const result=await new AxeBuilder({page}).analyze();
  reports.push({name,violations:result.violations,incomplete:result.incomplete.map(({id,impact,nodes})=>({id,impact,nodes:nodes.map(({target,failureSummary})=>({target,failureSummary}))})),passes:result.passes.map(({id})=>id)});
  const items=await reviewIncomplete(page,result);
  let dialog=null;
  if(await page.getByRole('dialog').count()){
   let cdp=sessions.get(page);if(!cdp){cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('Accessibility.enable');sessions.set(page,cdp)}
   dialog=await reviewDialog(page,cdp);
  }
  const scrollSample=await reviewScrollSample(page,items);manual.push({name,items,dialog,scrollSample});
  assert(!items.some(item=>item.outcome==='low-contrast'),`${name}: composited incomplete contrast`);
  if(mode==='full')await page.screenshot({path:`${output}/${name}.png`});
  console.log(`${name}: ${result.violations.length} axe violations (${result.violations.filter(v=>['serious','critical'].includes(v.impact)).length} serious/critical)`);
 }
 async function navigate(page,label,mobile){
  if(mobile)await page.getByRole('button',{name:'Navigation',exact:true}).click();
  await page.getByRole('navigation',{name:'Viewer navigation'}).getByRole('button',{name:label,exact:true}).click();
  if(mobile)await page.getByRole('dialog').waitFor({state:'hidden'});
 }
 try{
 if(mode!=='isolation')for(const theme of ['petrol-porcelain','cool-graphite'])for(const lens of ['client','developer'])for(const [width,height] of [[1440,900],[390,844]]){
  const mobile=width===390,name=`${theme}-${lens}-${width}`;
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',error=>errors.push({name,message:error.message}));
  await context.addInitScript(({theme,lens})=>{if(window===window.top){localStorage.setItem('truthlens.theme',theme);localStorage.setItem('tl-lens',lens)}},{theme,lens});
  let releaseRun;const runGate=new Promise(resolve=>{releaseRun=resolve});
  await page.route('**/run.json',async route=>{await runGate;await route.continue()});
  await page.goto(origin);
  const loading=page.getByRole('heading',{name:'Loading run data…',exact:true});await loading.waitFor();
  assert(await loading.evaluate(node=>document.activeElement!==node&&getComputedStyle(node).outlineStyle==='none'),'loading has no heading autofocus/white outline');
  if(mode==='full')await page.screenshot({path:`${output}/${name}-loading.png`});
  releaseRun();await page.getByRole('main').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert(await page.evaluate(()=>document.activeElement===document.body),'initial load never autofocuses heading');
  assert(await page.getByRole('heading',{level:1}).evaluate(node=>getComputedStyle(node).outlineStyle==='none'),'no initial heading outline');
  await page.setViewportSize({width:width===390?1200:767,height});
  await page.setViewportSize({width,height});
  assert(await page.evaluate(()=>document.activeElement===document.body),'viewport change never steals focus');
  await page.keyboard.press('Tab');
  assert(await page.getByRole('link',{name:'Skip to content'}).evaluate(node=>document.activeElement===node&&getComputedStyle(node).outlineStyle!=='none'),'keyboard focus remains visible');
  await page.keyboard.press('Escape');await page.locator('body').click({position:{x:2,y:2}});
  await scan(page,`${name}-overview`);
  if(mode==='modes'){await context.close();continue}
  // Hit testing proves the last criterion is not underneath fixed navigation.
  const last=page.locator('.criterion-button').filter({hasText:doc.criteria.at(-1).text});
  await last.scrollIntoViewIfNeeded();assert(await last.evaluate(node=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'last criterion hit-test');
  await last.click();
  const inspector=mobile?page.getByRole('dialog',{name:'Context inspector'}):page.getByRole('complementary',{name:'Context inspector'});
  await inspector.getByText('No evidence events exported for this criterion.',{exact:true}).waitFor();
  await scan(page,`${name}-unchecked`);
  if(mobile){await page.keyboard.press('Escape');await inspector.waitFor({state:'hidden'});await last.focus()}
  const failed=doc.criteria.find(c=>c.status==='unmet');
  await page.locator('.criterion-button').filter({hasText:failed.text}).click();
  await inspector.getByRole('button',{name:'Open event record'}).click();
  const event=doc.events.find(e=>e.id===failed.evidence[0]);
  await inspector.getByRole('heading',{name:`Event: ${event.summary}`,exact:true}).waitFor();
  assert((await inspector.innerText()).includes('Integrity is not approval'));
  assert(await inspector.getByRole('heading',{name:`Event: ${event.summary}`,exact:true}).evaluate(node=>document.activeElement===node),'focus enters opened record');
  await scan(page,`${name}-event`);
  for(const tabName of ['Tests','Files','Time','Overview']){
   const active=inspector.getByRole('tab',{selected:true});await active.focus();await page.keyboard.press('ArrowRight');
   const tab=inspector.getByRole('tab',{name:tabName,exact:true});await tab.waitFor();await page.waitForFunction(el=>el.getAttribute('aria-selected')==='true',await tab.elementHandle());
   await scan(page,`${name}-event-tab-${tabName.toLowerCase()}`);
  }
  if(mobile){await page.keyboard.press('Escape');await inspector.waitFor({state:'hidden'})}
  else await inspector.getByRole('button',{name:'Back to criterion'}).click();
  // Actual iframe content, bounds and opaque sandbox, not a generated replacement.
  const frame=page.locator('.preview-canvas iframe');await frame.scrollIntoViewIfNeeded();
  assert.equal(await frame.getAttribute('sandbox'),'');assert.equal(await frame.getAttribute('referrerpolicy'),'no-referrer');
  const artifact=doc.artifacts.find(a=>a.path==='index.html');assert((await frame.getAttribute('srcdoc')).includes(doc.blobs[artifact.sha256]));
  assert((await frame.getAttribute('srcdoc')).includes("connect-src 'none'"));
  assert(await frame.evaluate(node=>getComputedStyle(node).transform==='none'),'no legacy scaled iframe');
  const inside=await (await frame.elementHandle()).contentFrame();
  const originalBody=await inside.locator('body').innerText();assert(originalBody.trim().length>0,'actual preview body rendered');
  assert(await frame.evaluate(node=>{const r=node.getBoundingClientRect(),p=node.parentElement.getBoundingClientRect();return Math.abs(r.width-(p.width-2))<2&&Math.abs(r.height-(p.height-2))<2}),'frame fills canvas without legacy scaling/white gap');
  await scan(page,`${name}-preview`);
  await page.getByRole('button',{name:'Open preview file record'}).click();
  await inspector.getByRole('heading',{name:'File: index.html',exact:true}).waitFor();
  assert((await inspector.innerText()).includes(artifact.sha256));await scan(page,`${name}-file`);
  for(const block of await inspector.locator('pre').all()){
   if(!await block.isVisible()||!await block.evaluate(el=>el.scrollWidth>el.clientWidth||el.scrollHeight>el.clientHeight))continue;
   assert(await block.evaluate(el=>el.tabIndex===0),'overflowing recorded text is keyboard reachable');
   let reached=false;for(let step=0;step<80;step++){await page.keyboard.press('Tab');if(await block.evaluate(el=>el===document.activeElement)){reached=true;break}}
   assert(reached,'Tab reaches overflowing recorded text');
   assert(await block.evaluate(el=>el.matches(':focus-visible')&&getComputedStyle(el).outlineStyle!=='none'),'overflow focus visible');
   const horizontal=await block.evaluate(el=>el.scrollWidth>el.clientWidth);await block.evaluate(el=>{el.scrollLeft=0;el.scrollTop=0});
   await page.keyboard.press(horizontal?'ArrowRight':'ArrowDown');await page.waitForFunction(el=>el.scrollLeft>0||el.scrollTop>0,await block.elementHandle());
   keyboard.push({name,overflowReachable:true,visibleFocus:true,nativeScroll:true});
  }
  if(mobile){await page.keyboard.press('Escape');await inspector.waitFor({state:'hidden'})}
  else await inspector.getByRole('button',{name:'Back to criterion'}).click();
  for(const [view,label] of [['claimed-vs-proven','Claimed vs proven'],['timeline','Timeline'],['agent-story','Agent story']]){
   await navigate(page,label,mobile);await page.evaluate(()=>scrollTo(0,0));
   assert.equal(new URL(page.url()).searchParams.get('view'),view);await scan(page,`${name}-${view}`);
  }
  await page.reload();await page.getByRole('main').waitFor();assert.equal(new URL(page.url()).searchParams.get('view'),'agent-story');
  await navigate(page,'Overview',mobile);await page.goBack();await page.getByRole('heading',{level:1,name:'Agent Story',exact:true}).waitFor();
  if(mobile){await page.getByRole('button',{name:'Navigation',exact:true}).click();await scan(page,`${name}-navigation`);await page.keyboard.press('Escape')}
  regressions.push({name,initialFocus:true,keyboardFocus:true,lastCriterionHitTest:true,previewOriginalBytes:true,previewCanvasFilled:true});
  await context.close();
 }
 isolation=await reviewPreviewIsolation(browser,origin,doc);
 if(mode==='full')production=await reviewLocalBuild(browser,output,doc);
 // Extra narrow/reflow checks use the same demo, never a private source.
 if(mode==='full')for(const width of [320,720]){
  const page=await browser.newPage({viewport:{width,height:844}});await page.goto(origin);await page.getByRole('main').waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`reflow ${width}`);await page.close();
 }
 }finally{
  await writeFile(`${output}/axe-results.json`,JSON.stringify({mode,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browserVersion:browser.version(),axeVersion:axe.version,reports,regressions,errors,manual,keyboard,isolation,production},null,2)+'\n');
  await browser.close();await server.close();
 }
 assert.equal(errors.length,0,'no browser errors');
 const violations=reports.flatMap(r=>r.violations.map(v=>({name:r.name,id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})));
 if(violations.length)console.log(JSON.stringify(violations,null,2));
 assert.equal(violations.filter(v=>['serious','critical'].includes(v.impact)).length,0,'no serious/critical axe violations');
 return {scans:reports.length,violations,regressions:regressions.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(await reviewWorkspace());

export async function reviewPreviewIsolation(browser,origin,doc){
 const context=await browser.newContext(),page=await context.newPage(),denials=[],externalRequests=[];
 const fixture=structuredClone(doc),artifact=fixture.artifacts.find(a=>/\.html?$/i.test(a.path));assert(artifact);
 fixture.blobs[artifact.sha256]='<h1>Isolated synthetic preview fixture</h1><script>window.__previewExecuted=true;fetch("https://preview-probe.invalid/script")</script><img src="https://preview-probe.invalid/image"><form action="https://preview-probe.invalid/form" method="post"><button>Submit fixture</button></form>';
 page.on('console',message=>{if(message.type()==='error')denials.push(message.text())});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin){externalRequests.push(url.href);return route.abort()}if(url.pathname==='/run.json')return route.fulfill({json:fixture});return route.continue()});
 try{
  await page.goto(origin);const iframe=page.locator('iframe');await iframe.waitFor();
  const frame=await (await iframe.elementHandle()).contentFrame();await frame.getByRole('heading',{name:'Isolated synthetic preview fixture'}).waitFor();
  assert.equal(await frame.evaluate(()=>window.__previewExecuted),undefined);
  assert.equal(await frame.evaluate(()=>{try{void parent.document.body;return true}catch{return false}}),false);
  assert(await page.locator('.preview-canvas').evaluate(el=>el.inert));
  await frame.waitForLoadState('load');await frame.evaluate(()=>document.forms[0].submit());await page.waitForTimeout(300);
  assert.equal(externalRequests.length,0);assert(denials.some(text=>text.includes('Blocked script execution')));assert(denials.some(text=>/form submission|form-action|allow-forms/i.test(text)));
  fixture.blobs={};await page.reload();await page.getByText('No project preview available.',{exact:true}).waitFor();assert.equal(await page.locator('iframe').count(),0);
  return {fixture:'Synthetic hostile HTML and missing blob; never recorded evidence',scriptDenied:true,formDenied:true,opaqueOrigin:true,inert:true,externalRequests,missingBlobEmpty:true,denials};
 }finally{await context.close()}
}

async function reviewLocalBuild(browser,output,doc){
 const server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}}),checks=[];
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 try{
  const {access,readdir}=await import('node:fs/promises');
  let fixtureExists=true;try{await access('dist/run.json')}catch{fixtureExists=false}assert(!fixtureExists,'no production run fixture');
  for(const file of await readdir('dist/assets'))if(file.endsWith('.js'))assert(!(await readFile('dist/assets/'+file,'utf8')).includes(doc.run.run_id),'no bundled fixture contents');
  for(const theme of ['petrol-porcelain','cool-graphite'])for(const [width,height] of [[1440,900],[390,844]]){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),requests=[];
   await context.addInitScript(theme=>{if(window===window.top)localStorage.setItem('truthlens.theme',theme)},theme);
   page.on('request',request=>{if(['fetch','xhr'].includes(request.resourceType()))requests.push(request.url())});
   await page.goto(origin);await page.getByRole('heading',{name:'Not connected',exact:true}).waitFor();
   assert.equal(requests.length,0,'disconnected production build never fetches source data');
   assert(!(await page.locator('body').innerText()).includes(doc.run.run_id));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const axe=await new AxeBuilder({page}).analyze();assert.equal(axe.violations.length,0,'offline local build accessibility');
   await page.screenshot({path:`${output}/${theme}-local-build-${width}.png`});checks.push({theme,width,height,sourceRequests:requests,fixtureBundled:false,axeViolations:0});await context.close();
  }
  return checks;
 }finally{await server.close()}
}
