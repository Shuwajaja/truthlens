import type {WorkspaceSource,RunReference} from './navigation-types.ts'
import {Button} from '../components/ui/button.tsx'
import {useMemo} from 'react'
import {aggregateRuns,criterionTotal,OVERVIEW_LIMITS} from './cross-run-data.ts'
import {CriterionBar,CriterionText,RunCharts} from './RunCharts.tsx'
import {recordedTime} from '../components/overview-data.ts'
import './runs-overview.css'
export function RunsView({sources,onOpenRun,heading=true}:{sources:readonly WorkspaceSource[];heading?:boolean;onOpenRun:(ref:RunReference)=>void}){
 const data=useMemo(()=>{
  const entries=[]
  // Bound collection as well as aggregation; do not flatten a huge workspace.
  outer:for(const source of sources.slice(0,OVERVIEW_LIMITS.sources))for(const doc of source.runs.values()){
   entries.push({sourceId:source.sourceId,doc});if(entries.length>OVERVIEW_LIMITS.runs)break outer
  }
  return aggregateRuns(entries)
 },[sources])
 const sourceLimited=sources.length>OVERVIEW_LIMITS.sources
 const total=criterionTotal(data.criteria)
 const EmptyHeading=heading?'h2':'h3'
 return <section className="runs-view cross-run-overview">
  <p className="overview-intro">TruthLens checks whether AI agents really did what they claim.</p>
  {heading?<h1>Runs</h1>:<h2>Overview of loaded runs</h2>}
  <p className="overview-scope">{sources.some(source=>source.kind==='local-folder')?'Local folders are unregistered. Not D34 admission.':'Supplied loaded records only.'} Integrity is not approval.</p>
  <p className="overview-seal">Overall run verdicts are not available in these documents. Signatures are not checked by this overview.</p>
  {(data.excluded>0||data.omitted>0||data.duplicates>0||sourceLimited)&&<p className="overview-limits">{data.excluded} malformed or over-limit documents excluded. {data.duplicates} repeated run IDs excluded (first loaded snapshot retained). {data.omitted>0||sourceLimited?'Run or source limit reached; additional loaded records are not included.':''}</p>}
  {!data.totalRuns?<div className="overview-empty"><EmptyHeading>No loaded runs to summarize.</EmptyHeading><p>Open a local ledger folder to review recorded criteria and evidence. No example values are shown.</p></div>:<>
   <div className="overview-score-charts">
    <div className="overview-score"><h2>{total?`${data.criteria.met} of ${total} criteria met`:'No criteria recorded'}</h2><p>Across {data.totalRuns} loaded {data.totalRuns===1?'run':'runs'}</p><CriterionBar criteria={data.criteria}/><CriterionText criteria={data.criteria}/><p>Criterion results describe recorded checks. They do not establish an overall run verdict or approval.</p></div>
    <RunCharts data={data}/>
   </div>
   <section className="latest-runs"><h2>Latest runs</h2><p>Showing {data.latest.length} of {data.totalRuns} loaded runs. Newest recorded start first; undated runs last.</p>
    <ul>{data.latest.map(row=><li key={row.runId}><div className="latest-run-main"><h3>{row.project||'Untitled run'}</h3><p className="run-identity">{row.runId}</p><p>{row.agent||'Agent not recorded'}</p><p>{row.started?<time dateTime={row.started}>{recordedTime(row.started)}</time>:'Start time not recorded'}</p></div><div><CriterionText criteria={row.criteria}/><p className="chart-note">{row.reviewRequired?'Review required':'No review required in export'}</p><details><summary>Source</summary><p className="run-identity">{row.sourceId}</p></details></div><Button variant="outline" onClick={()=>onOpenRun({kind:'run',sourceId:row.sourceId,runId:row.runId})} aria-label={`Open run: ${row.project}`}>Open run</Button></li>)}</ul>
   </section>
  </>}
 </section>
}
