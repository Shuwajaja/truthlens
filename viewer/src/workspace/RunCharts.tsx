import {useId,type ReactNode} from 'react'
import {criterionStates,criterionTotal,type CriterionCounts,type RunAggregate} from './cross-run-data.ts'

const criterionLabels={met:'Met',unmet:'Unmet',unverified:'Not checkable',proposed:'Proposed'}
function Chart({title,description,children}:{title:string;description:string;children:ReactNode}){
 const id=useId()
 return <figure className="run-chart" aria-labelledby={id}><figcaption><h3 id={id}>{title}</h3><p>{description}</p></figcaption>{children}</figure>
}
export function CriterionBar({criteria}:{criteria:CriterionCounts}){
 const total=criterionTotal(criteria)
 return <div className="criterion-stack" aria-hidden="true">{criterionStates.map(status=><span key={status} data-criterion={status} style={{width:`${total?criteria[status]/total*100:0}%`}}/>)}</div>
}
export function CriterionText({criteria}:{criteria:CriterionCounts}){
 return <span className="criterion-counts">{criterionStates.map(status=><span key={status} data-criterion={status}>{criteria[status]} {criterionLabels[status].toLowerCase()}</span>)}</span>
}
export function RunCharts({data}:{data:RunAggregate}){
 const chronological=[...data.latest].reverse(),dated=chronological.filter(row=>row.started!==null),maxEvidence=Math.max(1,...data.evidence.map(e=>e.count))
 return <div className="run-charts">
  <Chart title="Criteria met over recent runs" description="Counts per run, oldest to newest. Missing dates are not a trend.">
   {!dated.length&&<p>No dated runs recorded.</p>}
   <ol className="run-series">{dated.map(row=><li key={row.runId}>
    <span title={row.runId}>{row.runId}</span><meter min={0} max={Math.max(1,criterionTotal(row.criteria))} value={row.criteria.met} aria-label={`Met criteria for ${row.runId}`}/><b>{row.criteria.met}/{criterionTotal(row.criteria)}</b>
   </li>)}</ol>
  </Chart>
  <Chart title="Criteria per run" description="Met · unmet · not checkable · proposed. Latest loaded runs.">
   <ul className="run-criteria-series">{chronological.map(row=><li key={row.runId}><span className="run-chart-id" title={row.runId}>{row.runId}</span><CriterionBar criteria={row.criteria}/><CriterionText criteria={row.criteria}/></li>)}</ul>
  </Chart>
  <Chart title="Recorded evidence kinds" description="Recorded events across loaded runs; not a count of passed tests.">
   {data.evidence.length?<ul className="evidence-bars">{data.evidence.map(({kind,count})=><li key={kind}><span>{kind}</span><meter min={0} max={maxEvidence} value={count} aria-label={kind}/><b>{count}</b></li>)}</ul>:<p>No evidence events recorded.</p>}
  </Chart>
  <Chart title="Criteria by agent" description="Recorded agent names and criterion counts; no performance ranking.">
   <ul className="agent-bars">{data.agents.slice(0,14).map(row=><li key={row.agent}><span>{row.agent||'Agent not recorded'}</span><span className="chart-note">{row.runs} {row.runs===1?'run':'runs'}</span><CriterionBar criteria={row.criteria}/><CriterionText criteria={row.criteria}/></li>)}</ul>
   {data.agents.length>14&&<p>Showing the first 14 of {data.agents.length} recorded agents.</p>}
  </Chart>
 </div>
}
