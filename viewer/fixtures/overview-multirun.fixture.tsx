// Manual development review entry only; not imported by the product/build entry.
import {useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {overviewMultirunFixture} from './overview-multirun.fixture.mjs'
import {OverviewLanguageProvider} from '../src/workspace/OverviewLanguageProvider.tsx'
import {WorkspaceShell,type WorkspaceHandle} from '../src/workspace/WorkspaceShell.tsx'
import {RunsView} from '../src/workspace/RunsView.tsx'
import {RunDetail} from '../src/workspace/RunDetail.tsx'
import {validateRunDoc} from '../src/validateRunDoc.ts'
import {useMobile,useWide} from '../src/lib/use-mobile.ts'
import type {RunReference,WorkspaceSource} from '../src/workspace/navigation-types.ts'
import '../src/index.css'
import '../src/workspace/workspace.css'

const docs=overviewMultirunFixture().map((doc:unknown)=>{
 if(!validateRunDoc(doc))throw Error('Invalid synthetic review fixture')
 return doc
})
const source:WorkspaceSource={sourceId:'synthetic-overview-fixtures',label:'Development fixtures · synthetic, not recorded executions',kind:'development-fixture',runs:new Map(docs.map(doc=>[doc.run.run_id,doc]))}
export function Review(){
 const shell=useRef<WorkspaceHandle>(null),mobile=useMobile(),wide=useWide()
 const [selected,setSelected]=useState<RunReference|null>(null)
 const doc=selected?source.runs.get(selected.runId):undefined
 return <WorkspaceShell sources={[source]} ref={shell} overview={!doc} sourceLabel={source.label} navigation={null} inspector={null} lens="client" mobile={mobile} wide={wide} inspectorAvailable={false} inspectorOpen={false} onInspectorOpenChange={()=>{}} runSummaryKey={doc?.run.run_id} runSummary={doc?<RunDetail doc={doc} onRuns={()=>setSelected(null)}/>:undefined}>
  <RunsView sources={[source]} onOpenRun={setSelected}/>
 </WorkspaceShell>
}
createRoot(document.getElementById('root')!).render(<OverviewLanguageProvider><Review/></OverviewLanguageProvider>)
