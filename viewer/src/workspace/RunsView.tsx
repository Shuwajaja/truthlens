import type {WorkspaceSource,RunReference} from './navigation-types.ts'
import {useId,useMemo} from 'react'
import {aggregateRuns,criterionTotal,OVERVIEW_LIMITS,type CriterionCounts} from './cross-run-data.ts'
import {CriterionText,RunCharts,ScoreRing} from './RunCharts.tsx'
import {recordedTime} from '../components/overview-data.ts'
import {overviewCopy} from './overview-copy.ts'
import {useOverviewLanguage} from './overview-language.ts'
import './runs-overview.css'
function criterionStatus(c:CriterionCounts){
 if(c.unmet)return 'Unmet'
 if(!criterionTotal(c)||c.unverified)return 'Unverified'
 if(c.proposed)return 'Proposed'
 return 'Met'
}
export function RunsView({sources,onOpenRun,heading=true}:{sources:readonly WorkspaceSource[];heading?:boolean;onOpenRun:(ref:RunReference)=>void}){
 const {language}=useOverviewLanguage(),copy=overviewCopy[language],descriptionId=useId()
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
 const score=total?`${data.criteria.met} ${copy.of} ${total} ${copy.criteriaMet}`:copy.noCriteria
 const Heading=heading?'h1':'h2'
 return <section className="runs-view cross-run-overview" lang={language}>
  <Heading className="sr-only">{copy.overview}</Heading>
  <p className="overview-intro"><span>{copy.intro}</span> <span className="overview-current">{copy.loaded}: {data.totalRuns}.</span></p>
  {!data.totalRuns?<div className="overview-empty"><h2>{copy.empty}</h2><p>{copy.emptyHelp}</p></div>:<>
   <div className="overview-score-charts">
    <section className="overview-score" aria-label={score}><ScoreRing criteria={data.criteria} label={score} copy={copy}/><h2>{score}</h2><CriterionText criteria={data.criteria} copy={copy}/><p className="overview-seal">{copy.hashOnly}</p></section>
    <RunCharts data={data} copy={copy}/>
   </div>
   <section className="latest-runs"><h2>{copy.latest} <span>· {copy.latestHelp}</span></h2>
    <ul>{data.latest.map((row,index)=>{
     const status=criterionStatus(row.criteria)
     return <li key={row.runId}><button type="button" className="latest-run" onClick={()=>onOpenRun({kind:'run',sourceId:row.sourceId,runId:row.runId})} aria-label={`${copy.open}: ${row.project||copy.untitled}`} aria-describedby={`${descriptionId}-${index}`}>
      <span className="run-dot" data-status={status} aria-hidden="true"/>
      <span className="latest-run-main"><strong title={row.project}>{row.project||copy.untitled}</strong><span>{row.started?<time dateTime={row.started}>{recordedTime(row.started)}</time>:copy.noStart}</span></span>
      <span className="latest-run-agent">{row.agent||copy.noAgent} · {criterionTotal(row.criteria)?`${row.criteria.met}/${criterionTotal(row.criteria)} ${copy.met.toLowerCase()}`:copy.noCriteria}</span>
      <span id={`${descriptionId}-${index}`} className="run-status" data-status={status}>{copy[`pill${status}`]}</span><span className="run-arrow" aria-hidden="true">›</span>
     </button></li>
    })}</ul>
    <details className="latest-details"><summary>{copy.details}</summary><p>{copy.showing} {data.latest.length} {copy.of} {data.totalRuns} {copy.runs}. {copy.latestOrder}</p><ul>{data.latest.map(row=><li key={row.runId}><strong>{row.project||copy.untitled}</strong><p className="run-identity">{row.runId}</p><p>{copy.source}: <span className="run-identity">{row.sourceId}</span></p><CriterionText criteria={row.criteria} copy={copy}/><p>{row.reviewRequired?copy.review:copy.noReview}</p></li>)}</ul></details>
   </section>
  </>}
  <footer className="overview-boundary"><p>{copy.approval} {sources.some(source=>source.kind==='local-folder')?copy.localScope:copy.scope} {copy.across} {data.totalRuns} {copy.runs}.</p><p>{copy.limitations}</p>{!data.totalRuns&&<p className="overview-seal">{copy.hashOnly}</p>}</footer>
  {(data.excluded>0||data.omitted>0||data.duplicates>0||sourceLimited)&&<p className="overview-limits">{data.excluded} {copy.excluded} {data.duplicates} {copy.duplicates} {data.omitted>0||sourceLimited?copy.limit:''}</p>}
 </section>
}
