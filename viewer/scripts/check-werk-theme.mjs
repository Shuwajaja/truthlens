// Acceptance checks for the shared WERK palette and readable dark-theme pairs.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const css=await readFile(new URL('../src/theme.css',import.meta.url),'utf8');
const values=Object.fromEntries([...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
const expected={primary:'#3B82F6',secondary:'#8B5CF6',success:'#10B981',warning:'#F59E0B',error:'#EF4444',neutral:'#6B7280'};
for(const [key,value] of Object.entries(expected))assert.equal(values[key],value,key);
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
function check(fg,bg,threshold,label){const ratio=contrast(fg,bg);assert.ok(ratio>=threshold,`${label}: ${ratio.toFixed(2)} < ${threshold}`);minimum=Math.min(minimum,ratio);pairs++;}
for(const surface of ['bg','surface','surface-2']){
 for(const text of ['text','text-2','text-3','primary-text','secondary-text','success','warning','error-text','neutral-text'])check(rgb(text),rgb(surface),4.5,`${text}/${surface}`);
 for(const text of ['success','error-text','neutral-text']){
  const fill=rgb(surface).map((v,i)=>v*.9+rgb(text)[i]*.1);
  check(rgb(text),fill,4.5,`${text}/10% badge on ${surface}`);
 }
 check(rgb('info'),rgb(surface),3,`focus/${surface}`);
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
console.log(`WERK: six exact base tokens, 8px grid, 12px radius; ${pairs} AA text/control pairs, minimum ${minimum.toFixed(2)}:1 (control threshold 3:1).`);
