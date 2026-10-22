import { preview } from 'vite';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(new URL('../../.venv/playwright',import.meta.url));
const output=process.env.P3_SHOTS ?? '.screenshots/review';
await mkdir(output,{recursive:true});
let server;let browser;
let stage='start'; let failure=false;
try{
 const {chromium}=await import('playwright');
 const {default:AxeBuilder}=await import('@axe-core/playwright');
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});
 browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE});
 const origin='http://127.0.0.1:'+server.httpServer.address().port;
 for(const width of [1440,420]){
  const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'Europe/Berlin',reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  page.on('pageerror',()=>{failure=true});
  page.on('console',message=>{if(message.type()==='error')failure=true});
  await page.goto(origin);
  await page.locator('main h1').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  for(const [i,name] of ['overview','claimed','timeline','story'].entries()){
   stage=name+'-'+width;
   await page.getByRole('navigation',{name:'Viewer navigation',exact:true}).getByRole('button').nth(i).click();
   await page.locator('main h1').waitFor();
   if(failure)throw new Error('Browser error');
   await page.evaluate(()=>window.scrollTo(0,0));
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   if(overflow)throw new Error('Page overflow');
   const invalidType=await page.evaluate(()=>{
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode())){
     const element=node.parentElement;
     if(!node.textContent.trim()||!element||element.closest('svg')||!element.getClientRects().length||getComputedStyle(element).visibility==='hidden')continue;
     const style=getComputedStyle(element);
     if(![12,14,16,20,28].includes(parseFloat(style.fontSize))||![400,500,600].includes(Number(style.fontWeight)))return {tag:element.tagName,size:style.fontSize,weight:style.fontWeight};
    }
    return false;
   });
   if(invalidType){console.error(invalidType);throw new Error('Type scale violation');}
   const axe=await new AxeBuilder({page}).withRules(['color-contrast']).analyze();
   if(axe.violations.length)throw new Error('Contrast violations');
   await page.screenshot({path:output+'/'+name+'-'+width+'.png',fullPage:true,animations:'disabled'});
  }
  await context.close();
 }
 console.log('8 screenshots (4 views,1440+420), no contrast violations, browser errors or page overflow: '+output);
} catch(error){ console.error('P3 screenshots failed at '+stage+' ('+error.name+')');process.exitCode=1;}
finally{await browser?.close();await server?.close();}
