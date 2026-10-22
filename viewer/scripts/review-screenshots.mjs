import {blockedPreviewScript} from './preview-console.mjs';
import {preview} from 'vite';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {germanUI} from './check-language.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH??=fileURLToPath(new URL('../../.venv/playwright',import.meta.url));
const output=process.env.P3_SHOTS??'.screenshots/review';
await mkdir(output,{recursive:true});
let server,browser,stage='start',failure=false,shots=0,lensSuffix='';
const lenses=[...new Set((process.env.P3_LENSES??'client').split(','))];
const check=(condition,description)=>{if(!condition)throw new Error('P3 check: '+description)};
try{
 check(lenses.length>0&&lenses.every(lens=>['client','developer'].includes(lens)),'supported lenses');
 const {chromium}=await import('playwright');
 const {default:AxeBuilder}=await import('@axe-core/playwright');
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});
 browser=await chromium.launch({executablePath:process.env.REVIEW_BROWSER_EXECUTABLE});
 const origin='http://127.0.0.1:'+server.httpServer.address().port;
 async function audit(page){
  check(!failure,'browser errors');
  check(await page.evaluate(()=>document.documentElement.lang==='en')&&await page.title()==='TruthLens','English document metadata');
  const german=await page.evaluate(({source,flags})=>{
   const pattern=new RegExp(source,flags),text=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
   while(text.nextNode()){
    const element=text.currentNode.parentElement;
    if(element&&!element.closest('script,style')&&element.checkVisibility()&&pattern.test(text.currentNode.textContent))return true;
   }
   return [...document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')].some(element=>['aria-label','title','placeholder','alt'].some(name=>pattern.test(element.getAttribute(name)??'')));
  },{source:germanUI.source,flags:germanUI.flags});
  check(!german,'English text and accessible names');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow');
  const obsoleteGreen=await page.evaluate(()=>[...document.querySelectorAll('body *')].some(element=>{
   if(!element.checkVisibility())return false;
   const style=getComputedStyle(element);
   return ['color','backgroundColor','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','outlineColor','fill','stroke'].some(key=>['rgb(28, 220, 68)','rgb(34, 197, 94)','rgb(63, 207, 142)'].includes(style[key]));
  }));
  check(!obsoleteGreen,'no retired green in the UI');
  const invalidType=await page.evaluate(()=>{
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
   while((node=walker.nextNode())){
    const element=node.parentElement;
    if(!node.textContent.trim()||!element||element.closest('svg')||!element.checkVisibility())continue;
    const style=getComputedStyle(element);
    if(![12,14,16,20,28].includes(parseFloat(style.fontSize))||![400,500,600].includes(Number(style.fontWeight)))return {tag:element.tagName,size:style.fontSize,weight:style.fontWeight};
   }
   return false;
  });
  if(invalidType)console.error(invalidType);
  check(!invalidType,'type scale');
  const axe=await new AxeBuilder({page}).withRules(['color-contrast']).analyze();
  check(axe.violations.length===0,'contrast');
 }
 async function branding(page){
  const colours=await page.evaluate(()=>{
   const colour=selector=>getComputedStyle(document.querySelector(selector)).color;
   return {truth:colour(document.querySelector('.brand-name')?'.brand-name':'.sidebar-brand > span'),lens:colour('.brand-lens'),met:colour('[data-testid=met-count] .text-ok'),hash:colour('.integrity-badge [data-slot=status-badge]')};
  });
  check(colours.truth==='rgb(244, 244, 245)'&&colours.lens==='rgb(244, 244, 245)','provisional Stitch neutral brand');
  check(colours.met==='rgb(16, 185, 129)'&&colours.hash==='rgb(161, 161, 170)','Stitch success and neutral hash seal');
  // Inspect the built ICO's embedded PNG along with the directly served images.
  const ico=await readFile(new URL('../dist/favicon.ico',import.meta.url));
  const icoPng=ico.subarray(ico.readUInt32LE(18),ico.readUInt32LE(18)+ico.readUInt32LE(14)).toString('base64');
  const assets=await page.evaluate(async icoPng=>Promise.all(['logo-wordmark.svg','logo-icon.svg','favicon.svg','favicon.ico','apple-touch-icon.png'].map(async name=>{
   const image=new Image();image.src=name.endsWith('.ico')?'data:image/png;base64,'+icoPng:'/'+name;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
   const context=canvas.getContext('2d');context.drawImage(image,0,0);
   const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
   let green=0,obsolete=0;
   for(let i=0;i<pixels.length;i+=4){
    if(pixels[i]===59&&pixels[i+1]===130&&pixels[i+2]===246&&pixels[i+3]===255)green++;
    if(pixels[i+3]===255&&((pixels[i]===34&&pixels[i+1]===197&&pixels[i+2]===94)||(pixels[i]===63&&pixels[i+1]===207&&pixels[i+2]===142)))obsolete++;
   }
   return {green,obsolete,width:image.naturalWidth,height:image.naturalHeight};
  })),icoPng);
  check(assets.every(asset=>asset.green>0&&asset.obsolete===0),'all logo/icon assets use primary blue');
  check(assets[3].width===32&&assets[3].height===32&&assets[4].width===180&&assets[4].height===180,'favicon and touch icon sizes');
 }
 async function capture(page,name,fullPage){await page.screenshot({path:output+'/'+name+lensSuffix+'.png',fullPage,animations:'disabled'});shots++;}
 async function sheet(page,trigger,name){
  await trigger.click();const dialog=page.getByRole('dialog');await dialog.waitFor();
  check(await dialog.getByText('Hash only · signature not checked',{exact:true}).isVisible(),'sheet hash warning');
  check(await dialog.getByText('Integrity is not approval',{exact:true}).isVisible(),'sheet acceptance warning');
  const geometry=await dialog.evaluate(element=>{const box=element.getBoundingClientRect();return {bottom:box.bottom,top:box.top,radius:getComputedStyle(element).borderTopLeftRadius,viewport:innerHeight};});
  check(Math.abs(geometry.bottom-geometry.viewport)<1&&geometry.top>0&&geometry.radius==='12px','bottom sheet geometry');
  await audit(page);await capture(page,name,false);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.waitForFunction(element=>document.activeElement===element,await trigger.elementHandle());
 }
 for(const lens of lenses)for(const width of [1440,390]){
  lensSuffix=lenses.length>1?'-'+lens:'';
  const context=await browser.newContext({viewport:{width,height:width===1440?900:844},timezoneId:'Europe/Berlin',reducedMotion:'reduce'});
  await context.addInitScript(value=>{if(window===window.top)localStorage.setItem('tl-lens',value)},lens);
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  page.on('pageerror',()=>{failure=true});page.on('console',message=>{if(message.type()==='error'&&!blockedPreviewScript(message))failure=true});
  await page.goto(origin);await page.locator('main h1').waitFor();await page.evaluate(()=>document.fonts.ready);
  for(const [i,name] of ['overview','claimed','timeline','story'].entries()){
   stage=name+'-'+width+'-'+lens;
   await page.getByRole('navigation',{name:'Viewer navigation',exact:true}).getByRole('button').nth(i).click();
   await page.locator('main h1').waitFor();
   if(width===390)await page.waitForFunction(()=>scrollY===0&&document.activeElement===document.querySelector('main h1'));
   else await page.evaluate(()=>window.scrollTo(0,0));
   await audit(page);
   if(i===0)await branding(page);
   if(width===390){
    const layout=await page.evaluate(()=>{const head=document.querySelector('.mountain-header').getBoundingClientRect(),nav=document.querySelector('.sidebar').getBoundingClientRect();return {head:head.height,nav:nav.height,bottom:nav.bottom,viewport:innerHeight,canvas:!!document.querySelector('.graph-canvas')};});
    check(layout.head===56&&layout.nav===64&&Math.abs(layout.bottom-layout.viewport)<1&&!layout.canvas,'mobile shell');
    if(i===0){
     const order=await page.evaluate(()=>['.status-grid','.criteria-panel','.project-preview','.criterion-detail','.timeline-panel'].map(selector=>document.querySelector(selector)?.getBoundingClientRect().top));
     check(order.every((top,index)=>Number.isFinite(top)&&(index===0||top>order[index-1])),'mobile reading order');
    }
   }
   await capture(page,name+'-'+width,false);
   if(width===1440&&i===0){
    await page.getByText('Recorded links and code diff',{exact:true}).click();
    for(const kind of ['claim','criterion','evidence','file']){
     const node=page.locator(`.react-flow__node[data-id^="${kind}:"] button`).first();
     await page.keyboard.press('Tab');await node.focus();await page.keyboard.press('Enter');
     const dialog=page.getByRole('dialog');await dialog.waitFor();
     await page.keyboard.press('Tab');check(await dialog.evaluate(element=>element.contains(document.activeElement)),'desktop focus containment');
     const overlap=await dialog.evaluate(element=>{
      const close=element.querySelector(':scope > button');
      const badge=element.querySelector('.integrity-badge');
      if(!close||!badge)return true;
      const a=close.getBoundingClientRect(),b=badge.getBoundingClientRect();
      return b.left<0||b.right>innerWidth||(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top);
     });
     check(!overlap,'trust badge and Close overlap');
     await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
     await page.waitForFunction(element=>document.activeElement===element,await node.elementHandle());
    }
    await page.getByText('Recorded links and code diff',{exact:true}).click();
   }
   if(width===390){
    await sheet(page,page.locator('.compact-trust'),name+'-sheet-390');
    if(i===0){
     await sheet(page,page.getByRole('button',{name:/^Open run:/}),'run-sheet-390');
     await page.locator('.criterion-button').first().click();
     await sheet(page,page.getByRole('button',{name:'Open criterion record',exact:true}),'criterion-sheet-390');
    }
    await page.evaluate(()=>window.scrollTo(0,Math.min(1200,document.documentElement.scrollHeight-innerHeight)));
   }
  }
  // Exercise intermediate widths without publishing additional review images.
  if(width===390){
   await page.getByRole('navigation',{name:'Viewer navigation',exact:true}).getByRole('button').first().click();
   for(const probe of [360,760,1024]){
    stage='responsive-'+probe;await page.setViewportSize({width:probe,height:1000});
    await page.waitForFunction(width=>document.querySelector('.mountain-header').getBoundingClientRect().height===(width<=760?56:64),probe);
    await audit(page);
    const cardsFit=await page.locator('.status-card').evaluateAll(cards=>cards.every(card=>card.scrollWidth<=card.clientWidth));
    check(cardsFit,'card content overflow');
   }
  }
  await context.close();
 }
 console.log(shots+' screenshots: all4 views at1440+390, mobile sheets and overview reading order; no contrast/type/overflow/browser errors. '+output);
}catch(error){console.error('P3 review failed at '+stage+' ('+(error.message.startsWith('P3 check:')?error.message:error.name)+')');process.exitCode=1;}
finally{await browser?.close();await server?.close();}
