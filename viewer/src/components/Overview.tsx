import {useMobile} from '../lib/use-mobile.ts'
import {useMemo,useState} from 'react'
import {buildEvidenceGraph} from '../graph/evidence-graph.ts'
import {NodeDetail} from './NodeDetail.tsx'
import { ArrowUpRight, FileDiff } from 'lucide-react'
import type { RunDoc } from '../types.ts'
import type { Lens } from '../lens.ts'
import type { DrawerTarget } from './Drawer.tsx'
import { EvidenceGraph } from './EvidenceGraph.tsx'
import { RenderView } from '../renderkit/RenderView.tsx'
import { StatusBadge, Badge } from './ui/badge.tsx'
import { Button } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { Empty, EmptyDescription } from './ui/empty.tsx'
import { ScrollArea, ScrollBar } from './ui/scroll-area.tsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.tsx'
import { recordedDiff, recordedTime, recordedDuration } from './overview-data.ts'

export function Overview({ doc, lens, onOpenDrawer }: { doc: RunDoc; lens: Lens; onOpenDrawer: (target: DrawerTarget) => void }) {
  const mobile=useMobile()
  const [selected,setSelected]=useState<string>()
  const graph=useMemo(()=>buildEvidenceGraph(doc),[doc])
  const selectedNode=graph.nodes.find(node=>node.id===selected)??graph.nodes.find(node=>node.kind==='criterion')??graph.nodes[0]
  const diff = recordedDiff(doc)
  const events = new Map(doc.events.map(event => [event.id, event]))
  const firstUnwitnessed = doc.claims.find(claim => claim.finding === 'claim_unwitnessed')
  const heading = (<div className="page-heading"><div><h1>Project overview</h1><p>Runs, claims, and what is actually proven.</p></div><Badge>{doc.run.agent}</Badge></div>)
  const statusCards = (<div className="status-grid">
      <Card className="status-card"><div className="card-label"><span className="status-dot tone-open"/>Overall status</div>
        <div className="status-value text-open" data-testid="overall-status">{doc.review_required ? 'Open' : 'Not stated'}</div><p>{doc.review_required ? 'Needs review · not approved' : 'No approval stated'}</p></Card>
      <Card className="status-card"><div className="card-label"><span className="status-dot tone-ok"/>Criteria proven</div>
        <div className="status-value" data-testid="met-count"><span className="text-ok">{doc.criteria.filter(criterion=>criterion.status==='met').length}</span> / {doc.criteria.length}</div><p>Recorded result: met</p></Card>
      <Card className="status-card"><div className="card-label"><span className="status-dot tone-fail"/>Failed</div>
        <div className="status-value text-fail" data-testid="failed-count">{doc.criteria.filter(criterion=>criterion.status==='unmet').length}</div><p>Criteria with result unmet</p></Card>
      <Card className="status-card"><div className="card-label"><span className="status-dot tone-open"/>Unproven</div>
        <div className="status-value text-open" data-testid="unwitnessed-count">{doc.criteria.filter(criterion=>criterion.status==='unverified'||criterion.status==='proposed').length}</div><p>Criteria without a confirmed result</p></Card>
    </div>)
  const runsPanel = (<Card className="panel runs-panel" role="region" aria-label="Exported runs">
        <div className="panel-heading"><h2>Exported runs</h2><Badge>1 run · needs review</Badge></div>
        <p className="section-note">This export has one run. No earlier runs.</p>
        <Table><TableHeader><TableRow><TableHead>Project / agent</TableHead><TableHead>Exit code</TableHead></TableRow></TableHeader>
          <TableBody><TableRow><TableCell className="whitespace-normal"><button type="button" className="run-open" aria-label={`Open run: ${doc.run.project}`} onClick={()=>onOpenDrawer({kind:'run',doc})}><strong>{doc.run.project}</strong></button><p className="text-muted-foreground mt-1">{doc.run.agent}</p></TableCell>
            <TableCell className="run-exit">{doc.run.exit_code ?? 'Not exported'}</TableCell></TableRow></TableBody></Table>
        <dl className="run-times"><div><dt>Start</dt><dd>{recordedTime(doc.run.started)}</dd></div><div><dt>End</dt><dd>{doc.run.finished ? recordedTime(doc.run.finished) : 'Not exported'}</dd></div><div><dt>Duration</dt><dd>{recordedDuration(doc.run.started,doc.run.finished)}</dd></div></dl>
      </Card>)
  const diffPanel = (<Card className="panel diff-panel">
        <div className="panel-heading"><h2><FileDiff size={17} aria-hidden="true" /> Code diff</h2><Badge>Not signed</Badge></div>
        {diff ? <><ScrollArea className="diff-preview" viewportLabel="Exported code diff">
          <RenderView input={{ kind: 'blob', mediaType: 'text/x-diff', text: diff.text }} /><ScrollBar orientation="horizontal" /></ScrollArea>
          <Button variant="outline" size="sm" onClick={() => onOpenDrawer({ kind: 'event', event: diff.event })}>View diff<ArrowUpRight aria-hidden="true" /></Button></>
          : <Empty><EmptyDescription>No code diff exported.</EmptyDescription></Empty>}
      </Card>)
  const graphPanel = (<EvidenceGraph doc={doc} onOpenDrawer={onOpenDrawer} onSelectNode={setSelected} />)
  const detailPanel = (<NodeDetail node={selectedNode} onOpenDrawer={onOpenDrawer}/>)
  const criteriaPanel = (<Card className="panel criteria-panel" role="region" aria-label="Criteria and evidence">
      <div className="panel-heading"><h2>Criteria &amp; Evidence</h2><span className="section-note">Exported status</span></div>
      <p className="recorded-headline">{doc.headline.join(' ')}</p>
      {doc.criteria.length === 0 ? <Empty><EmptyDescription>No criteria exported.</EmptyDescription></Empty> : <ul className="criterion-list">
        {doc.criteria.map((criterion, index) => <li key={criterion.criterion_id}>
          <button type="button" className="criterion-button" aria-describedby={`criterion-description-${index} criterion-status-${index}`} onClick={() => onOpenDrawer({
            kind: 'criterion', criterion, matched: criterion.evidence.flatMap(id => { const event=events.get(id); return event ? [event] : [] }),
          })}>
            <span className="sr-only">Evidence: </span><span className="criterion-content"><strong>{criterion.text}</strong><span id={`criterion-description-${index}`}>{criterion.plain}</span></span>
            <span className="criterion-labels" id={`criterion-status-${index}`}><StatusBadge source="criterion" status={criterion.status} />{criterion.claimed && <span className="text-open text-xs">claimed</span>}</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        </li>)}
      </ul>}
      {firstUnwitnessed && <p className="claim-callout"><strong>Claim · claim_unwitnessed</strong><br />{firstUnwitnessed.text}</p>}
    </Card>)
  const timelinePanel = (<Card className="panel timeline-panel"><RenderView input={{kind:'events',events:doc.events}} context={{lens,onOpenDrawer,headingLevel:2}}/></Card>)
  return <div className="overview">{heading}{statusCards}
    {mobile?<>{runsPanel}{criteriaPanel}{graphPanel}{timelinePanel}{diffPanel}{detailPanel}</>:<>
      <div className="overview-columns">{runsPanel}{diffPanel}</div>
      <div className="graph-evidence-row">{graphPanel}{detailPanel}</div>
      {criteriaPanel}{timelinePanel}
    </>}
  </div>
}
