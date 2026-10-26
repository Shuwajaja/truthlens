import type {ExportIntegrity} from './cross-run-data.ts'
import type {OverviewCopy} from './overview-copy.ts'

/** Displays the supplied export result; performs no verification in the browser. */
export function OverviewIntegrity({integrity,copy,count}:{integrity:ExportIntegrity;copy:OverviewCopy;count?:number}){
 const label=integrity==='signature-checked'?copy.signatureChecked:integrity==='hash-only'?copy.hashOnly:integrity==='failed'?copy.integrityFailed:copy.signatureUnchecked
 return <span className="overview-seal" data-integrity={integrity}>{count!==undefined&&<>{count} · </>}<span>{label}</span></span>
}
