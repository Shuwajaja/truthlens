// Command name retained for compatibility; checks the approved workspace themes, not WERK.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const css=await readFile(new URL('../src/theme.css',import.meta.url),'utf8');
const parse=block=>Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
const base=parse(css.match(/:root\s*\{([\s\S]*?)\}/)[1]);
const dark=parse(css.match(/:root\[data-viewer-theme="cool-graphite"\]\s*\{([\s\S]*?)\}/)[1]);
const overview=parse(css.match(/\.cross-run-overview\s*\{([\s\S]*?)\}/)[1]);
assert.equal([...css.matchAll(/:root\b/g)].length,2,'base and one explicit alternative');
assert(base.font.includes('Plus Jakarta Sans Variable'));assert(base.mono.includes('JetBrains Mono Variable'));
assert.equal(base.radius,'12px');for(const [i,n] of [8,16,24,32].entries())assert.equal(base[`space-${i+1}`],`${n}px`);
assert.doesNotMatch(css,/Inter Variable/i);
// Legacy review palettes stay frozen; the approved overview is a scoped addition.
assert.doesNotMatch(JSON.stringify([base,dark]),/#(?:1CDC44|79B8FF)\b/i);
assert.deepEqual(overview,{bg:'#070B0A',surface:'#0E1513','surface-2':'#15201C',border:'#22312C',text:'#E6EDEA','text-2':'#A7B5AF','text-3':'#86948E',ok:'#1CDC44',fail:'#FF7B72',info:'#79B8FF',neutral:'#97A3B3','neutral-text':'#97A3B3',warning:'#97A3B3',focus:'#79B8FF',accent:'#1CDC44','accent-soft':'#15201C','control-radius':'8px',radius:'8px'});
const measurements=[];
for(const [profile,values,expected] of [['Petrol & Porcelain',base,{bg:'#F1F4EF',frame:'#102F38'}],['Cool Graphite',{...base,...dark},{bg:'#181B22',frame:'#0D0F13'}]]){
 for(const [key,value] of Object.entries(expected))assert.equal(values[key],value);
 const rgb=key=>{const value=values[key];if(value.startsWith('var('))return rgb(value.slice(6,-1));assert.match(value,/^#[\da-f]{6}$/i,key);return value.slice(1).match(/../g).map(x=>parseInt(x,16)/255)};
 const luminance=rgb=>rgb.map(x=>Math.round(x*255)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
 const check=(fg,bg,threshold,label)=>{const [lo,hi]=[luminance(fg),luminance(bg)].sort((a,b)=>a-b);const ratio=(hi+.05)/(lo+.05);assert(ratio>=threshold,`${profile}: ${label} ${ratio.toFixed(2)} < ${threshold}`);measurements.push({profile,label,ratio,threshold})};
 for(const surface of ['bg','surface','surface-2']){
  for(const text of ['text','text-2','text-3','primary','secondary','success','error-text','warning','neutral-text','mode-client','mode-developer','interaction'])check(rgb(text),rgb(surface),4.5,`${text}/${surface}`);
  for(const control of ['focus','neutral','interaction'])check(rgb(control),rgb(surface),3,`${control}/${surface}`);
 }
 for(const status of ['success','error','warning','neutral']){
  const fill=rgb('surface').map((v,i)=>v*.92+rgb(status)[i]*.08);
  for(const text of ['text','text-2',status==='error'?'error-text':status==='neutral'?'neutral-text':status])check(rgb(text),fill,4.5,`${text}/${status} tint`);
  for(const control of ['focus','neutral',status])check(rgb(control),fill,3,`${control}/${status} tint`);
  const nested=fill.map((v,i)=>v*.9+rgb(status)[i]*.1);check(rgb(status==='neutral'?'neutral-text':status),nested,4.5,`${status}/nested badge`);
 }
 for(const tint of ['mode-client','mode-developer','interaction']){
  const fill=rgb('surface').map((v,i)=>v*.92+rgb(tint)[i]*.08);
  check(rgb(tint),fill,4.5,`${tint}/selected`);check(rgb('focus'),fill,3,`focus/${tint} selected`);
 }
 for(const tint of ['frame-accent','frame-mode-client','frame-mode-developer']){
  const fill=rgb('frame').map((v,i)=>v*.92+rgb(tint)[i]*.08);
  for(const text of [tint,'frame-text','frame-muted'])check(rgb(text),fill,4.5,`${text}/frame selected`);
  check(rgb('frame-accent'),fill,3,'frame focus/selected');
 }
 for(const surface of ['frame','frame-raised']){
  for(const text of ['frame-text','frame-muted','frame-accent','frame-mode-client','frame-mode-developer'])check(rgb(text),rgb(surface),4.5,`${text}/${surface}`);
  check(rgb('frame-accent'),rgb(surface),3,`frame focus/${surface}`);check(rgb('frame-border'),rgb(surface),3,`frame control/${surface}`);
 }
 console.log(`${profile}: approved tokens and AA text/3:1 controls checked.`);
}
console.log(`${measurements.length} contrast pairs; minimum ${Math.min(...measurements.map(m=>m.ratio)).toFixed(2)}:1 (includes 3:1 UI thresholds).`);
// Measure every overview text/focus/status role against its actual dark surfaces.
const lum=value=>value.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
for(const surface of ['bg','surface','surface-2'])for(const role of ['text','text-2','text-3','ok','fail','info','neutral','warning','focus']){
 const [lo,hi]=[lum(overview[role]),lum(overview[surface])].sort((a,b)=>a-b),ratio=(hi+.05)/(lo+.05),threshold=role==='focus'?3:4.5;
 assert(ratio>=threshold,`Overview: ${role}/${surface} ${ratio.toFixed(2)} < ${threshold}`);
 measurements.push({profile:'Workspace overview',label:`${role}/${surface}`,ratio,threshold});
}
console.log('Overview: approved scoped palette, neutral warnings, AA text and visible focus checked.');
if(process.env.THEME_REPORT)await writeFile(process.env.THEME_REPORT,JSON.stringify({measurements},null,2)+'\n');
