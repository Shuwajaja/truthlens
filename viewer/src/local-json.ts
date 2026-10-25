// Restricted JSON for local v1 inputs: no duplicate/NFC-colliding keys, floats,
// unsafe integers, unpaired surrogates or excessive nesting. No code evaluation.
export function parseLocalJson(text:string):unknown{
 let at=0
 const fail=():never=>{throw Error('Invalid local JSON (duplicate key, number, encoding or shape)')}
 const space=()=>{while(/[\x20\t\r\n]/.test(text[at]??'!'))at++}
 function string():string{
  const start=at++
  while(at<text.length){const c=text[at++];if(c==='\\'){at++;continue}if(c==='"'){
   const value=JSON.parse(text.slice(start,at)) as string
   // A scalar-value string has no unpaired surrogate code points.
   if([...value].some(c=>{const n=c.codePointAt(0)!;return n>=0xd800&&n<=0xdfff}))fail()
   return value
  }}return fail()
 }
 function value(depth:number):unknown{
  if(depth>64)fail();space();const c=text[at]
  if(c==='"')return string()
  if(c==='{'){
   at++;space();const out:Record<string,unknown>=Object.create(null),keys=new Set<string>()
   if(text[at]==='}'){at++;return out}
   while(at<text.length){space();if(text[at]!=='"')fail();const key=string(),normalized=key.normalize('NFC');if(keys.has(normalized))fail();keys.add(normalized);space();if(text[at++]!==':')fail();out[key]=value(depth+1);space();const end=text[at++];if(end==='}')return out;if(end!==',')fail()}
   return fail()
  }
  if(c==='['){at++;space();const out:unknown[]=[];if(text[at]===']'){at++;return out}while(at<text.length){out.push(value(depth+1));space();const end=text[at++];if(end===']')return out;if(end!==',')fail()}return fail()}
  for(const [literal,result] of [['true',true],['false',false],['null',null]] as const)if(text.startsWith(literal,at)){at+=literal.length;return result}
  const number=/^-?(?:0|[1-9][0-9]*)/.exec(text.slice(at))?.[0];if(!number)return fail();at+=number.length;const n=Number(number);if(!Number.isSafeInteger(n)||Object.is(n,-0))fail();return n
 }
 const result=value(0);space();if(at!==text.length)fail();return result
}
function compareUnicode(a:string,b:string){const aa=[...a],bb=[...b];for(let i=0;i<Math.min(aa.length,bb.length);i++){const d=aa[i].codePointAt(0)!-bb[i].codePointAt(0)!;if(d)return d}return aa.length-bb.length}
export function canonicalLocal(value:unknown):string{
 if(value===null||typeof value==='boolean')return JSON.stringify(value)
 if(typeof value==='number'){if(!Number.isSafeInteger(value))throw Error('Unsupported local integer');return String(value)}
 if(typeof value==='string')return JSON.stringify(value.normalize('NFC'))
 if(Array.isArray(value))return `[${value.map(canonicalLocal).join(',')}]`
 if(typeof value==='object'&&value){
  const normalized=new Map<string,unknown>()
  for(const [key,item] of Object.entries(value)){const n=key.normalize('NFC');if(normalized.has(n))throw Error('NFC key collision');normalized.set(n,item)}
  return `{${[...normalized.keys()].sort(compareUnicode).map(key=>`${JSON.stringify(key)}:${canonicalLocal(normalized.get(key))}`).join(',')}}`
 }
 throw Error('Invalid local JSON value')
}
export const utf8=new TextEncoder()
export function decodeLocal(bytes:Uint8Array){return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}
export async function sha256(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes).buffer))].map(v=>v.toString(16).padStart(2,'0')).join('')}
export function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)}
export function requireLocal(condition:unknown,message:string):asserts condition{if(!condition)throw Error(message)}
