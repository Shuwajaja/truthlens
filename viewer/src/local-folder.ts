import type {RunDoc} from './types.ts'
import {validateRunDoc} from './validateRunDoc.ts'
import {canonicalLocal,decodeLocal,parseLocalJson,requireLocal,sha256,utf8} from './local-json.ts'
import {isHash,verifyLocalLedger} from './local-ledger.ts'
import {projectLocal} from './local-projection.ts'
import {checkLocalImage} from './local-images.ts'
export const LOCAL_LIMITS={files:200,fileBytes:10*1024*1024,totalBytes:32*1024*1024,events:20_000,cacheBytes:50*1024*1024} as const
export type LocalEntry={path:string;kind:string;size:number;read:()=>Promise<Uint8Array>}
export type LocalFolder={sourceId:string;doc:RunDoc;totalBytes:number;originals:ReadonlyMap<string,Uint8Array>}
export type LocalDownload={filename:string;bytes:Uint8Array;mime:string}
export function localPath(path:string){
 requireLocal(typeof path==='string'&&path.length>0&&path.length<=1024&&!/[\\:%]/.test(path)&&![...path].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)&&path.split('/').every(part=>part.length>0&&part!=='.'&&part!=='..'),'Unsafe local path')
 return path
}
const blobPattern=/^blobs\/sha256\/([a-f0-9]{2})\/([a-f0-9]{64})$/
const recognized=(path:string)=>path==='ledger.jsonl'||path==='manifest.json'||path==='manifest.sha256'||blobPattern.test(path)
export async function openLocalFolder(input:Iterable<LocalEntry>):Promise<LocalFolder>{
 const entries:LocalEntry[]=[],paths=new Set<string>();let total=0
 for(const entry of input){
  requireLocal(entries.length<LOCAL_LIMITS.files,'Local file count limit exceeded');localPath(entry.path)
  requireLocal(entry.kind==='file','Only regular files are allowed; symlink entries are rejected')
  requireLocal(!paths.has(entry.path),'Duplicate local path');paths.add(entry.path)
  requireLocal(Number.isSafeInteger(entry.size)&&entry.size>=0&&entry.size<=LOCAL_LIMITS.fileBytes,'Local file size limit exceeded')
  total+=entry.size;requireLocal(total<=LOCAL_LIMITS.totalBytes,'Local total size limit exceeded');entries.push(entry)
 }
 requireLocal(paths.has('ledger.jsonl')&&paths.has('manifest.json'),'Select a folder containing ledger.jsonl and manifest.json')
 const originals=new Map<string,Uint8Array>()
 for(const e of entries){if(!recognized(e.path))continue;const data=await e.read();requireLocal(data instanceof Uint8Array&&data.byteLength===e.size,'Local file size changed while reading');originals.set(e.path,Uint8Array.from(data))}
 const events=await verifyLocalLedger(originals.get('ledger.jsonl')!,LOCAL_LIMITS.events)
 const manifest=parseLocalJson(decodeLocal(originals.get('manifest.json')!)),doc=projectLocal(events,manifest)
 for(const artifact of doc.artifacts)localPath(artifact.path)
 for(const [path,data] of originals){const match=blobPattern.exec(path);if(!match)continue
  requireLocal(match[1]===match[2].slice(0,2)&&await sha256(data)===match[2],'Blob hash/path mismatch');checkLocalImage(data)
 }
 const referenced=new Set<string>()
 for(const e of events){const sha=e.payload.sha256;if(sha===undefined)continue;requireLocal(isHash(sha),'Invalid blob reference');referenced.add(sha);requireLocal(originals.has(`blobs/sha256/${sha.slice(0,2)}/${sha}`),'Referenced blob is missing')}
 const digest=originals.get('manifest.sha256');if(digest)requireLocal(decodeLocal(digest).trim()===await sha256(originals.get('manifest.json')!),'Manifest digest mismatch')
 const blobs:Record<string,string>=Object.create(null);let textBytes=0
 for(const sha of referenced){const data=originals.get(`blobs/sha256/${sha.slice(0,2)}/${sha}`)!;if(data.length>256*1024||textBytes+data.length>4*1024*1024)continue
  try{const text=decodeLocal(data);if(text.includes('\0'))continue;blobs[sha]=text;textBytes+=data.length}catch{/* Binary is download-only. */}
 }
 doc.blobs=blobs;requireLocal(validateRunDoc(doc),'Invalid derived local document')
 // Identity binds the ledger and manifest bytes. It is never a reader source ID.
 const sourceId='local-'+await sha256(utf8.encode(canonicalLocal({ledger:await sha256(originals.get('ledger.jsonl')!),manifest:await sha256(originals.get('manifest.json')!)})))
 return {sourceId,doc,totalBytes:total,originals}
}
export function originalDownload(folder:LocalFolder,path:string):LocalDownload{
 localPath(path);const bytes=folder.originals.get(path);requireLocal(bytes,'Original file is unavailable')
 return {filename:path.split('/').at(-1)!,bytes:Uint8Array.from(bytes),mime:'application/octet-stream'}
}
export function derivedDownload(folder:LocalFolder):LocalDownload{
 return {filename:`${folder.doc.run.run_id}-derived-rundoc.json`,bytes:utf8.encode(JSON.stringify({...folder.doc,verified:false,integrity:'hash-only',provenance:'derived'},null,2)+'\n'),mime:'application/json'}
}
