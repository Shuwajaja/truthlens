import {isStatusResult,reasonLabels,statusLabels,unavailableStatus,type StatusResult} from '../status-result.ts'
import './status-deck.css'

export function StatusDeck({result}:{result:StatusResult}){
 const safe=isStatusResult(result)?result:unavailableStatus
 return <div className="status-deck" aria-live="polite" aria-atomic="true">
  <p className="status-deck-result" data-testid="audit-status" data-status={safe.status}>{statusLabels[safe.status]}</p>
  <p>{reasonLabels[safe.reason_code]}</p>
  <p className="status-deck-boundary">Integrity is not approval</p>
 </div>
}
