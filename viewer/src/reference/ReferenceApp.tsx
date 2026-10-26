import {useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import './theme.css'
import {clock, copy, delta, duration, fullStamp, grouped, percent, relative, tenths, when} from './copy.ts'
import {catalogFromOperatorFile, displayTone, eligible, exportBody, filterRuns, metrics, shownSummary, type Catalog, type RunView, type Summary} from './model.ts'

type Navigate = (href: string) => void

function hrefOf(path: string, search: string) {
  return search ? `${path}?${search}` : path
}

function go(event: MouseEvent<HTMLAnchorElement>, navigate: Navigate) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  navigate(event.currentTarget.pathname + event.currentTarget.search)
}

function withParams(pathname: string, current: URLSearchParams, updates: Record<string, string | null>) {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === '') next.delete(key)
    else next.set(key, value)
  }
  next.delete('page')
  return hrefOf(pathname, next.toString())
}

function Fill({children}: {children: ReactNode}) {
  const [node, setNode] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    setNode(document.getElementById('tl-top-actions'))
  }, [])
  if (!node) return null
  return createPortal(children, node)
}

function Pill({summary, claims, integrity}: {summary: Summary; claims?: {reason_code?: string}[]; integrity?: RunView['integrity']}) {
  const tone = displayTone(summary, claims, integrity)
  const label = tone === 'confirmed' ? copy.confirmed : tone === 'refuted' ? copy.refuted : tone === 'unclear' ? copy.unclear : copy.damaged
  return <span className={`tl-pill ${tone}`}>{label}</span>
}

function reasonLabel(code: string) {
  if (code === 'benchmark_missing') return copy.doubtful
  if (code === 'witnessed_pass') return copy.witnessedPass
  if (code === 'witnessed_fail') return copy.witnessedFail
  if (code === 'no_criteria') return copy.noCriteria
  if (code === 'unwitnessed') return copy.unwitnessed
  return code
}

function AgentMark({catalog, id}: {catalog: Catalog; id: string | null | undefined}) {
  const agent = catalog.agents.find(item => item.id === id)
  if (!agent) return <span>{copy.unknown}</span>
  return <span className="tl-who"><span className={`tl-avatar ${agent.id}`} aria-hidden="true">{agent.initial}</span>{agent.name}</span>
}

function projectName(catalog: Catalog, id: string) {
  return catalog.projects.find(item => item.id === id)?.name ?? id
}

function Shell({catalog, pathname, search, navigate, children, crumb}: {catalog: Catalog | null; pathname: string; search: string; navigate: Navigate; children: ReactNode; crumb: string}) {
  const params = new URLSearchParams(search)
  const [open, setOpen] = useState(false)
  const demo = params.get('demo') === '1'
  const keep = demo ? '?demo=1' : ''
  const counts = catalog ? {
    runs: catalog.runs.filter(run => eligible(run, catalog.demo)).length,
    checks: catalog.runs.reduce((sum, run) => sum + (shownSummary(run) === 'damaged' ? 0 : run.claims.length), 0),
    records: catalog.runs.filter(run => shownSummary(run) !== 'damaged').length,
  } : null
  const item = (path: string, label: string, count?: number) => (
    <a href={`${path}${keep}`} aria-current={pathname === path ? 'page' : undefined} onClick={event => { setOpen(false); go(event, navigate) }}>
      <span>{label}</span>{count != null && <span className="tl-count">{grouped(count)}</span>}
    </a>
  )
  return (
    <div className="tl-ref" lang="de">
      <a className="tl-skip" href="#tl-main">{copy.skip}</a>
      <div className="tl-shell">
        <aside className={open ? 'tl-side open' : 'tl-side'} aria-label={copy.navLabel}>
          <div className="tl-brand"><span className="tl-mark" aria-hidden="true">T</span>{copy.brand}</div>
          <nav className="tl-nav" aria-label={copy.navLabel}>
            {item('/runs', copy.runs, counts?.runs)}
            {item('/checks', copy.checks, counts?.checks)}
            {item('/records', copy.records, counts?.records)}
          </nav>
          <div>
            <div className="tl-kicker">{copy.projects}</div>
            <div className="tl-projects">
              {catalog && catalog.projects.length > 0 ? catalog.projects.map(project => (
                <a key={project.id} href={withParams('/runs', params, {project: project.id})} aria-current={params.get('project') === project.id ? 'page' : undefined} onClick={event => go(event, navigate)}>
                  <span className={`tl-dot ${project.id}`} aria-hidden="true" />{project.name}
                </a>
              )) : <p className="tl-side-note">{copy.sideEmpty}</p>}
            </div>
          </div>
          <div className="tl-side-foot">
            {item('/settings', copy.settings)}
            <a href={`/doctor${keep}`} aria-current={pathname === '/doctor' ? 'page' : undefined} onClick={event => { setOpen(false); go(event, navigate) }}>
              <span>{copy.doctor}</span>
              <span className="tl-dot captured" title={copy.docIsolation} aria-hidden="true" />
            </a>
          </div>
        </aside>
        <div className="tl-main">
          <header className="tl-top">
            <div className="tl-crumb">
              <button type="button" className="tl-btn tl-menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>{copy.menu}</button>
              <span>{copy.brand}</span><span aria-hidden="true">/</span><b>{crumb}</b>
              {demo && <span className="tl-badge">{copy.demo}</span>}
            </div>
            <div className="tl-actions">
              <button type="button" className="tl-btn" onClick={() => navigate(hrefOf(pathname, new URLSearchParams({...Object.fromEntries(params), find: '1'}).toString()))}><span className="tl-kbd">⌘K</span>{copy.search}</button>
              <span id="tl-top-actions" />
            </div>
          </header>
          <main id="tl-main" aria-label={copy.mainLabel} className="tl-content">{children}</main>
        </div>
      </div>
    </div>
  )
}

function SearchDialog({catalog, onClose, navigate}: {catalog: Catalog; onClose: () => void; navigate: Navigate}) {
  const title = useId()
  const field = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')
  const previous = useRef<HTMLElement | null>(null)
  useEffect(() => {
    previous.current = document.activeElement as HTMLElement | null
    field.current?.focus()
    return () => previous.current?.focus()
  }, [])
  const matches = catalog.runs.filter(run => `${run.task} ${run.run_id} ${projectName(catalog, run.project_id)}`.toLowerCase().includes(text.trim().toLowerCase())).slice(0, 8)
  return (
    <div className="tl-search" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={root} role="dialog" aria-modal="true" aria-labelledby={title} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onClose() }
        if (event.key !== 'Tab' || !root.current) return
        const items = [...root.current.querySelectorAll<HTMLElement>('button, a, input')].filter(item => !item.hasAttribute('disabled'))
        const first = items[0]
        const last = items[items.length - 1]
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}>
        <h2 id={title}>{copy.searchTitle}</h2>
        <label htmlFor="tl-find">{copy.searchLabel}</label>
        <input id="tl-find" ref={field} value={text} onChange={event => setText(event.target.value)} />
        <ul>
          {matches.map(run => <li key={run.run_id}><a href={`/runs/${run.run_id}${catalog.demo ? '?demo=1' : ''}`} onClick={event => go(event, navigate)}>{run.task}</a></li>)}
          {text && matches.length === 0 && <li>{copy.nothingFound}</li>}
        </ul>
        <button type="button" className="tl-btn" onClick={onClose}>{copy.close}</button>
      </div>
    </div>
  )
}

function RunsPage({catalog, params, navigate, mode, onLoadFile, loadNote}: {catalog: Catalog; params: URLSearchParams; navigate: Navigate; mode: string | null; onLoadFile: (file: File) => void; loadNote: string | null}) {
  const filtered = useMemo(() => filterRuns(catalog.runs, catalog.now, params), [catalog, params])
  const numbers = metrics(filtered, catalog.demo)
  const rateSigned = filtered.filter(run => eligible(run, catalog.demo)).every(run => run.integrity === 'hmac')
  const range = params.get('range') ?? '7d'
  const windowLabel = range === '1d' ? copy.range1 : range === '30d' ? copy.range30 : range === 'all' ? copy.rangeAll : copy.runsWindow
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const slice = filtered.slice((page - 1) * 50, page * 50)
  const notable = numbers.notable ? catalog.agents.find(item => item.id === numbers.notable?.[0]) : null
  const set = (updates: Record<string, string | null>) => navigate(withParams('/runs', params, updates))
  if (mode === 'loading') return <div aria-busy="true"><p>{copy.loading}</p><div className="tl-skeleton" /><div className="tl-skeleton" /></div>
  if (mode === 'error') return <section className="tl-banner bad" role="alert"><h1>{copy.errorTitle}</h1><p>{copy.errorBody}</p><button type="button" className="tl-btn" onClick={() => set({state: null})}>{copy.retry}</button></section>
  if (mode === 'empty' || catalog.runs.length === 0) return (
    <section className="tl-start" aria-labelledby="tl-start-title">
      <header className="tl-welcome">
        <h1 id="tl-start-title">{copy.startTitle}</h1>
        <p>{copy.startLead}</p>
        <p>{copy.emptyTitle}</p>
        <p className="tl-sub">{copy.emptyBody}</p>
      </header>
      <ol className="tl-steps">
        <li>
          <p className="tl-step-index" aria-hidden="true">1</p>
          <h2>{copy.stepWorkspace}</h2>
          <p>{copy.stepWorkspaceBody}</p>
          <p className="tl-mono">{copy.stepWorkspaceCli}</p>
          <a className="tl-btn" href="/settings" onClick={event => go(event, navigate)}>{copy.connect}</a>
        </li>
        <li>
          <p className="tl-step-index" aria-hidden="true">2</p>
          <h2>{copy.stepLoad}</h2>
          <p>{copy.stepLoadBody}</p>
          <p className="tl-mono">{copy.loadCli}</p>
          <div className="tl-actions">
            <label className="tl-btn primary" htmlFor="tl-run-file">{copy.loadFile}</label>
            <a className="tl-btn" href="/runs?demo=1" onClick={event => go(event, navigate)}>{copy.sample}</a>
          </div>
          <input id="tl-run-file" className="tl-file" type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) onLoadFile(file) }} />
          {loadNote && <p role="status">{loadNote}</p>}
        </li>
        <li>
          <p className="tl-step-index" aria-hidden="true">3</p>
          <h2>{copy.stepRead}</h2>
          <p>{copy.stepReadBody}</p>
          <dl className="tl-mean">
            <div><dt>{copy.unclear}</dt><dd>{copy.meanUnknown}</dd></div>
            <div><dt>{copy.confirmed}</dt><dd>{copy.meanTrue}</dd></div>
            <div><dt>{copy.refuted}</dt><dd>{copy.meanFalse}</dd></div>
          </dl>
          <p>{copy.integrityHash}. {copy.integrityLine}</p>
        </li>
      </ol>
    </section>
  )
  return (
    <>
      {mode === 'offline' && <p className="tl-banner warn" role="status">{copy.offline}</p>}
      <header className="tl-head-row">
        <div>
          <h1>{copy.runs}</h1>
          <p className="tl-sub">{copy.intro} · {copy.source}: {catalog.source_label ?? copy.unknown}</p>
        </div>
      </header>
      {catalog.runs.length > 0 && <Fill><button type="button" className="tl-btn primary" onClick={() => set({check: '1'})}>{copy.check}</button></Fill>}
      <section className="tl-kpis" aria-label={copy.runs}>
        <article className="tl-card"><div className="tl-label">{windowLabel}</div><strong className={numbers.runs > 0 ? 'ok' : undefined}>{grouped(numbers.runs)}</strong><p className={range === '7d' && numbers.runs > (catalog.previous_window_runs ?? 0) ? 'tl-delta ok' : 'tl-delta'}>{range === '7d' && catalog.demo ? delta(numbers.runs, catalog.previous_window_runs) : copy.noComparison}</p></article>
        <article className="tl-card"><div className="tl-label">{copy.claimsChecked}</div><strong>{numbers.total ? grouped(numbers.total) : copy.unknown}</strong><p>{copy.average} {tenths(numbers.total, numbers.runs)} {copy.perRun}</p></article>
        <article className="tl-card"><div className="tl-label">{copy.confirmedRate}</div><strong className={rateSigned && numbers.counts.confirmed > 0 ? 'ok' : undefined}>{percent(numbers.counts.confirmed, numbers.total)}</strong><p title={copy.rateHint}>{percent(numbers.counts.refuted, numbers.total)} {copy.refuted} · {percent(numbers.counts.unclear, numbers.total)} {copy.unclear}</p></article>
        <article className="tl-card"><div className="tl-label">{copy.notable}</div><strong className="tl-agent-kpi">{notable ? <AgentMark catalog={catalog} id={notable.id} /> : copy.unknown}</strong><p>{numbers.notable ? `${grouped(numbers.notable[1])} ${copy.refutedClaims}` : copy.noNotable}</p></article>
      </section>
      <div className="tl-filters">
        <div className="tl-chips" role="group" aria-label={copy.projects}>
          <button type="button" className="tl-chip" aria-pressed={!params.get('project')} onClick={() => set({project: null})}>{copy.allProjects}</button>
          {catalog.projects.map(project => <button type="button" key={project.id} className="tl-chip" aria-pressed={params.get('project') === project.id} onClick={() => set({project: project.id})}>{project.name}</button>)}
        </div>
        <div className="tl-actions">
          <select className="tl-select" aria-label={copy.colAgent} value={params.get('agent') ?? ''} onChange={event => set({agent: event.target.value || null})}>
            <option value="">{copy.agentAll}</option>
            {catalog.agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
          <select className="tl-select" aria-label={copy.colResult} value={params.get('status') ?? ''} onChange={event => set({status: event.target.value || null})}>
            <option value="">{copy.statusAll}</option>
            <option value="confirmed">{copy.confirmed}</option>
            <option value="refuted">{copy.refuted}</option>
            <option value="unclear">{copy.unclear}</option>
          </select>
          <select className="tl-select" aria-label={copy.colTime} value={params.get('range') ?? '7d'} onChange={event => set({range: event.target.value})}>
            <option value="1d">{copy.range1}</option>
            <option value="7d">{copy.range7}</option>
            <option value="30d">{copy.range30}</option>
            <option value="all">{copy.rangeAll}</option>
          </select>
        </div>
      </div>
      {slice.length === 0 ? (
        <section className="tl-banner"><h2>{copy.filteredTitle}</h2><p>{copy.filteredBody}</p><button type="button" className="tl-btn" onClick={() => navigate(hrefOf('/runs', catalog.demo ? 'demo=1' : ''))}>{copy.reset}</button></section>
      ) : (
        <div className="tl-table-wrap" tabIndex={0} role="region" aria-label={copy.regionTable}>
          <table className="tl-table">
            <thead>
              <tr>
                <th>{copy.colRun}</th><th>{copy.colTask}</th><th>{copy.colAgent}</th><th>{copy.colClaims}</th><th>{copy.colResult}</th>
                <th><button type="button" onClick={() => set({sort: params.get('sort') === 'oldest' ? null : 'oldest'})}>{copy.colTime}</button></th>
              </tr>
            </thead>
            <tbody>
              {slice.map(run => {
                const summary = shownSummary(run)
                const signed = run.integrity === 'hmac'
                const total = run.counts.confirmed + run.counts.refuted + run.counts.unclear
                return (
                  <tr key={run.run_id}>
                    <td className="tl-mono"><a href={`/runs/${run.run_id}?${params.toString()}`} onClick={event => go(event, navigate)}>{run.run_id}</a></td>
                    <td><span className="tl-task">{run.task}<small>{projectName(catalog, run.project_id)}</small></span></td>
                    <td><AgentMark catalog={catalog} id={run.agent_id} /></td>
                    <td>{summary === 'damaged' ? copy.unknown : <span className="tl-pills"><span className="tl-sr">{signed ? `${run.counts.confirmed} ${copy.confirmed}, ${run.counts.refuted} ${copy.refuted}, ${run.counts.unclear} ${copy.unclear}` : `${total} ${copy.unclear}`}</span><span className="tl-bars" aria-hidden="true">{total > 0 && <><i className={signed ? 'confirmed' : 'unclear'} style={{width: `${(run.counts.confirmed / total) * 100}%`}} /><i className={signed ? 'refuted' : 'unclear'} style={{width: `${(run.counts.refuted / total) * 100}%`}} /><i className="unclear" style={{width: `${(run.counts.unclear / total) * 100}%`}} /></>}</span><span className="tl-countline" aria-hidden="true"><span className={signed ? 'ok' : 'warn'}>{run.counts.confirmed} ✓</span><span className={signed ? 'bad' : 'warn'}>{run.counts.refuted} ✗</span><span className="warn">{run.counts.unclear} ?</span></span></span>}</td>
                    <td><Pill summary={summary} claims={run.claims} integrity={run.integrity} /></td>
                    <td><time dateTime={run.started_at ?? undefined} title={run.started_at ? fullStamp(run.started_at) : copy.unknown}>{run.started_at ? relative(run.started_at, catalog.now) : copy.unknown}</time></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="tl-pager">
            <span>{copy.page} {page}</span>
            {page > 1 && <a className="tl-btn" href={withParams('/runs', params, {page: String(page - 1)})} onClick={event => go(event, navigate)}>{copy.previous}</a>}
            {page * 50 < filtered.length && <a className="tl-btn" href={withParams('/runs', params, {page: String(page + 1)})} onClick={event => go(event, navigate)}>{copy.next}</a>}
          </div>
        </div>
      )}
      {params.get('check') === '1' && <CheckDialog catalog={catalog} navigate={navigate} onClose={() => set({check: null})} onLoadFile={onLoadFile} loadNote={loadNote} />}
    </>
  )
}

function CheckDialog({catalog, navigate, onClose, onLoadFile, loadNote}: {catalog: Catalog; navigate: Navigate; onClose: () => void; onLoadFile: (file: File) => void; loadNote: string | null}) {
  const title = useId()
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => { root.current?.querySelector('button')?.focus() }, [])
  return (
    <div className="tl-search">
      <div ref={root} role="dialog" aria-modal="true" aria-labelledby={title} className="tl-dialog" onKeyDown={event => { if (event.key === 'Escape') onClose() }}>
        <h2 id={title}>{copy.dialogTitle}</h2>
        <p>{copy.dialogBody}</p>
        <label htmlFor="tl-saved">{copy.pickSaved}</label>
        <select id="tl-saved" className="tl-select" defaultValue="" onChange={event => { if (event.target.value) navigate(`/runs/${event.target.value}${catalog.demo ? '?demo=1' : ''}`) }}>
          <option value="">{copy.pickSaved}</option>
          {catalog.runs.slice(0, 20).map(run => <option key={run.run_id} value={run.run_id}>{run.task}</option>)}
        </select>
        <p>{copy.importNote}</p>
        <label className="tl-btn" htmlFor="tl-import">{copy.importBundle}</label>
        <input id="tl-import" className="tl-file" type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) onLoadFile(file) }} />
        {loadNote && <p role="status">{loadNote}</p>}
        <div className="tl-actions"><button type="button" className="tl-btn" onClick={onClose}>{copy.close}</button></div>
      </div>
    </div>
  )
}

function DetailPage({catalog, run, navigate}: {catalog: Catalog; run: RunView; navigate: Navigate}) {
  const summary = shownSummary(run)
  const signed = run.integrity === 'hmac'
  const [ask, setAsk] = useState(false)
  const timeline = run.display?.timeline?.map((item, index) => ({
    id: `${run.run_id}-${index}`, timestamp: item[0], observation: item[1], title: item[2], detail: item[3],
  })) ?? run.timeline
  const integrity = run.integrity === 'hmac' ? copy.integrityHmac : run.integrity === 'hash-only' ? copy.integrityHash : copy.integrityUnknown
  const download = () => {
    const blob = new Blob([JSON.stringify(exportBody(run, Boolean(catalog.demo)), null, 2)], {type: 'application/json'})
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${run.run_id}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <div className="tl-head-row">
        <div>
          <p className="tl-sub"><a href={catalog.demo ? '/runs?demo=1' : '/runs'} onClick={event => go(event, navigate)}>{copy.backRuns}</a></p>
          <h1>{run.task} <Pill summary={summary} claims={run.claims} integrity={run.integrity} /></h1>
          <Fill>
            <button type="button" className="tl-btn" onClick={download}>{copy.exportJson}</button>
            <button type="button" className="tl-btn primary" onClick={() => setAsk(true)}>{copy.recheck}</button>
          </Fill>
          <p className="tl-meta">
            <AgentMark catalog={catalog} id={run.agent_id} />
            <span>{copy.project} {projectName(catalog, run.project_id)}</span>
            {run.started_at && <time dateTime={run.started_at} title={fullStamp(run.started_at)}>{when(run.started_at, catalog.now)}</time>}
            <span>{copy.duration} {duration(run.duration_ms)}</span>
            <span className="tl-mono">{run.run_id}</span>
          </p>
          <p className="tl-sub">{integrity}. {copy.integrityLine}</p>
          {catalog.source_label && <p className="tl-sub">{copy.source}: {catalog.source_label}</p>}
        </div>
      </div>
      {summary === 'damaged' ? <section className="tl-banner bad" role="alert"><h2>{copy.damagedTitle}</h2><p>{copy.damagedBody}</p></section> : (
        <>
          <section className="tl-stats">
            <article className="tl-card"><div className="tl-label">{copy.claims}</div><strong>{grouped(run.claims.length)}</strong></article>
            {signed ? (
              <>
                <article className="tl-card"><div className="tl-label">{copy.confirmed}</div><strong className="ok">{grouped(run.counts.confirmed)}</strong></article>
                <article className="tl-card"><div className="tl-label">{copy.refuted}</div><strong className="bad">{grouped(run.counts.refuted)}</strong></article>
                <article className="tl-card"><div className="tl-label">{copy.unclear}</div><strong className="warn">{grouped(run.counts.unclear)}</strong></article>
              </>
            ) : (
              <article className="tl-card"><div className="tl-label">{copy.unclear}</div><strong className="warn">{grouped(run.claims.length)}</strong></article>
            )}
          </section>
          <div className="tl-detail">
            <div className="tl-table-wrap" tabIndex={0} role="region" aria-label={copy.colStatement}>
              <table className="tl-table">
                <thead><tr><th>{copy.colVerdict}</th><th>{copy.colStatement}</th><th>{copy.colEvidence}</th><th>{copy.colOrigin}</th></tr></thead>
                <tbody>
                  {run.claims.map((item, index) => (
                    <tr key={item.id}>
                      <td><Pill summary={item.verdict} claims={[item]} integrity={run.integrity} /></td>
                      <td>{item.text}</td>
                      <td className="tl-evidence">{run.display?.evidence?.[index] ?? (item.evidence_refs[0] ?? copy.unknown)}</td>
                      <td>{run.display?.sources?.[index] ?? item.source_kind}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="tl-card tl-time tl-dev">
              <summary>{copy.developer}</summary>
              <p>{copy.developerBody}</p>
              {timeline.length === 0 ? <p>{copy.developerEmpty}</p> : (
                <ul>
                  {timeline.map(item => (
                    <li key={item.id}>
                      <span className={`tl-dot ${item.observation}`} aria-hidden="true" />
                      <span>
                        <time dateTime={item.timestamp} title={fullStamp(item.timestamp)}>{clock(item.timestamp)}</time>
                        <b>{item.title}</b>
                        <small>{item.observation === 'captured' ? copy.captured : item.observation === 'imported' ? copy.imported : copy.reported}. {item.detail}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </div>
        </>
      )}
      {ask && (
        <div className="tl-search">
          <div role="dialog" aria-modal="true" aria-labelledby="tl-recheck" className="tl-dialog" onKeyDown={event => { if (event.key === 'Escape') setAsk(false) }}>
            <h2 id="tl-recheck">{copy.recheckTitle}</h2>
            <p>{copy.recheckBody}</p>
            <p role="status">{copy.recheckCli} {run.run_id}</p>
            <div className="tl-actions">
              <button type="button" className="tl-btn" onClick={() => setAsk(false)}>{copy.close}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function QuietEmpty({title, body, navigate, suffix}: {title: string; body: string; navigate: Navigate; suffix: string}) {
  return (
    <div className="tl-empty">
      <h2>{title}</h2>
      <p>{body}</p>
      <a className="tl-btn" href={`/runs${suffix}`} onClick={event => go(event, navigate)}>{copy.backStart}</a>
    </div>
  )
}

function Secondary({kind, catalog, navigate}: {kind: string; catalog: Catalog | null; navigate: Navigate}) {
  const suffix = catalog?.demo ? '?demo=1' : ''
  if (kind === 'checks' || kind === 'reports') {
    const rows = (catalog?.runs ?? []).flatMap(run => shownSummary(run) === 'damaged' ? [] : run.claims.map(claim => ({run, claim})))
    return (
      <section>
        <h1>{copy.checksTitle}</h1>
        <p>{copy.checksBody}</p>
        {rows.length === 0 ? <QuietEmpty title={copy.checksEmpty} body={copy.checksEmptyHelp} navigate={navigate} suffix={suffix} /> : (
          <div className="tl-table-wrap" tabIndex={0}>
            <table className="tl-table">
              <thead><tr><th>{copy.colTask}</th><th>{copy.requirement}</th><th>{copy.colResult}</th><th>{copy.reason}</th></tr></thead>
              <tbody>
                {rows.map(({run, claim}) => (
                  <tr key={`${run.run_id}-${claim.id}`}>
                    <td><a href={`/runs/${run.run_id}${suffix}`} onClick={event => go(event, navigate)}>{run.task}</a></td>
                    <td>{claim.text}</td>
                    <td><Pill summary={claim.verdict} claims={[claim]} integrity={run.integrity} /></td>
                    <td>{reasonLabel(claim.reason_code)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )
  }
  if (kind === 'agents') {
    return (
      <section>
        <h1>{copy.agents}</h1>
        <p>{copy.agentsRetired}</p>
        <p><a href={`/runs${suffix}`} onClick={event => go(event, navigate)}>{copy.runs}</a></p>
      </section>
    )
  }
  if (kind === 'records' || kind === 'sources') {
    const rows = (catalog?.runs ?? []).filter(run => shownSummary(run) !== 'damaged')
    return (
      <section>
        <h1>{copy.recordsTitle}</h1>
        <p>{copy.recordsBody}</p>
        {catalog?.demo ? <p>{copy.demo}: {catalog.source_label ?? copy.unknown}</p> : null}
        {rows.length === 0 ? <QuietEmpty title={copy.recordsEmpty} body={copy.recordsEmptyHelp} navigate={navigate} suffix={suffix} /> : rows.map(run => {
          const refs = [...new Set(run.claims.flatMap(claim => claim.evidence_refs))]
          const integrity = run.integrity === 'hmac' ? copy.integrityHmac : run.integrity === 'hash-only' ? copy.integrityHash : copy.integrityUnknown
          return (
            <article className="tl-card" key={run.run_id}>
              <h2><a href={`/runs/${run.run_id}${suffix}`} onClick={event => go(event, navigate)}>{run.task}</a> <Pill summary={shownSummary(run)} claims={run.claims} integrity={run.integrity} /></h2>
              <p className="tl-mono">{run.run_id}</p>
              <p>{integrity}. {copy.integrityLine}</p>
              <p>{refs.length ? refs.join(', ') : copy.noRecord}</p>
            </article>
          )
        })}
      </section>
    )
  }
  if (kind === 'settings') {
    return <section><h1>{copy.settingsTitle}</h1><p>{copy.settingsBody}</p><p className="tl-banner">{copy.settingsPlan}</p><p className="tl-mono">{copy.applyHint}</p></section>
  }
  const demo = catalog?.demo === true
  const loaded = Boolean(catalog && catalog.runs.length > 0)
  const rows = [
    ['warn', demo ? copy.docWorkspaceOk : copy.docWorkspace],
    ['warn', copy.docAdapter],
    ['idle', loaded ? copy.docHeart : copy.docHeart],
    ['warn', copy.docOutput],
    ['warn', copy.docAgent],
    ['idle', copy.docIsolation],
  ] as const
  const warnings = rows.filter(([state]) => state === 'warn').length
  const idle = rows.length - warnings
  return (
    <section>
      <h1>{copy.doctorTitle}</h1>
      <p>{copy.doctorBody}</p>
      <p>{`0 ok · ${warnings} ${copy.doctorWarn} · 0 ${copy.doctorBad}`}</p>
      <p className="tl-sub">{idle} {copy.doctorIdle}</p>
      <ul>
        {rows.map(([state, label]) => <li key={label}><span className={`tl-pill ${state === 'warn' ? 'unclear' : 'unknown'}`}>{state === 'warn' ? copy.doctorWarn : copy.doctorIdle}</span> {label}</li>)}
      </ul>
    </section>
  )
}

export function ReferenceApp({catalog: given, location: forced}: {catalog?: Catalog; location?: string}) {
  const [href, setHref] = useState(forced ?? (typeof window === 'undefined' ? '/runs' : window.location.pathname + window.location.search))
  const [remote, setRemote] = useState<Catalog | null>(null)
  const [loaded, setLoaded] = useState<Catalog | null>(null)
  const [loadNote, setLoadNote] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const url = new URL(href, 'http://truthlens.local')
  const demo = url.searchParams.get('demo') === '1'
  const stateParam = url.searchParams.get('state')
  const catalog = loaded ?? given ?? remote
  useEffect(() => {
    if (forced) return
    const onPop = () => setHref(window.location.pathname + window.location.search)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [forced])
  useEffect(() => {
    if (given || loaded || !demo || stateParam === 'empty') return
    const controller = new AbortController()
    fetch('/reference-demo.json', {signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error('load')
      setRemote(await response.json() as Catalog)
    }).catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [given, loaded, demo, stateParam])
  const navigate = (next: string) => {
    if (!forced) history.pushState({scrollY: window.scrollY}, '', next)
    setHref(next)
    if (typeof window.scrollTo === 'function') window.scrollTo(0, 0)
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setHref(current => {
          const parsed = new URL(current, 'http://truthlens.local')
          const params = new URLSearchParams(parsed.search)
          params.set('find', '1')
          const next = hrefOf(parsed.pathname, params.toString())
          if (!forced) history.pushState({scrollY: window.scrollY}, '', next)
          return next
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [forced])
  const readFile = (file: File) => {
    void file.text().then(text => {
      let payload: unknown
      try {
        payload = JSON.parse(text) as unknown
      } catch {
        setLoadNote(copy.loadRejected)
        return
      }
      const next = catalogFromOperatorFile(payload, new Date().toISOString())
      if (!next) {
        setLoadNote(copy.loadRejected)
        return
      }
      setLoaded(next)
      setLoadNote(null)
      const path = next.runs.length === 1 ? `/runs/${encodeURIComponent(next.runs[0].run_id)}` : '/runs'
      navigate(hrefOf(path, next.demo ? 'demo=1' : ''))
    }).catch(() => setLoadNote(copy.loadRejected))
  }
  const mode = failed ? 'error' : url.searchParams.get('state')
  const active = url.pathname.startsWith('/runs/') ? catalog?.runs.find(run => run.run_id === decodeURIComponent(url.pathname.slice('/runs/'.length))) : undefined
  const missing = Boolean(catalog && url.pathname.startsWith('/runs/') && !active)
  const crumb = url.pathname.startsWith('/runs/') ? (active?.run_id ?? copy.missingRun) : url.pathname === '/checks' || url.pathname === '/reports' ? copy.checks : url.pathname === '/records' || url.pathname === '/sources' ? copy.records : url.pathname === '/agents' ? copy.agents : url.pathname === '/settings' ? copy.settings : url.pathname === '/doctor' ? copy.doctor : copy.runs
  const showSearch = url.searchParams.get('find') === '1' && catalog
  return (
    <Shell catalog={catalog} pathname={url.pathname} search={url.searchParams.toString()} navigate={navigate} crumb={crumb}>
      {!catalog && demo && mode !== 'error' && mode !== 'empty' ? <div aria-busy="true"><p>{copy.loading}</p><div className="tl-skeleton" /></div> : null}
      {url.pathname === '/runs' && (catalog || mode === 'empty' || mode === 'error' || !demo) && (
        <RunsPage catalog={catalog ?? emptyCatalog(demo)} params={url.searchParams} navigate={navigate} mode={catalog ? mode : (demo ? mode : 'empty')} onLoadFile={readFile} loadNote={loadNote} />
      )}
      {active && catalog && <DetailPage catalog={catalog} run={active} navigate={navigate} />}
      {missing && <section role="alert"><h1>{copy.missingRun}</h1></section>}
      {!url.pathname.startsWith('/runs') && <Secondary kind={url.pathname.slice(1)} catalog={catalog} navigate={navigate} />}
      {showSearch && catalog && <SearchDialog catalog={catalog} navigate={navigate} onClose={() => {
        const params = new URLSearchParams(url.search)
        params.delete('find')
        navigate(hrefOf(url.pathname, params.toString()))
      }} />}
    </Shell>
  )
}

function emptyCatalog(demo: boolean): Catalog {
  return {demo, now: '2026-10-26T15:53:00.000Z', projects: [], agents: [], runs: [], source_label: null, previous_window_runs: null}
}
