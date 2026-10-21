import { ArrowUpRight, CircleDot, FileDiff, ListChecks, MessageSquare, Shield } from 'lucide-react'
import type { RunDoc } from '../types.ts'
import type { Lens } from '../lens.ts'
import type { DrawerTarget } from './Drawer.tsx'
import { RenderView } from '../renderkit/RenderView.tsx'
import { StatusBadge, Badge } from './ui/badge.tsx'
import { Button } from './ui/button.tsx'
import { Card } from './ui/card.tsx'
import { Empty, EmptyDescription } from './ui/empty.tsx'
import { ScrollArea, ScrollBar } from './ui/scroll-area.tsx'
import { Separator } from './ui/separator.tsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.tsx'
import { recordedDiff, recordedTime } from './overview-data.ts'

export function Overview({ doc, lens, onOpenDrawer }: { doc: RunDoc; lens: Lens; onOpenDrawer: (target: DrawerTarget) => void }) {
  const diff = recordedDiff(doc)
  const events = new Map(doc.events.map(event => [event.id, event]))
  const recent = [...doc.events].sort((a,b) => a.seq-b.seq).slice(-5)
  const firstUnwitnessed = doc.claims.find(claim => claim.finding === 'claim_unwitnessed')
  return <div className="overview">
    <div className="page-heading"><div><h1>Projektübersicht</h1><p>Läufe, Aussagen und was davon wirklich belegt ist.</p></div><Badge>{doc.run.agent}</Badge></div>
    <div className="status-grid">
      <Card className="status-card"><div className="card-label"><ListChecks size={16} aria-hidden="true" /> Fachliche Prüfung</div>
        <div className="status-value text-warning">{doc.review_required ? 'Prüfung offen' : 'Nicht ausgewiesen'}</div><p>Integrität ist keine Abnahme.</p></Card>
      <Card className="status-card"><div className="card-label"><CircleDot size={16} aria-hidden="true" /> Kriterien fehlgeschlagen</div>
        <div className="status-value text-destructive" data-testid="failed-count">{doc.counts.red}</div><p>{doc.counts.green} von {doc.criteria.length} Kriterien: met</p></Card>
      <Card className="status-card"><div className="card-label"><MessageSquare size={16} aria-hidden="true" /> Aussagen ohne Beleg</div>
        <div className="status-value" data-testid="unwitnessed-count">{doc.claims.filter(claim => claim.finding === 'claim_unwitnessed').length}</div><p>Finding: claim_unwitnessed</p></Card>
      <Card className="status-card"><div className="card-label"><Shield size={16} aria-hidden="true" /> Integrität</div>
        <StatusBadge source="integrity" verified={doc.verified} integrity={doc.integrity} /><p>Prüfstand des Exports</p></Card>
    </div>

    <div className="overview-columns">
      <Card className="panel" role="region" aria-label="Exportierte Läufe">
        <div className="panel-heading"><h2>Exportierte Läufe</h2><Badge>1 Lauf</Badge></div>
        <p className="section-note">Dieser Export enthält einen Lauf; keine weitere Laufhistorie.</p>
        <Table><TableHeader><TableRow><TableHead>Projekt / Agent</TableHead><TableHead>Exit-Code</TableHead></TableRow></TableHeader>
          <TableBody><TableRow><TableCell className="whitespace-normal"><strong>{doc.run.project}</strong><p className="text-muted-foreground mt-1">{doc.run.agent}</p></TableCell>
            <TableCell>{doc.run.exit_code ?? 'Nicht exportiert'}</TableCell></TableRow></TableBody></Table>
        <dl className="run-times"><div><dt>Start</dt><dd>{recordedTime(doc.run.started)}</dd></div><div><dt>Ende</dt><dd>{doc.run.finished ? recordedTime(doc.run.finished) : 'Nicht exportiert'}</dd></div></dl>
      </Card>
      <Card className="panel diff-panel">
        <div className="panel-heading"><h2><FileDiff size={17} aria-hidden="true" /> Code-Diff</h2><Badge>Exportierter Inhalt</Badge></div>
        {diff ? <><ScrollArea className="diff-preview" viewportLabel="Exportierter Code-Diff">
          <RenderView input={{ kind: 'blob', mediaType: 'text/x-diff', text: diff.text }} /><ScrollBar orientation="horizontal" /></ScrollArea>
          <Button variant="outline" size="sm" onClick={() => onOpenDrawer({ kind: 'event', event: diff.event })}>Diff ansehen<ArrowUpRight aria-hidden="true" /></Button></>
          : <Empty><EmptyDescription>Kein Code-Diff exportiert.</EmptyDescription></Empty>}
      </Card>
    </div>

    <Card className="panel criteria-panel" role="region" aria-label="Kriterien und Belege">
      <div className="panel-heading"><h2>Kriterien &amp; Belege</h2><span className="section-note">Status aus dem Export</span></div>
      <p className="recorded-headline">{doc.headline.join(' ')}</p>
      {doc.criteria.length === 0 ? <Empty><EmptyDescription>Keine Kriterien exportiert.</EmptyDescription></Empty> : <ul className="criterion-list">
        {doc.criteria.map((criterion, index) => <li key={criterion.criterion_id}>
          <button type="button" className="criterion-button" aria-label={`Belege: ${criterion.text}`} aria-describedby={`criterion-description-${index} criterion-status-${index}`} onClick={() => onOpenDrawer({
            kind: 'criterion', criterion, matched: criterion.evidence.flatMap(id => { const event=events.get(id); return event ? [event] : [] }),
          })}>
            <span className="criterion-content"><strong>{criterion.text}</strong><span id={`criterion-description-${index}`}>{criterion.plain}</span></span>
            <span className="criterion-labels" id={`criterion-status-${index}`}><StatusBadge source="criterion" status={criterion.status} />{criterion.claimed && <span className="text-warning text-xs">claimed</span>}</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        </li>)}
      </ul>}
      {firstUnwitnessed && <p className="claim-callout"><strong>Claim · claim_unwitnessed</strong><br />{firstUnwitnessed.text}</p>}
    </Card>

    <Card className="panel">
      <div className="panel-heading"><h2>Zeitachse</h2><span className="section-note">{doc.events.length} Ereignisse · letzte {recent.length}</span></div>
      {recent.length === 0 ? <Empty><EmptyDescription>Keine Ereignisse exportiert.</EmptyDescription></Empty> : <ol className="recent-events">
        {recent.map((event, index) => <li key={event.id}>{index > 0 && <Separator />}<button type="button" aria-label={`Ereignis #${event.seq}: ${event.summary}`} onClick={() => onOpenDrawer({ kind: 'event', event })}>
          <CircleDot size={14} aria-hidden="true" /><span><span className="event-summary">{event.summary}</span>{lens === 'developer' && <code>#{event.seq} · {event.type}</code>}<time dateTime={event.ts}>{recordedTime(event.ts)}</time></span><ArrowUpRight size={14} aria-hidden="true" />
        </button></li>)}
      </ol>}
    </Card>
  </div>
}
