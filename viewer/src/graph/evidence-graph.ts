import type { RunDoc, RunEvent } from '../types.ts'
import type { DrawerTarget } from '../components/Drawer.tsx'

export interface EvidenceNode {
  id: string
  kind: 'claim' | 'criterion' | 'evidence' | 'file'
  label: string
  target: DrawerTarget
  position: { x: number; y: number }
}
export interface EvidenceEdge { id: string; source: string; target: string; recordedBy: string[] }

/** Ambiguous references must not silently select one of several records. */
function uniqueIndex<T>(items: readonly T[], key: (item: T) => string) {
  const index=new Map<string, T | undefined>()
  for (const item of items) { const id=key(item); index.set(id, index.has(id) ? undefined : item) }
  return index
}

/** A deterministic view of exported relationships, not a new verification or finding. */
export function buildEvidenceGraph(doc: RunDoc): { nodes: EvidenceNode[]; edges: EvidenceEdge[] } {
  const nodes: EvidenceNode[]=[]
  const edges: EvidenceEdge[]=[]
  const events=uniqueIndex(doc.events,event=>event.id)
  const claims=uniqueIndex(doc.events.filter(event=>event.type==='agent.claim' && typeof event.payload.claim_id==='string'),event=>event.payload.claim_id as string)
  const artifactEvents=uniqueIndex(doc.events.filter(event=>event.type==='artifact.recorded' && typeof event.payload.artifact_id==='string'),event=>event.payload.artifact_id as string)
  const criterionEvidence=new Set(doc.criteria.flatMap(criterion=>criterion.evidence))
  const evidence=doc.events.filter(event=>['evidence.attached','test.reported','artifact.recorded'].includes(event.type) || criterionEvidence.has(event.id)).sort((a,b)=>a.seq-b.seq)
  const addNode=(kind: EvidenceNode['kind'], index: number, column: number, label: string, target: DrawerTarget) => {
    const node={ id: `${kind}:${index}`, kind, label, target, position: { x: column*240, y: index*100 } }
    nodes.push(node); return node
  }
  const claimNodes=doc.claims.map((claim,index)=>addNode('claim',index,0,claim.text,{kind:'claim',claim,event:claims.get(claim.claim_id)}))
  const criterionNodes=doc.criteria.map((criterion,index)=>addNode('criterion',index,1,criterion.text,{kind:'criterion',criterion,matched:criterion.evidence.flatMap(id=>{const event=events.get(id);return event?[event]:[]})}))
  const evidenceNodes=evidence.map((event,index)=>addNode('evidence',index,2,event.summary,{kind:'event',event}))
  const fileNodes=doc.artifacts.map((artifact,index)=>addNode('file',index,3,artifact.path,{kind:'artifact',artifact,event:artifactEvents.get(artifact.artifact_id)}))
  const criteriaById=uniqueIndex(criterionNodes,node=>node.target.kind==='criterion'?node.target.criterion.criterion_id:'')
  const evidenceById=uniqueIndex(evidenceNodes,node=>node.target.kind==='event'?node.target.event.id:'')
  const filesById=uniqueIndex(fileNodes,node=>node.target.kind==='artifact'?node.target.artifact.artifact_id:'')
  const filesByHash=uniqueIndex(fileNodes,node=>node.target.kind==='artifact'?node.target.artifact.sha256:'')
  const addEdge=(source: EvidenceNode | undefined, target: EvidenceNode | undefined, recordedBy: string) => {
    if (!source || !target) return
    const id=`${source.id}->${target.id}`
    const existing=edges.find(edge=>edge.id===id)
    if(existing) { if(!existing.recordedBy.includes(recordedBy)) existing.recordedBy.push(recordedBy) }
    else edges.push({id,source:source.id,target:target.id,recordedBy:[recordedBy]})
  }
  for(const node of claimNodes) {
    if(node.target.kind!=='claim' || node.target.claim.finding!=='supported') continue
    for(const id of node.target.claim.criterion_ids) {
      const criterion=criteriaById.get(id)
      // Even a supported finding cannot manufacture a missing witness in this export.
      if(criterion?.target.kind==='criterion' && criterion.target.matched.length>0)
        addEdge(node,criterion,`claim.${node.target.claim.claim_id}.criterion_ids`)
    }
  }
  for(const node of criterionNodes) {
    if(node.target.kind!=='criterion' || criteriaById.get(node.target.criterion.criterion_id)!==node) continue
    for(const id of node.target.criterion.evidence) addEdge(node,evidenceById.get(id),`criterion.${node.target.criterion.criterion_id}.evidence`)
  }
  for(const node of evidenceNodes) {
    if(node.target.kind!=='event') continue
    const event: RunEvent=node.target.event
    if(events.get(event.id)!==event) continue
    const ids=event.payload.criterion_ids
    if(Array.isArray(ids)) for(const id of ids) if(typeof id==='string') addEdge(criteriaById.get(id),node,`event.${event.id}.payload.criterion_ids`)
    for(const key of ['artifact_id','report_artifact_id'] as const) {
      const id=event.payload[key]
      if(typeof id==='string') addEdge(node,filesById.get(id),`event.${event.id}.payload.${key}`)
    }
    if(typeof event.payload.sha256==='string') addEdge(node,filesByHash.get(event.payload.sha256),`event.${event.id}.payload.sha256`)
  }
  return {nodes,edges}
}
