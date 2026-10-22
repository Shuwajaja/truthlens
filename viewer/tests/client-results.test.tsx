// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,it,expect,vi} from 'vitest'
import {cleanup,render,screen,within,fireEvent} from '@testing-library/react'
import {ClaimedVsProven} from '../src/components/ClaimedVsProven.tsx'
import {Overview} from '../src/components/Overview.tsx'
import type {RunDoc} from '../src/types.ts'
import publicRun from '../public/run.json'
const doc=publicRun as RunDoc
afterEach(cleanup)
it.each(['client','developer'] as const)('shows each actual claim beside criterion outcome and only its referenced evidence in %s',lens=>{
 const open=vi.fn(),before=JSON.stringify(doc)
 render(<ClaimedVsProven doc={doc} lens={lens} onOpenDrawer={open}/> )
 for(const claim of doc.claims){
  const article=within(screen.getByText(`“${claim.text}”`).closest('article')!)
  const criterion=doc.criteria.find(c=>claim.criterion_ids.includes(c.criterion_id))!
  expect(article.getByText(criterion.text)).toBeTruthy()
  expect(article.getByText('Recorded result')).toBeTruthy()
  expect(article.getByText('· '+criterion.status)).toBeTruthy()
  if(criterion.evidence.length){
   const event=doc.events.find(e=>e.id===criterion.evidence[0])!
   expect(article.getByText(event.summary)).toBeTruthy()
   fireEvent.click(article.getByRole('button',{name:'Open event record'}))
   expect(open.mock.calls.at(-1)![0].event).toBe(event)
  }else{
   expect(article.getByText('Not checked — no confirmed result exported.')).toBeTruthy()
   expect(article.getByText('No evidence events exported for this criterion.')).toBeTruthy()
   expect(article.queryByRole('button',{name:'Open event record'})).toBeNull()
  }
 }
 expect(JSON.stringify(doc)).toBe(before)
})
it('shows the actual related claim with selected Overview result without changing lens',()=>{
 render(<Overview doc={doc} lens="client" onOpenDrawer={()=>{}}/> )
 for(const criterion of doc.criteria){
  fireEvent.click(screen.getByRole('button',{name:name=>name.startsWith('Evidence:')&&name.includes(criterion.text)}))
  const detail=within(screen.getByRole('region',{name:'Criterion detail'}))
  for(const claim of doc.claims.filter(c=>c.criterion_ids.includes(criterion.criterion_id)))expect(detail.getByText(`“${claim.text}”`)).toBeTruthy()
  expect(detail.getByText('Recorded result')).toBeTruthy()
 }
})
it('does not manufacture evidence or results from supported claims, unrelated events or dangling references',()=>{
 const value=structuredClone(doc)
 value.claims=value.claims.map(c=>({...c,finding:'supported'}))
 value.criteria=value.criteria.map(c=>({...c,evidence:['missing-event'],status:'unverified'}))
 render(<ClaimedVsProven doc={value} lens="client" onOpenDrawer={()=>{}}/> )
 expect(screen.getAllByText('Not checked — no confirmed result exported.')).toHaveLength(3)
 expect(screen.getAllByText('Some referenced evidence events were not exported.')).toHaveLength(3)
 expect(screen.queryByRole('button',{name:'Open event record'})).toBeNull()
 expect(screen.queryByText(/Tests run by TruthLens/)).toBeNull()
})
it('keeps missing criterion links and absent Overview claims honest',()=>{
 const value=structuredClone(doc);value.claims=[{...doc.claims[0],criterion_ids:['missing-criterion']}]
 const {unmount}=render(<ClaimedVsProven doc={value} lens="client" onOpenDrawer={()=>{}}/> )
 expect(screen.getByText('No matching criterion exported for this claim.')).toBeTruthy()
 expect(screen.queryByText('Recorded result')).toBeNull()
 unmount();render(<Overview doc={{...doc,claims:[]}} lens="client" onOpenDrawer={()=>{}}/> )
 expect(screen.getByText('No agent claim exported for this criterion.')).toBeTruthy()
})
it('retains multiple claims for the selected criterion instead of choosing by text similarity',()=>{
 const value=structuredClone(doc);value.claims=[...value.claims,{...doc.claims[1],claim_id:'synthetic-extra',text:'Synthetic linked claim',criterion_ids:['c2']}]
 render(<Overview doc={value} lens="client" onOpenDrawer={()=>{}}/> )
 const detail=within(screen.getByRole('region',{name:'Criterion detail'}))
 expect(detail.getByText('“Synthetic linked claim”')).toBeTruthy()
 expect(detail.getByText(`“${doc.claims[1].text}”`)).toBeTruthy()
 expect(detail.queryByText(`“${doc.claims[0].text}”`)).toBeNull()
})
it('keeps a multi-criterion claim and partial evidence links explicit without substituting unrelated events',()=>{
 const value=structuredClone(doc),open=vi.fn()
 value.claims=[{...doc.claims[0],criterion_ids:['c1','missing-criterion','c3']}]
 value.criteria[0].evidence=[...value.criteria[0].evidence,'missing-event']
 render(<ClaimedVsProven doc={value} lens="client" onOpenDrawer={open}/> )
 expect(screen.getByText('Some referenced criteria were not exported.')).toBeTruthy()
 expect(screen.getByText('Some referenced evidence events were not exported.')).toBeTruthy()
 expect(screen.getByText('· met')).toBeTruthy()
 expect(screen.getByText('· unverified')).toBeTruthy()
 expect(screen.queryByText('· unmet')).toBeNull()
 const event=value.events.find(e=>e.id===value.criteria[0].evidence[0])!
 expect(screen.getAllByRole('button',{name:'Open event record'})).toHaveLength(1)
 fireEvent.click(screen.getByRole('button',{name:'Open event record'}))
 expect(open.mock.calls[0][0].event).toBe(event)
})
