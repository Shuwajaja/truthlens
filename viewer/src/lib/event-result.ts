import type {RunEvent} from '../types.ts'
export type ResultTone='ok'|'fail'|'open'
/** A recorded test result, never a statement about HMAC or human acceptance. */
export function testTone(event:RunEvent):ResultTone{
 if(event.type!=='test.reported'||!['wrapper','system'].includes(event.actor.kind))return 'open'
 const {passed,failed}=event.payload
 if(typeof failed==='number'&&Number.isInteger(failed)&&failed>0)return 'fail'
 if(failed===0&&typeof passed==='number'&&Number.isInteger(passed)&&passed>0)return 'ok'
 return 'open'
}
