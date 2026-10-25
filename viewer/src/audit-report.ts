/** Presentation of existing stored audit v1 reports; no verification occurs here. */
export type CheckOutcome='supported'|'contradictory'|'not_checkable'|'not_applicable'
export type AuditCheck={rule_id:string;outcome:CheckOutcome;required:boolean;message:string;event_ids:string[];criterion_ids:string[];expected?:string|number|null;actual?:string|number|null}
export type AuditReport={audit_version:1;run_id:string;ledger_last_hash:string;checks:AuditCheck[];limitations:string[]}
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value)
const text=(value:unknown):value is string=>typeof value==='string'&&value.length<=8192
const texts=(value:unknown):value is string[]=>Array.isArray(value)&&value.length<=10000&&value.every(text)
const scalar=(value:unknown)=>value===undefined||value===null||text(value)||(typeof value==='number'&&Number.isSafeInteger(value))
export function isAuditReport(value:unknown):value is AuditReport{
 return object(value)&&value.audit_version===1&&text(value.run_id)&&text(value.ledger_last_hash)
  &&texts(value.limitations)&&Array.isArray(value.checks)&&value.checks.length<=10000&&value.checks.every(check=>
   object(check)&&typeof check.rule_id==='string'&&/^TL-AUD-0(?:0[1-9]|1[0-2])$/.test(check.rule_id)
   &&typeof check.outcome==='string'&&['supported','contradictory','not_checkable','not_applicable'].includes(check.outcome)
   &&typeof check.required==='boolean'&&text(check.message)&&texts(check.event_ids)&&texts(check.criterion_ids)
   &&scalar(check.expected)&&scalar(check.actual))
}
export const outcomeLabels:Record<CheckOutcome,string>={supported:'Checked within scope',contradictory:'Check failed',not_checkable:'Not checked',not_applicable:'Not applicable'}
/** Keep contradictory and incomplete checks even when the same rule also passed. */
export function checkSummary(checks:AuditCheck[]):{outcome:CheckOutcome;label:string}{
 const outcome=checks.some(c=>c.outcome==='contradictory')?'contradictory':!checks.length||checks.some(c=>c.outcome==='not_checkable')?'not_checkable':checks.some(c=>c.outcome==='supported')?'supported':'not_applicable'
 return {outcome,label:outcome==='not_checkable'&&checks.some(c=>c.outcome==='supported')?'Partially checked':outcomeLabels[outcome]}
}
