import type {RunEvent} from '../types.ts'
import {recordedTime} from './overview-data.ts'
import {recordedResult} from '../lib/recorded-steps.ts'
import {payloadSha256} from './evidenceBlob.ts'
const clockOptions:Intl.DateTimeFormatOptions={hour:'2-digit',minute:'2-digit',second:'2-digit',fractionalSecondDigits:3,timeZoneName:'short',hour12:false}
export function StepTime({event,base}:{event:RunEvent;base?:string}){
 const date=new Date(event.ts),ms=base?Date.parse(event.ts)-Date.parse(base):NaN
 const clock=Number.isNaN(date.getTime())?event.ts:new Intl.DateTimeFormat('en-GB',clockOptions).format(date)
 return <time className="step-time" dateTime={event.ts} title={recordedTime(event.ts)}><span>{clock}</span>{Number.isFinite(ms)&&<span className="step-relative">{ms<0?'−':'+'}{new Intl.NumberFormat('en-GB').format(Math.abs(ms))} ms</span>}</time>
}
export function StepFacts({event}:{event:RunEvent}){
 const result=recordedResult(event)
 return <span className="step-facts"><span><span className="step-field">By: </span><span className="step-actor">{event.actor.kind} / {event.actor.id}</span></span><span><span className="step-field">Result: </span><span className={`tone-${result.tone}`}>{result.text}</span></span></span>
}
export function RecordedOutput({event,blobs}:{event:RunEvent;blobs?:Record<string,string>}){
 const sha=payloadSha256(event.payload)
 if(!sha)return null
 const text=blobs?.[sha]
 if(text===undefined)return <p className="section-note">Content not exported</p>
 return <details className="recorded-content"><summary>Recorded content · {text.length} characters</summary><pre tabIndex={0}>{text}</pre></details>
}
