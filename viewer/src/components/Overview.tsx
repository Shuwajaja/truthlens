import {useEffect,useMemo,useState} from 'react'
import {buildEvidenceGraph} from '../graph/evidence-graph.ts'
import {NodeDetail} from './NodeDetail.tsx'
import type {RunDoc} from '../types.ts'
import type {Lens} from '../lens.ts'
import type {DrawerTarget} from './Drawer.tsx'
import {EvidenceGraph} from './EvidenceGraph.tsx'
import {RenderView} from '../renderkit/RenderView.tsx'
import {StatusBadge} from './ui/badge.tsx'
import {Button} from './ui/button.tsx'
import {Card} from './ui/card.tsx'
import {Empty,EmptyDescription} from './ui/empty.tsx'
import {recordedDiff,recordedTime,recordedDuration} from './overview-data.ts'
import {ProjectPreview} from './ProjectPreview.tsx'
import {PageHeading} from './PageHeading.tsx'
import {CriterionDetail} from './CriterionDetail.tsx'
import {useOverviewLanguage} from '../workspace/overview-language.ts'
import {overviewCopy} from '../workspace/overview-copy.ts'

export function Overview({doc,lens,onOpenDrawer,showRunAction=true,selection,onSelectCriterion}:{doc:RunDoc;lens:Lens;showRunAction?:boolean;selection?:string;onSelectCriterion?:(id:string)=>void;onOpenDrawer:(target:DrawerTarget)=>void}){
 const [selected,setSelected]=useState<string>()
 const [graphSelected,setGraphSelected]=useState<string>()
 const focusDetail=()=>{const detail=document.getElementById('criterion-detail');detail?.focus({preventScroll:true});detail?.scrollIntoView?.({block:'start'})}
 useEffect(()=>{if(selected!==undefined)focusDetail()},[selected])
 const selectCriterion=(id:string|undefined)=>{if(id===undefined)return;if(onSelectCriterion){onSelectCriterion(id);return}if(id===selected)focusDetail();else setSelected(id)}
 const graph=useMemo(()=>buildEvidenceGraph(doc),[doc])
 const selectedCriterion=doc.criteria.find(c=>c.criterion_id===(selection??selected))??doc.criteria.find(c=>c.status==='unmet')??doc.criteria[0]
 const events=new Map(doc.events.map(e=>[e.id,e]))
 const matched=selectedCriterion?.evidence.flatMap(id=>{const e=events.get(id);return e?[e]:[]})??[]
 const proven=doc.criteria.filter(c=>c.status==='met').length
 const failed=doc.criteria.filter(c=>c.status==='unmet').length
 const notChecked=doc.criteria.length-proven-failed
 const diff=recordedDiff(doc)
 const {language}=useOverviewLanguage()
 const face=overviewCopy[language]
 return <div className={`overview stitch-overview ${onSelectCriterion?'workspace-overview':''}`}>
  <section className="overview-run" aria-label="Exported run">
   <PageHeading title={doc.run.project} description={doc.run.agent} action={showRunAction&&<Button variant="outline" size="sm" aria-label={`Open run: ${doc.run.project} · Run details`} onClick={()=>onOpenDrawer({kind:'run',doc})}>Run details</Button>}/>
   <div className="run-summary"><code>{doc.run.run_id}</code><span>{recordedTime(doc.run.started)}</span><span>Duration {recordedDuration(doc.run.started,doc.run.finished)}</span></div>
   <div className="approval-boundary"><span>Approval</span><strong data-testid="approval-status" data-state={doc.review_required?'open':'not-stated'}>{doc.review_required?'Open':'Not stated'}</strong><span>{doc.review_required?'Needs human review':'No human approval stated'}</span></div>
  </section>
  <p className="result-sentence">{proven} of {doc.criteria.length} criteria proven; {failed} failed; {notChecked} not checked.</p>
  <div className="status-grid">
   <Card className="status-card" data-status="met"><Button variant="ghost" className="status-review" disabled={!doc.criteria.find(c=>c.status==='met')} onClick={()=>selectCriterion(doc.criteria.find(c=>c.status==='met')?.criterion_id)}><span className="card-label"><span className="status-dot tone-ok" aria-hidden="true"/>Proven</span><span className="status-value" data-testid="met-count"><span className="text-ok">{proven}</span> / {doc.criteria.length}</span><span className="status-description">Criteria with recorded result met</span></Button></Card>
   <Card className="status-card" data-status="unmet"><Button variant="ghost" className="status-review" disabled={!doc.criteria.find(c=>c.status==='unmet')} onClick={()=>selectCriterion(doc.criteria.find(c=>c.status==='unmet')?.criterion_id)}><span className="card-label"><span className="status-dot tone-fail" aria-hidden="true"/>Failed</span><span className="status-value text-fail" data-testid="failed-count">{failed}</span><span className="status-description">Criteria with recorded result unmet</span></Button></Card>
   <Card className="status-card" data-status="unverified"><Button variant="ghost" className="status-review" disabled={!doc.criteria.find(c=>c.status!=='met'&&c.status!=='unmet')} onClick={()=>selectCriterion(doc.criteria.find(c=>c.status!=='met'&&c.status!=='unmet')?.criterion_id)}><span className="card-label"><span className="status-dot tone-open" aria-hidden="true"/>Not checked</span><span className="status-value text-open" data-testid="unwitnessed-count">{notChecked}</span><span className="status-description">Criteria without a confirmed result</span></Button></Card>
  </div>
  <div className="overview-workspace">
   <Card className="panel criteria-panel" role="region" aria-label={face.criteriaRegion}>
    <div className="panel-heading"><h2>{face.criteriaTitle}</h2><span className="section-note">{doc.criteria.length} {face.criteriaWord}</span></div>
    {doc.criteria.length===0?<Empty><EmptyDescription>No criteria exported.</EmptyDescription></Empty>:<ul className="criterion-list">{doc.criteria.map(c=><li key={c.criterion_id}>
     <button type="button" className="criterion-button" data-status={c.status} aria-pressed={c===selectedCriterion} onClick={()=>selectCriterion(c.criterion_id)}>
      <span className="sr-only">Evidence: </span><span className="criterion-content"><strong>{c.text}</strong><span>{c.plain}</span></span><StatusBadge source="criterion" status={c.status}/>
     </button>
    </li>)}</ul>}
    <a className="criterion-detail-link" href="#criterion-detail">View selected criterion</a>
   </Card>
   <details className="project-disclosure" open><summary>Project preview · exported HTML</summary><ProjectPreview doc={doc} onOpenDrawer={onOpenDrawer}/></details>
   {!onSelectCriterion&&<CriterionDetail criterion={selectedCriterion} claims={doc.claims.filter(claim=>claim.criterion_ids.includes(selectedCriterion?.criterion_id??''))} matched={matched} onOpenDrawer={onOpenDrawer}/>}
   <details className="timeline-disclosure"><summary>Recorded timeline</summary><Card className="panel timeline-panel"><div className="overview-timeline" role="region" aria-label="Recorded timeline" tabIndex={0}>
    <RenderView input={{kind:'events',events:doc.events}} context={{lens,onOpenDrawer,headingLevel:2}}/>
   </div></Card></details>
  </div>
  <details className="recorded-supplement"><summary>Recorded links and code diff</summary>
   <div className="graph-evidence-row"><EvidenceGraph doc={doc} onOpenDrawer={onOpenDrawer} onSelectNode={setGraphSelected}/><NodeDetail node={graph.nodes.find(n=>n.id===graphSelected)} onOpenDrawer={onOpenDrawer}/></div>
   <Card className="panel diff-panel"><div className="panel-heading"><h2>Code diff</h2></div>{diff?<>
    <div className="diff-preview" role="region" aria-label="Exported code diff" tabIndex={0}><RenderView input={{kind:'blob',mediaType:'text/x-diff',text:diff.text}}/></div>
    <Button variant="outline" size="sm" onClick={()=>onOpenDrawer({kind:'event',event:diff.event})}>View diff</Button>
   </>:<Empty><EmptyDescription>No code diff exported.</EmptyDescription></Empty>}</Card>
  </details>
 </div>
}
