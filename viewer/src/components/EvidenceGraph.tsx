import { useMemo } from 'react'
import { Controls, Handle, Position, ReactFlow, useReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { RunDoc } from '../types.ts'
import type { DrawerTarget } from './Drawer.tsx'
import { buildEvidenceGraph, type EvidenceNode } from '../graph/evidence-graph.ts'
import { Card } from './ui/card.tsx'
import { Empty, EmptyDescription } from './ui/empty.tsx'

const kinds={claim:'Claim',criterion:'Kriterium',evidence:'Ereignis',file:'Datei'} as const
interface GraphData extends Record<string,unknown> { record: EvidenceNode; onOpen: (target: DrawerTarget)=>void }
type RecordNode=Node<GraphData,'record'>

function RecordNodeView({ data }: NodeProps<RecordNode>) {
  const {record,onOpen}=data
  const flow=useReactFlow()
  const detail=record.target.kind==='claim'?record.target.claim.finding:record.target.kind==='criterion'?record.target.criterion.status:''
  return <>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <button type="button" className={`graph-record nodrag nopan graph-${record.kind} graph-result-${record.tone}`} aria-label={`${kinds[record.kind]}: ${record.label}${detail?` · ${detail}`:''}`}
      title={record.label} onClick={event=>{event.stopPropagation();onOpen(record.target)}} onFocus={event=>{
        if(event.currentTarget.matches(':focus-visible')) void flow.fitView({nodes:[{id:record.id}],minZoom:1,maxZoom:1,duration:0})
      }}>
      <span className="graph-kind">{record.kind==='criterion'&&<span className={`status-dot tone-${record.tone}`} aria-hidden="true"/>}{kinds[record.kind]}{detail&&` · ${detail}`}</span><span className="graph-label">{record.label}</span>
    </button>
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </>
}
const nodeTypes={record:RecordNodeView}

export function EvidenceGraph({ doc, onOpenDrawer, onSelectNode }: {doc: RunDoc; onOpenDrawer: (target: DrawerTarget)=>void; onSelectNode?:(id:string)=>void}) {
  const graph=useMemo(()=>buildEvidenceGraph(doc),[doc])
  const nodes=useMemo<RecordNode[]>(()=>graph.nodes.map(record=>({id:record.id,type:'record',position:record.position,width:196,height:82,data:{record,onOpen:target=>{onSelectNode?.(record.id);onOpenDrawer(target)}}})),[graph,onOpenDrawer,onSelectNode])
  const edges=useMemo<Edge[]>(()=>graph.edges.map(edge=>({id:edge.id,source:edge.source,target:edge.target,ariaLabel:edge.recordedBy.join('; '),data:{recordedBy:edge.recordedBy},style:{stroke:`var(--${edge.tone==='open'?'neutral':edge.tone})`,strokeWidth:1.5,strokeDasharray:edge.tone==='open'?'5 4':undefined}})),[graph])
  return <Card className="panel evidence-graph" role="region" aria-label="Beleg-Graph">
    <div className="panel-heading"><h2>Beleg-Graph</h2><span className="section-note">{graph.nodes.length} Datensätze · {graph.edges.length} Verbindungen</span></div>
    <ul className="graph-legend" aria-label="Graph-Legende"><li><span className="legend-line tone-ok"/>Belegt</li><li><span className="legend-line tone-fail"/>Widerspricht</li><li><span className="legend-line tone-open dashed"/>Ohne Prüfnachweis</li></ul>
    <p className="section-note">Nur aufgezeichnete Verknüpfungen. Claims ohne Beleg bleiben allein.</p>
    {nodes.length===0 ? <Empty><EmptyDescription>Keine Graph-Datensätze exportiert.</EmptyDescription></Empty> : <>
      <div className="graph-canvas">
        <ReactFlow id="evidence-flow" nodes={nodes} edges={edges} nodeTypes={nodeTypes} colorMode="dark" fitView fitViewOptions={{padding:.12,minZoom:1,maxZoom:1}} minZoom={1} maxZoom={1.5}
          onNodeClick={(_,node)=>{onSelectNode?.(node.id);onOpenDrawer(node.data.record.target)}}
          nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable={false} edgesReconnectable={false} elementsSelectable={false}
          deleteKeyCode={null} zoomOnScroll={false} preventScrolling={false} aria-label="Interaktiver Beleg-Graph">
          <Controls showInteractive={false} aria-label="Graph vergrößern, verkleinern oder einpassen" />
        </ReactFlow>
      </div>
      <details className="graph-list"><summary>Alle Datensätze und Verknüpfungen als Liste</summary>
        <ul aria-label="Graph-Datensätze">{graph.nodes.map(node=><li key={node.id}><button type="button" onClick={()=>{onSelectNode?.(node.id);onOpenDrawer(node.target)}}>{kinds[node.kind]}: {node.label}</button></li>)}</ul>
        {graph.edges.length>0 && <ul aria-label="Aufgezeichnete Verknüpfungen">{graph.edges.map(edge=><li key={edge.id}>{graph.nodes.find(node=>node.id===edge.source)?.label} → {graph.nodes.find(node=>node.id===edge.target)?.label}<small>{edge.recordedBy.join('; ')}</small></li>)}</ul>}
      </details>
    </>}
  </Card>
}
