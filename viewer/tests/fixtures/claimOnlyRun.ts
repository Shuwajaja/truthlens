import publicRun from '../../public/run.json'
import type { RunDoc } from '../../src/types.ts'

/** Synthetic projection of one real claim, with no witnessed checks or evidence. */
export function claimOnlyRun(): RunDoc {
  const doc = structuredClone(publicRun as RunDoc)
  const claim = doc.claims[0]
  const event = doc.events.find(event => event.payload.claim_id === claim.claim_id)!
  doc.criteria = [{ ...doc.criteria[0], status: 'unverified', card: 'yellow', claimed: true, evidence: [] }]
  claim.criterion_ids = [doc.criteria[0].criterion_id]
  claim.finding = 'claim_unwitnessed'
  doc.claims = [claim]
  doc.events = [event]
  doc.run.events = 1
  doc.counts = { green: 0, yellow: 1, red: 0, gray: 0, outline: 0 }
  doc.artifacts = []
  doc.blobs = {}
  doc.review_required = false
  return doc
}
