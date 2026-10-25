/** Wire validation and fixed presentation copy only; Python owns the projection. */
export type StatusResult={status:'passed'|'failed'|'not_checkable';reason_code:string}
const reasons:Record<string,StatusResult['status']>={
 checks_passed:'passed',checks_failed:'failed',incomplete_checks:'not_checkable',
 authentication_unchecked:'not_checkable',source_unavailable:'not_checkable',
 identity_mismatch:'not_checkable',invalid_report:'not_checkable',running:'not_checkable',
 error:'not_checkable',interrupted:'not_checkable',
}
export const unavailableStatus:StatusResult={status:'not_checkable',reason_code:'source_unavailable'}
export function isStatusResult(value:unknown):value is StatusResult{
 if(typeof value!=='object'||value===null||Array.isArray(value))return false
 const record=value as Record<string,unknown>
 return Object.keys(record).length===2&&Object.hasOwn(record,'status')&&Object.hasOwn(record,'reason_code')
  &&typeof record.reason_code==='string'&&Object.hasOwn(reasons,record.reason_code)&&reasons[record.reason_code]===record.status
}
export const statusLabels={passed:'Passed',failed:'Failed',not_checkable:'Not checkable'}
export const reasonLabels:Record<string,string>={
 checks_passed:'Recorded checks passed within scope.',checks_failed:'Recorded checks failed.',
 incomplete_checks:'Required checks or evidence are incomplete.',authentication_unchecked:'Signature not checked.',
 source_unavailable:'Source unavailable.',identity_mismatch:'Source identity mismatch.',invalid_report:'Invalid stored audit.',
 running:'Audit is pending or running.',error:'Audit unavailable.',interrupted:'Updates interrupted.',
}
