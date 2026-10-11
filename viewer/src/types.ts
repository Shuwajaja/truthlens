// Shape of `truthlens export <run-dir>` (src/truthlens/export.py). Only verified runs are exported.
export type Card = 'green' | 'yellow' | 'red' | 'gray' | 'outline'
export interface Criterion { criterion_id: string; text: string; status: string; evidence: string[]; claimed: boolean; card: Card; plain: string }
export interface Claim { claim_id: string; text: string; criterion_ids: string[]; finding: 'supported' | 'claim_unwitnessed' }
export interface Artifact { artifact_id: string; path: string; sha256: string; kind: string; provenance: string }
export interface RunEvent { seq: number; id: string; ts: string; type: string; actor: { kind: string; id: string }; summary: string; hash: string; payload: Record<string, unknown> }
export interface RunDoc {
  verified: boolean
  headline: string[]
  review_required: boolean
  run: { run_id: string; project: string; agent: string; command: string; started: string; finished: string | null; exit_code: number | null; ledger_last_hash: string; events: number }
  counts: Record<Card, number>
  criteria: Criterion[]; claims: Claim[]; artifacts: Artifact[]; events: RunEvent[]
  /** sha256 hex → exported text (optional; present when export embeds blob bodies). */
  blobs?: Record<string, string>
}
