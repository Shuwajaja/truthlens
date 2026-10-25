/** Human-facing, in-memory aggregation. No audit projection or I/O. */
export const OVERVIEW_LIMITS = {sources:1000, runs:200, recordsPerRun:10_000, totalRecords:100_000, text:4096, latest:14} as const
export const criterionStates = ['met','unmet','unverified','proposed'] as const
export type CriterionState = typeof criterionStates[number]
export type CriterionCounts = Record<CriterionState,number>
export const criterionTotal=(c:CriterionCounts)=>criterionStates.reduce((n,s)=>n+c[s],0)
export type OverviewRun = {
 sourceId:string; runId:string; project:string; agent:string; started:string|null
 criteria:CriterionCounts; reviewRequired:boolean
}
export type RunAggregate = {
 totalRuns:number; criteria:CriterionCounts; latest:OverviewRun[]
 agents:{agent:string; runs:number; criteria:CriterionCounts}[]
 evidence:{kind:string; count:number}[]
 excluded:number; duplicates:number; omitted:number
}
const counts = ():CriterionCounts => ({met:0,unmet:0,unverified:0,proposed:0})
const record = (v:unknown):v is Record<string,unknown> => typeof v==='object'&&v!==null&&!Array.isArray(v)
const text = (v:unknown):v is string => typeof v==='string'&&v.length<=OVERVIEW_LIMITS.text
const array = (v:unknown):v is unknown[] => Array.isArray(v)&&v.length<=OVERVIEW_LIMITS.recordsPerRun
type WorkBudget={remaining:number}
function charge(budget:WorkBudget,size:number){
 if(size>budget.remaining){budget.remaining=0;return false}
 budget.remaining-=size;return true
}
function strings(v:unknown,budget:WorkBudget){
 if(!array(v)||!charge(budget,v.length))return false
 for(const item of v)if(!text(item))return false
 return true
}
const state = (v:unknown):v is CriterionState => criterionStates.some(s=>s===v)
const evidenceKinds = new Map([
 ['command_run','Commands'],['file_changed','File changes'],['test_files_changed','Test-file changes'],
])

/** Read only bounded fields used by this view. Existing loaders validate the full
 * RunDoc; this additional boundary also makes the pure helper safe on JSON input.
 * Blobs and other potentially huge/unrelated fields are deliberately not visited.
 */
function readEntry(value:unknown,budget:WorkBudget){
 if(!record(value)||!text(value.sourceId)||!value.sourceId||!record(value.doc))return null
 const doc=value.doc,run=doc.run
 if(!record(run)||!text(run.run_id)||!run.run_id||!text(run.project)||!text(run.agent)||!text(run.started)
  ||typeof doc.review_required!=='boolean'||!array(doc.criteria)||!array(doc.claims)||!array(doc.events))return null
 const size=doc.criteria.length+doc.claims.length+doc.events.length
 if(!charge(budget,size))return null
 const criteria=counts(),ids=new Set<string>()
 for(const c of doc.criteria){
  if(!record(c)||!text(c.criterion_id)||!c.criterion_id||ids.has(c.criterion_id)||!state(c.status)||!strings(c.evidence,budget))return null
  ids.add(c.criterion_id);criteria[c.status]++
 }
 for(const c of doc.claims){
  if(!record(c)||(c.finding!=='supported'&&c.finding!=='claim_unwitnessed')||!strings(c.criterion_ids,budget))return null
 }
 const evidence=new Map<string,number>()
 const eventIds=new Set<string>()
 for(const event of doc.events){
  if(!record(event)||!text(event.id)||!event.id||eventIds.has(event.id)||!text(event.type)||!record(event.payload))return null
  eventIds.add(event.id)
  const kind=event.type==='test.reported'?'Test reports':event.type==='artifact.recorded'?'Artifact records':event.type==='evidence.attached'?
   (text(event.payload.kind)?evidenceKinds.get(event.payload.kind):undefined)??'Other recorded evidence':null
  if(kind)evidence.set(kind,(evidence.get(kind)??0)+1)
 }
 // Only zoned ISO timestamps have a timezone-independent ordering. Invalid dates
 // stay visible as undated; never substitute the wall clock or array position.
 const instant=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(run.started)?Date.parse(run.started):NaN
 const row:OverviewRun={sourceId:value.sourceId,runId:run.run_id,project:run.project,agent:run.agent,
  started:Number.isFinite(instant)?run.started:null,criteria,reviewRequired:doc.review_required}
 return {row,instant,evidence}
}

/** Group by run_id (first valid snapshot wins), without mutating caller input.
 * All totals cover accepted records; latest is a bounded, newest-first subset.
 * Criteria, exit codes and claim findings never become a Phase F run verdict.
 */
export function aggregateRuns(input:unknown):RunAggregate{
 const result:RunAggregate={totalRuns:0,criteria:counts(),latest:[],agents:[],evidence:[],excluded:0,duplicates:0,omitted:0}
 if(!Array.isArray(input))return result
 result.omitted=Math.max(0,input.length-OVERVIEW_LIMITS.runs)
 const seen=new Set<string>(),rows:{row:OverviewRun;instant:number}[]=[]
 const agents=new Map<string,RunAggregate['agents'][number]>(),evidence=new Map<string,number>()
 const budget:WorkBudget={remaining:OVERVIEW_LIMITS.totalRecords}
 for(let i=0;i<Math.min(input.length,OVERVIEW_LIMITS.runs);i++){
  const entry=readEntry(input[i],budget)
  if(!entry){result.excluded++;continue}
  const {row}=entry
  if(seen.has(row.runId)){result.duplicates++;continue}
  seen.add(row.runId);rows.push(entry);result.totalRuns++
  const agent=agents.get(row.agent)??{agent:row.agent,runs:0,criteria:counts()}
  agent.runs++
  for(const s of criterionStates){result.criteria[s]+=row.criteria[s];agent.criteria[s]+=row.criteria[s]}
  agents.set(row.agent,agent)
  for(const [kind,count] of entry.evidence)evidence.set(kind,(evidence.get(kind)??0)+count)
 }
 rows.sort((a,b)=>a.row.started===null?(b.row.started===null?0:1):b.row.started===null?-1:b.instant-a.instant)
 result.latest=rows.slice(0,OVERVIEW_LIMITS.latest).map(e=>e.row)
 result.agents=[...agents.values()]
 result.evidence=[...evidence].map(([kind,count])=>({kind,count}))
 return result
}
