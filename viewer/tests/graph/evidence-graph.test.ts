import { describe, expect, it } from 'vitest'
import { buildEvidenceGraph } from '../../src/graph/evidence-graph.ts'
import type { RunDoc } from '../../src/types.ts'
import publicRun from '../../public/run.json'
import { claimOnlyRun } from '../fixtures/claimOnlyRun.ts'

const doc=publicRun as RunDoc

describe('recorded evidence graph', () => {
  it('builds the demo graph deterministically without changing RunDoc', () => {
    const original=structuredClone(doc)
    const graph=buildEvidenceGraph(doc)
    expect(graph.nodes.filter(n=>n.kind==='claim')).toHaveLength(3)
    expect(graph.nodes.filter(n=>n.kind==='criterion')).toHaveLength(3)
    expect(graph.nodes.filter(n=>n.kind==='file')).toHaveLength(1)
    expect(graph.nodes.filter(n=>n.kind==='evidence')).toHaveLength(6)
    expect(graph.edges).toHaveLength(4)
    expect(buildEvidenceGraph(doc)).toEqual(graph)
    expect(doc).toEqual(original)
    for(const edge of graph.edges){
      expect(graph.nodes.some(n=>n.id===edge.source)).toBe(true)
      expect(graph.nodes.some(n=>n.id===edge.target)).toBe(true)
      expect(edge.recordedBy.length).toBeGreaterThan(0)
    }
  })
  it('keeps every unwitnessed claim isolated even if it names a failed criterion with evidence', () => {
    const graph=buildEvidenceGraph(doc)
    for(const node of graph.nodes.filter(n=>n.kind==='claim'&&n.target.kind==='claim'&&n.target.claim.finding==='claim_unwitnessed')){
      expect(graph.edges.filter(e=>e.source===node.id||e.target===node.id)).toEqual([])
    }
  })
  it('does not invent evidence for a claim-only run', () => {
    const graph=buildEvidenceGraph(claimOnlyRun())
    expect(graph.nodes.filter(n=>n.kind==='evidence'||n.kind==='file')).toHaveLength(0)
    expect(graph.edges).toEqual([])
    expect(graph.nodes.find(n=>n.kind==='claim')?.target.kind).toBe('claim')
  })
  it('does not turn supported into an evidence link when the referenced evidence is absent', () => {
    const changed=claimOnlyRun();changed.claims[0].finding='supported'
    changed.criteria[0].evidence=['missing-event']
    const graph=buildEvidenceGraph(changed)
    expect(graph.edges).toEqual([])
    expect(graph.nodes.some(n=>n.label==='missing-event')).toBe(false)
  })
  it('links a file only through an exact recorded artifact reference or content hash', () => {
    const graph=buildEvidenceGraph(doc)
    const file=graph.nodes.find(n=>n.kind==='file')!
    const edge=graph.edges.find(e=>e.target===file.id)!
    const source=graph.nodes.find(n=>n.id===edge.source)!
    expect(source.target.kind).toBe('event')
    if(source.target.kind==='event') expect(source.target.event.payload.artifact_id).toBe(doc.artifacts[0].artifact_id)
    const changed=structuredClone(doc)
    changed.events=changed.events.filter(e=>e.type!=='artifact.recorded')
    expect(buildEvidenceGraph(changed).edges.some(e=>e.target===file.id)).toBe(false)
  })
  it('omits unknown endpoints and ambiguous duplicate references rather than inventing nodes or joining records', () => {
    const changed=structuredClone(doc)
    changed.criteria[0].evidence.push('missing-event')
    const witness=changed.events.find(e=>e.id===changed.criteria[0].evidence[0])!
    changed.events.push({...witness,seq:99})
    const graph=buildEvidenceGraph(changed)
    expect(new Set(graph.nodes.map(n=>n.id)).size).toBe(graph.nodes.length)
    const criterion=graph.nodes.find(n=>n.kind==='criterion'&&n.target.kind==='criterion'&&n.target.criterion.criterion_id==='c1')!
    expect(graph.edges.filter(e=>e.source===criterion.id||e.target===criterion.id)).toEqual([])
  })
})
