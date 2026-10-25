// Manual Phase E acceptance: real browser directory file input, synthetic bytes only.
import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import {execFileSync} from 'node:child_process'
import {mkdir,readFile,writeFile,symlink,readlink} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {preview} from 'vite'
import {chromium} from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import {reviewIncomplete} from '../scripts/a11y-review.mjs'
import {fixture} from '../tests/fixtures/local-folder.mjs'
const output=process.env.EVIDENCE_OUTPUT??'../docs/screenshots/feat/phase-e-open-export/utc'
const root=resolve('../.cache/phase-e-browser-fixtures'),good=fixture(),other=fixture(Buffer.from('Second synthetic evidence\r\n')),bad=fixture()
bad.files.set('ledger.jsonl',Buffer.from('damaged synthetic ledger\n'))
const reports=[],errors=[],downloads=[]
let server,browser,origin,testedCommit,dirty
before(async()=>{
 testedCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
 dirty=execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
 for(const [name,files] of [['good',good.files],['other',other.files],['bad',bad.files]])for(const [path,bytes] of files){const dest=resolve(root,name,path);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes)}
 for(const [path,bytes] of good.files){
  const dest=resolve(root,'linked',path);await mkdir(dirname(dest),{recursive:true})
  if(path.startsWith('blobs/')){const target=resolve(root,'good',path);try{await symlink(target,dest)}catch(e){if(e.code!=='EEXIST')throw e;assert.equal(await readlink(dest),target)}}
  else await writeFile(dest,bytes)
 }
 await mkdir(output,{recursive:true})
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});origin=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE,downloadsPath:resolve('../.cache/phase-e-downloads')})
})
after(async()=>{
 await browser?.close();await server?.close()
 await writeFile(`${output}/review.json`,JSON.stringify({testedCommit,dirty,timezone:process.env.TZ??'UTC',scope:'Synthetic fixtures; real browser File input and downloads. Native OS folder-picker UI, OS symlink detection, signature authentication, live services and human approval not established.',reports,downloads,errors},null,2)+'\n')
})
async function scan(page,name,screenshot=false){
 await page.evaluate(()=>document.fonts.ready)
 const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}))
 assert(layout.scroll<=layout.width,`no page overflow: ${JSON.stringify(layout)}`)
 const result=await new AxeBuilder({page}).analyze(),manual=await reviewIncomplete(page,result)
 // Keep review artifacts bounded: retain findings, not every successful axe node.
 reports.push({name,violations:result.violations.map(({id,impact,nodes})=>({id,impact,nodes:nodes.map(({target,failureSummary})=>({target,failureSummary}))})),incomplete:result.incomplete.map(({id,nodes})=>({id,nodes:nodes.map(({target})=>({target}))})),manual})
 if(screenshot)await page.screenshot({path:`${output}/${name}.png`})
 assert.equal(result.violations.length,0,JSON.stringify(result.violations.map(v=>({id:v.id,impact:v.impact}))))
 assert(!manual.some(v=>v.outcome==='low-contrast'));assert.deepEqual(errors,[])
}
async function downloaded(page,name){
 const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();const download=await pending,stream=await download.createReadStream(),chunks=[]
 for await(const chunk of stream)chunks.push(chunk)
 return {filename:download.suggestedFilename(),bytes:Buffer.concat(chunks)}
}
for(const width of [1440,390])for(const theme of ['petrol-porcelain','cool-graphite'])test(`${width} ${theme}: local folders, original downloads, derived export and existing views`,{timeout:90000},async t=>{
 const context=await browser.newContext({acceptDownloads:true,viewport:{width,height:width===390?844:900},reducedMotion:'reduce',timezoneId:process.env.TZ??'UTC'})
 t.after(()=>context.close())
 await context.addInitScript(theme=>{if(window===window.top){localStorage.setItem('truthlens.theme',theme);Object.defineProperty(window,'showDirectoryPicker',{value:undefined,configurable:true})}},theme)
 const page=await context.newPage(),requests=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/v1/**',async route=>{requests.push(route.request().method()+' '+new URL(route.request().url()).pathname);await route.fulfill({status:503,contentType:'application/json',body:'{}'})})
 await page.goto(origin);await page.getByRole('heading',{name:'Not connected',exact:true}).waitFor();assert.deepEqual(requests,[])
 await page.getByRole('button',{name:'Connect',exact:true}).click();await page.getByRole('alert').waitFor();assert(await page.getByRole('heading',{name:'Not connected',exact:true}).count())
 const initialRequests=[...requests]
 const choose=async name=>page.getByLabel('Choose local ledger folder',{exact:true}).setInputFiles(resolve(root,name))
 await choose('linked');await page.getByRole('alert').filter({hasText:'Referenced blob is missing'}).waitFor();await scan(page,`${width}-${theme}-symlink-rejected`)
 await choose('bad');await page.getByRole('alert').filter({hasText:'Local folder rejected'}).waitFor()
 assert.equal(await page.getByText('Original downloads',{exact:true}).count(),0)
 await scan(page,`${width}-${theme}-rejected`,true)
 await choose('good');await page.getByRole('heading',{name:'Synthetic local folder',exact:true}).waitFor()
 assert(await page.getByText(/Local folder · not authenticated/).count());assert.equal(await page.getByText('Signature checked',{exact:true}).count(),0)
 await page.getByText('Original downloads',{exact:true}).click()
 for(const [path,expected] of good.files){
  const name=path==='ledger.jsonl'?'ledger':path==='manifest.json'?'manifest':`evidence ${good.sha}`
  const actual=await downloaded(page,`Download original ${name}`);assert.deepEqual(actual.bytes,expected);assert.deepEqual(await readFile(resolve(root,'good',path)),expected)
  downloads.push({viewport:width,theme,file:path,bytes:actual.bytes.length,originalBytesEqual:true,sourceUnchanged:true})
 }
 const derived=await downloaded(page,'Download derived RunDoc'),document=JSON.parse(derived.bytes)
 assert.match(derived.filename,/derived/);assert.equal(document.provenance,'derived');assert.equal(document.verified,false);assert.equal(document.integrity,'hash-only')
 await scan(page,`${width}-${theme}-downloads`,true)
 if(width===390)await page.getByRole('button',{name:'Inspector',exact:true}).click()
 await page.getByRole('button',{name:'Open event record',exact:true}).click()
 await page.getByRole('heading',{name:'Event: Tests run by TruthLens: 1 passed, 0 failed, 0 skipped',exact:true}).waitFor()
 await scan(page,`${width}-${theme}-event-inspector`)
 if(width===390){await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert(await page.getByRole('button',{name:'Inspector',exact:true}).evaluate(node=>node===document.activeElement))}
 const navigate=async name=>{
  if(width===390)await page.getByRole('button',{name:'Navigation',exact:true}).click()
  await page.getByRole('navigation',{name:'Viewer navigation'}).getByRole('button',{name,exact:true}).click()
  if(width===390)await page.getByRole('dialog').waitFor({state:'hidden'})
 }
 if(width===390)await page.getByRole('button',{name:'Navigation',exact:true}).click()
 await page.getByRole('group',{name:'View lens'}).getByRole('button',{name:'Developer',exact:true}).click()
 if(width===390){await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'})}
 await navigate('Changes');await page.getByRole('heading',{name:'Changes',exact:true}).waitFor();await scan(page,`${width}-${theme}-changes`)
 await navigate('Chain');await page.getByTestId('review-outcome').filter({hasText:'Not checked'}).waitFor();await scan(page,`${width}-${theme}-unchecked-chain`)
 await choose('other');await page.getByRole('heading',{name:'Synthetic local folder',exact:true}).waitFor();await navigate('Compare')
 await page.getByLabel('Comparison snapshot').selectOption({index:1});await page.getByRole('region',{name:'Right snapshot'}).waitFor();await scan(page,`${width}-${theme}-compare`)
 await page.getByRole('region',{name:'Workspace tabs'}).getByRole('button',{name:'Open Runs',exact:true}).click();await page.getByRole('heading',{name:'Runs',exact:true}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Open run: Synthetic local folder',exact:true}).count(),2)
 assert.deepEqual(requests,initialRequests,'local opening, views and downloads issue no service request')
 const saved=await page.evaluate(()=>localStorage.getItem('truthlens.workspace-navigation.v1'))
 assert(!saved.includes('Original evidence'));assert(!saved.includes('blobs/'));assert(!saved.includes('Synthetic agent'))
 await page.reload();await page.getByRole('heading',{name:'Not connected',exact:true}).waitFor();assert.equal(await page.getByText('Original downloads',{exact:true}).count(),0)
})
