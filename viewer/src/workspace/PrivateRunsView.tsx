import {Button} from '../components/ui/button.tsx'
import type {PrivateRunCatalog,PrivateRunSummary} from '../private-reader.ts'

export function PrivateRunsView({catalog,loadingMore,onOpenRun,onLoadMore,onDisconnect}:{
 catalog:PrivateRunCatalog
 loadingMore:boolean
 onOpenRun:(run:PrivateRunSummary)=>void
 onLoadMore:()=>void
 onDisconnect:()=>void
}){
 return <section className="runs-view">
  <h1>Runs</h1>
  <p>Private reader catalog. Integrity is not approval.</p>
  <dl><dt>Workspace</dt><dd><code>{catalog.source_id}</code></dd></dl>
  {catalog.runs.length===0?<p>No runs are available in this private reader.</p>:<div className="runs-list">{catalog.runs.map(run=><article key={run.source_id}>
   <h2>Run</h2>
   <dl><dt>Source</dt><dd><code>{run.source_id}</code></dd><dt>Run</dt><dd><code>{run.run_id}</code></dd><dt>Registry record</dt><dd><code>{run.registration_id}</code></dd><dt>Captured</dt><dd>{run.capture_closed_at}</dd><dt>Ledger head</dt><dd><code>{run.ledger_last_hash}</code></dd></dl>
   <Button variant="outline" onClick={()=>onOpenRun(run)} aria-label={`Open run ${run.run_id}`}>Open run</Button>
  </article>)}</div>}
  {catalog.next_offset!==null&&<Button variant="outline" disabled={loadingMore||catalog.runs.length>=200} onClick={onLoadMore}>{loadingMore?'Loading more runs…':'Load more runs'}</Button>}
  {catalog.runs.length>=200&&catalog.next_offset!==null&&<p>Only the first 200 runs are shown.</p>}
  <Button variant="outline" onClick={onDisconnect}>Disconnect</Button>
 </section>
}
