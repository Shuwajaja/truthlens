import {useEffect,useRef,useState} from 'react'
import {Card} from '../components/ui/card.tsx'
import {Button} from '../components/ui/button.tsx'
import {StatusDeck} from '../components/StatusDeck.tsx'
import {connectPrivateReader,loadPrivateAuditResult,loadPrivateCatalogPage,type PrivateRunSummary} from '../private-reader.ts'
import {unavailableStatus,type StatusResult} from '../status-result.ts'
import './widget.css'

export function RegistryWidget({runId}:{runId:string|null}){
 return <HumanStatusWidget key={runId??''} runId={runId}/>
}
function HumanStatusWidget({runId}:{runId:string|null}){
 const [result,setResult]=useState<StatusResult>(unavailableStatus)
 const [connected,setConnected]=useState(false)
 const [busy,setBusy]=useState(false)
 const selected=useRef<PrivateRunSummary|null>(null)
 const request=useRef<AbortController|null>(null)
 useEffect(()=>()=>request.current?.abort(),[])
 const refresh=async()=>{
  if(request.current)return
  const controller=new AbortController();request.current=controller
  setBusy(true);setResult(unavailableStatus)
  try{
   let item=selected.current
   if(!item){
    if(!runId||!/^[A-Za-z0-9_-]{1,80}$/.test(runId))throw Error('unavailable')
    const connection=await connectPrivateReader(controller.signal)
    let catalog=connection.catalog,pages=0
    item=catalog.runs.find(run=>run.run_id===runId)??null
    while(!item&&catalog.next_offset!==null&&pages++<20){
     catalog=await loadPrivateCatalogPage(connection.sourceId,catalog.next_offset,controller.signal)
     item=catalog.runs.find(run=>run.run_id===runId)??null
    }
    if(!item)throw Error('unavailable')
   }
   const response=await loadPrivateAuditResult(item,controller.signal)
   if(controller.signal.aborted)return
   selected.current=item;setConnected(true);setResult(response.status)
  }catch{
   if(controller.signal.aborted)return
   selected.current=null;setConnected(false);setResult(unavailableStatus)
  }finally{
   if(!controller.signal.aborted){request.current=null;setBusy(false)}
  }
 }
 return <main className="audit-widget-shell">
  <Card className="audit-widget" role="region" aria-labelledby="audit-widget-heading">
   <h1 id="audit-widget-heading">Audit status</h1>
   {!connected&&<p>Not connected</p>}
   {busy&&<p role="status">Reading status…</p>}
   <StatusDeck result={result}/>
   <Button variant="outline" disabled={busy||!runId} onClick={()=>{void refresh()}}>{connected?'Refresh status':'Connect'}</Button>
  </Card>
 </main>
}
