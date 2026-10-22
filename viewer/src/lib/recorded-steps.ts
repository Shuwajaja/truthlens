import type {RunEvent} from '../types.ts'
import {testTone,type ResultTone} from './event-result.ts'
const taskTypes=new Set(['run.started','requirement.recorded','criterion.recorded','criteria.confirmed'])
/** Contiguous presentation groups only: never reorder events or manufacture workflow phases. */
export function groupRecordedPhases<T extends {event:RunEvent}>(items:readonly T[]){
 const groups:{kind:'Task'|'Result';items:T[]}[]=[]
 for(const item of items){
  const kind=taskTypes.has(item.event.type)?'Task':'Result',last=groups.at(-1)
  if(last?.kind===kind)last.items.push(item);else groups.push({kind,items:[item]})
 }
 return groups
}
export function recordedResult(event:RunEvent):{tone:ResultTone;text:string}{
 const p=event.payload,exit=Number.isInteger(p.exit_code)?`Exit code ${p.exit_code}`:undefined
 if(event.type==='test.reported'){
  const counts=['passed','failed','skipped'].flatMap(key=>Number.isInteger(p[key])&&(p[key] as number)>=0?[`${p[key]} ${key}`]:[])
  return {tone:testTone(event),text:[counts.join(' · ')||'Test counts not exported',exit].filter(Boolean).join(' · ')}
 }
 if(event.type==='agent.claim')return {tone:'open',text:'Claim only · not a test result'}
 if(event.type==='criteria.confirmed')return {tone:'open',text:'Confirmation recorded · not a test result'}
 if(event.type==='run.finished')return {tone:'open',text:exit?`${exit} · not approval`:'Exit code not exported · not approval'}
 if(exit)return {tone:'open',text:`${exit} · not a test result`}
 if(event.type==='evidence.attached'&&typeof p.result==='string')return {tone:'open',text:`Recorded: ${p.result} · not a test result`}
 return {tone:'open',text:'Record only · no test result'}
}
