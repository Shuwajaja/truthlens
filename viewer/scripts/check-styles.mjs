import {readdir,readFile} from 'node:fs/promises';
const violations=[];
async function check(dir){
 for(const item of await readdir(dir,{withFileTypes:true})){
  const path=dir+'/'+item.name;
  if(item.isDirectory()){await check(path);continue;}
  if(path==='src/theme.css')continue;
  const source=await readFile(path,'utf8');
  if(/#[\da-f]{3,8}\b|\b(?:orange|amber|yellow)\b|(?:text|bg|border|fill|stroke|divide|ring)-(?:red|green|blue|gray|slate|zinc|white|black|purple|emerald|rose|lime|cyan|teal|indigo|violet|pink|fuchsia|sky|stone|neutral)(?:-|\/|\b)/i.test(source))violations.push(path);
 }
}
await check('src');
if(violations.length){console.error('Use semantic theme tokens in: '+violations.join(', '));process.exitCode=1;}
else console.log('src uses semantic colour tokens; literals are confined to theme.css.');
