import {useRef,useState} from 'react'
import {Button} from '../components/ui/button.tsx'
import {openLocalFolder,type LocalEntry,type LocalFolder} from '../local-folder.ts'
import {directoryEntries,directoryPicker,selectedEntries} from '../local-picker.ts'
export function LocalFolderOpen({onOpen}:{onOpen:(folder:LocalFolder)=>void}){
 const input=useRef<HTMLInputElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null)
 async function load(read:()=>Promise<Iterable<LocalEntry>>){
  setBusy(true);setError(null)
  try{onOpen(await openLocalFolder(await read()))}
  catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Unable to open local folder')}
  finally{setBusy(false)}
 }
 const choose=()=>{
  const picker=directoryPicker()
  if(picker)void load(async()=>directoryEntries(await picker.call(window,{mode:'read'})))
  else input.current?.click()
 }
 return <section className="local-open" aria-label="Open local files">
  <Button variant="outline" disabled={busy} onClick={choose}>{busy?'Checking local folder…':'Open local folder'}</Button>
  <input ref={input} className="sr-only" tabIndex={-1} type="file" multiple {...{webkitdirectory:''}} aria-label="Choose local ledger folder" onChange={event=>{const files=Array.from(event.currentTarget.files??[]);event.currentTarget.value='';if(files.length)void load(async()=>selectedEntries(files))}}/>
  <p>Read only. Up to 200 files, 10 MiB each, 32 MiB total. Local files are unregistered and not admitted under D34. Browser selection cannot audit filesystem symlinks.</p>
  {error&&<p role="alert">Local folder rejected: {error}</p>}
 </section>
}
