import {useEffect,useRef} from 'react'
import {Button} from '../components/ui/button.tsx'
import {derivedDownload,originalDownload,type LocalDownload,type LocalFolder} from '../local-folder.ts'
export function LocalDownloads({folder}:{folder:LocalFolder}){
 const pending=useRef(new Map<string,ReturnType<typeof setTimeout>>())
 useEffect(()=>{const urls=pending.current;return()=>{for(const [url,timer] of urls){clearTimeout(timer);URL.revokeObjectURL(url)}urls.clear()}},[folder])
 function download(file:LocalDownload){
  const url=URL.createObjectURL(new Blob([Uint8Array.from(file.bytes).buffer],{type:file.mime})),anchor=document.createElement('a')
  anchor.href=url;anchor.download=file.filename;document.body.append(anchor);anchor.click();anchor.remove()
  pending.current.set(url,setTimeout(()=>{URL.revokeObjectURL(url);pending.current.delete(url)},30000))
 }
 const paths=['ledger.jsonl','manifest.json',...folder.originals.keys()].filter((path,index,all)=>all.indexOf(path)===index&&path!=='manifest.sha256')
 return <section className="local-downloads" aria-label="Local folder exports">
  <p><strong>Local folder · not authenticated</strong>. Hash and manifest consistency checked locally; no signature check. Unregistered, outside the private catalog and D34 admission.</p>
  <details><summary>Original downloads</summary><ul>{paths.map(path=><li key={path}><Button variant="outline" onClick={()=>download(originalDownload(folder,path))}>Download original {path==='ledger.jsonl'?'ledger':path==='manifest.json'?'manifest':`evidence ${path.split('/').at(-1)}`}</Button><span className="workspace-reference">{path}</span></li>)}</ul></details>
  <Button variant="outline" onClick={()=>download(derivedDownload(folder))}>Download derived RunDoc</Button>
  <p>RunDoc is a derived view, not an original file. Integrity is not approval.</p>
 </section>
}
