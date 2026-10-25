import {LOCAL_LIMITS,localPath,type LocalEntry} from './local-folder.ts'
import {requireLocal} from './local-json.ts'
// Structural types keep the adapter testable; handles are never retained after reading.
export type ReadHandle={kind:string;name:string;values?:()=>AsyncIterable<ReadHandle>;getFile?:()=>Promise<{size:number;arrayBuffer:()=>Promise<ArrayBuffer>}>}
export async function directoryEntries(root:ReadHandle):Promise<LocalEntry[]>{
 const entries:LocalEntry[]=[];let visited=0,total=0
 async function walk(dir:ReadHandle,prefix:string,depth:number){
  requireLocal(dir.kind==='directory'&&dir.values&&depth<=12,'Unsupported directory or depth limit')
  for await(const handle of dir.values()){
   requireLocal(++visited<=400,'Local entry count limit exceeded');localPath(handle.name);requireLocal(!handle.name.includes('/'),'Unsafe local entry path')
   const path=prefix+handle.name;localPath(path)
   if(handle.kind==='directory'){await walk(handle,path+'/',depth+1);continue}
   requireLocal(handle.kind==='file'&&handle.getFile,'Only regular files are allowed; symlink entries are rejected')
   requireLocal(entries.length<LOCAL_LIMITS.files,'Local file count limit exceeded')
   const file=await handle.getFile();total+=file.size
   requireLocal(file.size<=LOCAL_LIMITS.fileBytes&&total<=LOCAL_LIMITS.totalBytes,'Local file size limit exceeded')
   entries.push({path,kind:'file',size:file.size,read:async()=>new Uint8Array(await file.arrayBuffer())})
  }
 }
 await walk(root,'',0);return entries
}
export function selectedEntries(files:FileList|File[]):LocalEntry[]{
 requireLocal(files.length<=LOCAL_LIMITS.files,'Local file count limit exceeded')
 let root:string|undefined
 return Array.from(files,file=>{
  const path=file.webkitRelativePath;localPath(path);const parts=path.split('/')
  requireLocal(parts.length>=2,'Choose one ledger folder');root??=parts[0];requireLocal(parts[0]===root,'Choose one ledger folder')
  return {path:parts.slice(1).join('/'),kind:'file',size:file.size,read:async()=>new Uint8Array(await file.arrayBuffer())}
 })
}
export function directoryPicker(){return (window as unknown as {showDirectoryPicker?: (options:{mode:'read'})=>Promise<ReadHandle>}).showDirectoryPicker}
