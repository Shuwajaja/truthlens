import {describe,expect,it} from 'vitest'
import {aggregateRuns,OVERVIEW_LIMITS} from '../src/workspace/cross-run-data.ts'
import run from '../fixtures/demo-run.json'

const entry=(id='a',started='2026-10-25T00:30:00Z')=>{const doc=structuredClone(run);doc.run.run_id=id;doc.run.started=started;return {sourceId:`source-${id}`,doc}}
describe('pure cross-run aggregation of exported fields',()=>{
 it('counts all four criterion states and event evidence without double-counting artifact metadata',()=>{
  const a=entry(),before=JSON.stringify(a),result=aggregateRuns([a])
  expect(result.totalRuns).toBe(1)
  for(const status of ['met','unmet','unverified','proposed'])expect(result.criteria[status]).toBe(a.doc.criteria.filter(c=>c.status===status).length)
  expect(result.evidence.reduce((n,e)=>n+e.count,0)).toBe(a.doc.events.filter(e=>['evidence.attached','test.reported','artifact.recorded'].includes(e.type)).length)
  expect(result.agents[0].criteria).toEqual(result.criteria)
  expect(JSON.stringify(a)).toBe(before)
  expect(result).not.toHaveProperty('passed')
 })
 it('deduplicates snapshots by run ID across sources; sorts actual instants with stable ties and undated runs last',()=>{
  const a=entry('a','2026-10-25T02:30:00+02:00'),b=entry('b','2026-10-25T02:15:00+01:00'),c=entry('c','not-a-date')
  const result=aggregateRuns([a,{...a,sourceId:'duplicate'},c,b])
  expect(result.totalRuns).toBe(3);expect(result.duplicates).toBe(1)
  expect(result.latest.map(r=>r.runId)).toEqual(['b','a','c'])
  expect(result.latest[2].started).toBeNull()
 })
 it('does not promote exit zero, claims, HMAC labels or all-met criteria into a Phase F verdict',()=>{
  const a=entry();a.doc.run.exit_code=0;a.doc.verified=true;a.doc.integrity='hmac'
  a.doc.criteria=[];a.doc.counts={green:0,yellow:0,red:0,gray:0,outline:0}
  const result=aggregateRuns([a])
  expect(result.totalRuns).toBe(1);expect(result.criteria.met).toBe(0)
  expect(result.latest[0]).not.toHaveProperty('status')
 })
 it('handles prototype-like agent names and unknown evidence kinds without object-key collisions',()=>{
  const a=entry();a.doc.run.agent='__proto__'
  a.doc.events=[{...a.doc.events[0],type:'evidence.attached',payload:{kind:'__proto__'}}]
  const result=aggregateRuns([a])
  expect(result.agents[0].agent).toBe('__proto__')
  expect(result.evidence).toEqual([{kind:'Other recorded evidence',count:1}])
 })
 it('rejects malformed records as a whole and never invents unknown criterion/claim states',()=>{
  const bad=entry();bad.doc.criteria[0].status='invented'
  const badClaim=entry();badClaim.doc.claims[0].finding='refuted' as never
  const result=aggregateRuns([null,{},bad,badClaim,entry()])
  expect(result.totalRuns).toBe(1);expect(result.excluded).toBe(4)
  expect(aggregateRuns(null).totalRuns).toBe(0)
 })
 it('bounds huge, sparse and nested input before traversing it and reports omitted records',()=>{
  const huge=entry();huge.doc.events=new Array(OVERVIEW_LIMITS.recordsPerRun+1)
  const nested=entry();nested.doc.criteria[0].evidence=new Array(OVERVIEW_LIMITS.recordsPerRun+1)
  expect(aggregateRuns([huge,nested]).excluded).toBe(2)
  const many=Array.from({length:OVERVIEW_LIMITS.runs+3},(_,i)=>entry(String(i)))
  const result=aggregateRuns(many)
  expect(result.totalRuns).toBe(OVERVIEW_LIMITS.runs);expect(result.omitted).toBe(3)
  expect(result.latest).toHaveLength(14)
  expect(aggregateRuns(new Array(2**32-1)).omitted).toBe(2**32-1-OVERVIEW_LIMITS.runs)
 })
 it('charges malformed and duplicate documents against the global work budget',()=>{
  const a=entry(),event=a.doc.events[0]
  a.doc.events=Array.from({length:10_000},(_,i)=>({...event,id:`event-${i}`}))
  const copies=Array.from({length:15},()=>a)
  const result=aggregateRuns([...copies,entry('after-budget')])
  expect(result.latest.some(row=>row.runId==='after-budget')).toBe(false)
  expect(result.excluded).toBeGreaterThan(0)
 })
 it('counts proposed criteria without conflating them with unverified criteria',()=>{
  const a=entry();a.doc.criteria[0].status='proposed'
  expect(aggregateRuns([a]).criteria).toMatchObject({proposed:1,met:0,unverified:1})
 })
})
