// Targeted manual/release evidence for source-aware workspace navigation.
import assert from 'node:assert/strict';
import {mkdir,readFile,realpath,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer,preview} from 'vite';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {reviewIncomplete} from './a11y-review.mjs';
const output=process.env.WORKSPACE_OUTPUT??'../docs/screenshots/w6/issue-158-workspace-navigation';
await mkdir(output,{recursive:true});
const fixture=JSON.parse(await readFile(new URL('../fixtures/demo-run.json',import.meta.url),'utf8'));
const testedCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const reports=[],errors=[],checks=[];
const server=await createServer({mode:'development',server:{host:'127.0.0.1',port:0,strictPort:true,fs:{allow:[process.cwd(),await realpath('node_modules')]}}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE});
const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
async function scan(page,name){
 await page.evaluate(async()=>{await document.fonts.load('14px "Plus Jakarta Sans Variable"');await document.fonts.load('14px "JetBrains Mono Variable"');if(!document.fonts.check('14px "Plus Jakarta Sans Variable"'))throw Error('Prose font unavailable')});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: page fits`);
 const result=await new AxeBuilder({page}).analyze(),manual=await reviewIncomplete(page,result);
 reports.push({name,violations:result.violations,incomplete:result.incomplete.map(({id,impact,nodes})=>({id,impact,nodes:nodes.map(({target,failureSummary})=>({target,failureSummary}))})),manual});
 await page.screenshot({path:`${output}/${name}.png`});
 assert(!result.violations.some(v=>['serious','critical'].includes(v.impact)),`${name}: serious/critical axe`);
 assert(!manual.some(item=>item.outcome==='low-contrast'),`${name}: incomplete contrast`);
 console.log(`${name}: ${result.violations.length} axe violations`);
}
async function nav(page,label,mobile){if(mobile)await page.getByRole('button',{name:'Navigation',exact:true}).click();await page.getByRole('navigation',{name:'Viewer navigation'}).getByRole('button',{name:label,exact:true}).click();if(mobile)await page.getByRole('dialog').waitFor({state:'hidden'})}
let production;
try{
 for(const theme of ['petrol-porcelain','cool-graphite'])for(const [width,height] of [[1440,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage(),mobile=width===390,name=`${theme}-${width}`;
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(theme=>{if(window===window.top)localStorage.setItem('truthlens.theme',theme)},theme);
  await page.goto(origin);await page.getByRole('main').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert(await page.evaluate(()=>document.activeElement===document.body),'initial focus');
  await nav(page,'Timeline',mobile);
  const tabs=page.getByRole('region',{name:'Workspace tabs'}),select=tabs.getByRole('button',{name:/^Select Timeline/});
  await select.focus();await page.keyboard.press('Enter');assert(await select.getAttribute('aria-pressed')==='true');
  await tabs.getByRole('button',{name:/^Pin Timeline/}).focus();await page.keyboard.press('Enter');
  await tabs.getByRole('button',{name:/^Close Timeline/}).focus();await page.keyboard.press('Enter');
  assert(await tabs.getByRole('button',{name:/^Select Overview/}).evaluate(n=>document.activeElement===n),'close neighbor focus');
  await tabs.locator('summary').focus();await page.keyboard.press('Enter');
  await tabs.getByRole('button',{name:/^Restore Timeline/}).focus();await page.keyboard.press('Enter');
  assert(await select.evaluate(n=>document.activeElement===n),'restore selected focus');
  assert(await tabs.getByRole('button',{name:/^Unpin Timeline/}).getAttribute('aria-pressed')==='true','pin retained');
  await scan(page,`${name}-restored`);
  await nav(page,'Overview',mobile);
  const last=page.locator('.criterion-button').filter({hasText:fixture.criteria.at(-1).text});await last.scrollIntoViewIfNeeded();
  assert(await last.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'last criterion reachable');
  await last.focus();await page.keyboard.press('Enter');if(mobile){await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'})}
  await scan(page,`${name}-criteria`);
  await tabs.getByRole('button',{name:'Open Runs'}).click();await page.getByRole('heading',{name:'Runs',exact:true}).waitFor();
  assert(await page.getByRole('button',{name:`Open run: ${fixture.run.project}`}).count()===1,'one supplied run');
  await scan(page,`${name}-runs`);
  await page.goto(`${origin}/?source=missing&run=absent&view=timeline`);await page.getByRole('heading',{name:'Run unavailable'}).waitFor();
  await scan(page,`${name}-unavailable`);
  await page.reload();await page.getByRole('heading',{name:'Run unavailable'}).waitFor();
  await page.getByRole('button',{name:'Return to Runs'}).click();await page.getByRole('heading',{name:'Runs',exact:true}).waitFor();
  await context.close();
  const memory=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),memoryPage=await memory.newPage();
  await memory.addInitScript(theme=>{if(window!==window.top)return;localStorage.setItem('truthlens.theme',theme);Storage.prototype.setItem=function(){throw Error('unavailable')}},theme);
  await memoryPage.goto(origin);await memoryPage.getByText('Unsaved on this device.').waitFor();await scan(memoryPage,`${name}-unsaved`);await memory.close();
  checks.push({name,keyboard:'select/pin/close/restore passed',lastCriterion:'hit-test and keyboard passed',unavailableReload:'passed'});
 }
 production=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});
 const productionOrigin=`http://127.0.0.1:${production.httpServer.address().port}`;
 for(const theme of ['petrol-porcelain','cool-graphite'])for(const [width,height] of [[1440,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),requests=[];
  await context.addInitScript(theme=>{if(window===window.top)localStorage.setItem('truthlens.theme',theme)},theme);
  page.on('request',request=>{if(['fetch','xhr'].includes(request.resourceType()))requests.push(request.url())});
  await page.goto(productionOrigin+'/?source=missing&run=absent&view=timeline');await page.getByRole('heading',{name:'Not connected'}).waitFor();
  assert.equal(requests.length,0,'production zero source requests');assert(!(await page.content()).includes(fixture.run.run_id),'production no fixture');
  await scan(page,`${theme}-${width}-production`);await context.close();
 }
 await writeFile(`${output}/review.json`,JSON.stringify({testedCommit,viewports:[[1440,900],[390,844]],themes:['petrol-porcelain','cool-graphite'],reports,checks,errors,scope:'Targeted changed states; unrestricted axe with incomplete contrast manual inspection. Unrelated existing flows not repeated.'},null,2)+'\n');
 assert.equal(errors.length,0,'no browser errors');
}finally{await browser.close();await server.close();await production?.httpServer.close()}
