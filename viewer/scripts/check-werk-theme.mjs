// Final single Stitch palette, text AA and focus contrast. Legacy filename retained for command compatibility.
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
const css=await readFile(new URL('../src/theme.css',import.meta.url),'utf8');
const parse=block=>Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
const base=parse(css.match(/:root\s*\{([\s\S]*?)\}/)[1]);
assert.equal([...css.matchAll(/:root\b/g)].length,1,'one unconditional root');
assert.doesNotMatch(css,/data-viewer-theme|Inter Variable|#(?:090F17|111C29|192638|344459|E6EDF3|B4BFCE|A7B0BF|3B82F6|60A5FA|8B5CF6|B79CFF|EF4444|FF9292|1CDC44|79B8FF)\b/i);
const profiles=[['Final Stitch',base,{bg:'#09090B',primary:'#F4F4F5',secondary:'#A1A1AA',success:'#10B981',warning:'#F59E0B',error:'#F43F5E',neutral:'#71717A'},'Plus Jakarta Sans Variable']];
const measurements=[];
for(const [profile,values,expected,font] of profiles){
 for(const [key,value] of Object.entries(expected))assert.equal(values[key],value,`${profile}: ${key}`);
 assert(values.font.includes(font),`${profile}: font`);
 assert(values.mono.includes('JetBrains Mono Variable'),`${profile}: mono`);
assert.equal(values.radius,'12px');
for(const [i,pixels] of [8,16,24,32].entries())assert.equal(values[`space-${i+1}`],`${pixels}px`);
for(const entry of await readdir(new URL('../src/',import.meta.url),{recursive:true})){
 if(!entry.endsWith('.tsx'))continue;
 const source=await readFile(new URL('../src/'+entry,import.meta.url),'utf8');
 assert.doesNotMatch(source,/(?<![\w-])(?:[pm][trblxy]?|gap(?:-[xy])?|space-[xy])-(?:0\.5|1\.5|2\.5|3\.5|1|3|5|7)(?![\w.])/,`8px spacing utilities: ${entry}`);
}
const rgb=key=>{
 const value=values[key];
 if(value.startsWith('var('))return rgb(value.slice(6,-1));
 assert.match(value,/^#[\da-f]{6}$/i,key);
 return value.slice(1).match(/../g).map(x=>parseInt(x,16)/255);
};
const luminance=rgb=>rgb.map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const [lo,hi]=[luminance(a),luminance(b)].sort((a,b)=>a-b);return (hi+.05)/(lo+.05)};
let minimum=Infinity,pairs=0;
function check(fg,bg,threshold,label){const ratio=contrast(fg,bg);assert.ok(ratio>=threshold,`${label}: ${ratio.toFixed(2)} < ${threshold}`);minimum=Math.min(minimum,ratio);pairs++;measurements.push({label,ratio,threshold});}
for(const surface of ['bg','surface','surface-2']){
 for(const text of ['text','text-2','text-3','primary-text','secondary-text','success','warning','error-text','neutral-text'])check(rgb(text),rgb(surface),4.5,`${text}/${surface}`);
 for(const text of ['success','error-text','neutral-text']){
  const fill=rgb(surface).map((v,i)=>v*.9+rgb(text)[i]*.1);
  check(rgb(text),fill,4.5,`${text}/10% badge on ${surface}`);
 }
 check(rgb('focus'),rgb(surface),3,`focus/${surface}`);
 for(const tint of ['primary','secondary','success','error','warning','neutral']){
 const fill=rgb(surface).map((v,i)=>v*.9+rgb(tint)[i]*.1);
 check(rgb('focus'),fill,3,`focus/10% ${tint} on ${surface}`);
 }
 check(rgb('neutral'),rgb(surface),3,`control/${surface}`);
}
check(rgb('primary'),rgb('bg'),4.5,'brand/page');
check(rgb('primary'),rgb('surface'),4.5,'brand/sidebar');
const lensFill=rgb('surface').map((v,i)=>v*.9+rgb('secondary')[i]*.1);
check(rgb('secondary-text'),lensFill,4.5,'developer lens');
for(const [text,fill] of [['warning','warning'],['error-text','error'],['neutral-text','neutral'],['primary-text','primary']]){
 const background=rgb('surface').map((v,i)=>v*.9+rgb(fill)[i]*.1);
 check(rgb(text),background,4.5,`${text}/semantic ${fill} fill`);
}
for(const fill of ['primary','secondary','success','warning','error'])check(rgb('bg'),rgb(fill),4.5,`dark text/${fill}`);
// Actual 10% status surfaces: all prose plus semantic rails and selection indicators.
for(const [tint,accent,name] of [['success','success','success'],['error','error-text','error'],['warning','warning','warning'],['neutral','neutral-text','neutral']]){
 assert.equal(values[`status-${name}-bg`],`color-mix(in srgb, var(--${tint}) 10%, var(--surface))`);
 const fill=rgb('surface').map((v,i)=>v*.9+rgb(tint)[i]*.1);
 for(const text of ['text','text-2',accent])check(rgb(text),fill,4.5,`${text}/${name} status surface`);
 check(rgb(accent),fill,3,`${name} rail/inside tint`);
 check(rgb(tint),fill,3,`${name} status indicator/inside tint`);
 const badgeFill=fill.map((v,i)=>v*.9+rgb(accent)[i]*.1);
 check(rgb(accent),badgeFill,4.5,`${name} badge/nested status tint`);
 for(const parent of ['bg','surface','surface-2'])check(rgb(accent),rgb(parent),3,`${name} rail/outside ${parent}`);
 check(rgb('focus'),fill,3,`focus/${name} status surface`);
 check(rgb('neutral'),fill,3,`control boundary/${name} status surface`);
}
// Mode identity is independent of recorded status, with AA labels and non-text rails.
for(const mode of ['client','developer']){
 const key=`mode-${mode}`;
 assert(values[key],`dedicated ${mode} token`);
 for(const status of ['success','error','warning'])assert.notEqual(values[key],values[status],`${mode} is not ${status}`);
 assert.equal(values[`${key}-bg`],`color-mix(in srgb, var(--${key}) 10%, var(--surface))`);
 const fill=rgb('surface').map((v,i)=>v*.9+rgb(key)[i]*.1);
 for(const parent of ['bg','surface','surface-2']){
  check(rgb(key),rgb(parent),4.5,`${mode} label/${parent}`);
  check(rgb(key),rgb(parent),3,`${mode} rail/${parent}`);
 }
 check(rgb(key),fill,4.5,`${mode} label/selected fill`);
 check(rgb(key),fill,3,`${mode} rail/selected fill`);
 check(rgb('focus'),fill,3,`focus/${mode} selected fill`);
}
assert.notEqual(values['mode-client'],values['mode-developer'],'distinct mode cues');
assert.equal(values['navigation-accent'],'var(--success)');
assert.equal(values['navigation-bg'],'var(--status-success-bg)');
console.log(`${profile}: exact profile tokens, 8px grid, 12px radius; ${pairs} AA text/control pairs, minimum ${minimum.toFixed(2)}:1 (control threshold 3:1).`);

}

if(process.env.THEME_REPORT)await writeFile(process.env.THEME_REPORT,JSON.stringify({measurements},null,2)+'\n');
