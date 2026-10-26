import {useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode} from 'react'
import './theme.css'
import {clock, copy, delta, duration, fullStamp, grouped, percent, relative, tenths, when} from './copy.ts'
import {eligible, exportBody, filterRuns, metrics, shownSummary, type Catalog, type RunView, type Summary} from './model.ts'

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

function Pill({summary}: {summary: Summary}) {
  const label = summary === 'confirmed' ? copy.confirmed : summary === 'refuted' ? copy.refuted : summary === 'unclear' ? copy.unclear : copy.damaged
  return <span className={`tl-pill ${summary}`}>{label}</span>
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
    reports: catalog.runs.filter(run => run.audit_state === 'complete' && shownSummary(run) !== 'damaged').length,
    agents: new Set(catalog.runs.map(run => run.agent_id).filter(Boolean)).size,
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
            {item('/reports', copy.reports, counts?.reports)}
            {item('/agents', copy.agents, counts?.agents)}
            {item('/sources', copy.sources)}
          </nav>
          <div>
            <div className="tl-kicker">{copy.projects}</div>
            <div className="tl-projects">
              {catalog?.projects.map(project => (
                <a key={project.id} href={withParams('/runs', params, {project: project.id})} onClick={event => go(event, navigate)}>
                  <span className={`tl-dot ${project.id}`} aria-hidden="true" />{project.name}
                </a>
              ))}
            </div>
          </div>
          <div className="tl-side-foot">
            {item('/settings', copy.settings)}
            {item('/doctor', copy.doctor)}
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
              <button type="button" className="tl-btn" onClick={() => navigate(hrefOf(pathname, new URLSearchParams({...Object.fromEntries(params), find: '1'}).toString()))}>{copy.search}</button>
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
  const root = useRef<HTMLFormElement>(null)
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
      <form ref={root} role="dialog" aria-modal="true" aria-labelledby={title} onKeyDown={event => {
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
          {matches.map(run => <li key={run.run_id}><a href={`/runs/${run.run_id}${catalog.demo ? '?demo=1' : ''}`} onClick={event => { go(event, navigate); onClose() }}>{run.task}</a></li>)}
          {text && matches.length === 0 && <li>{copy.nothingFound}</li>}
        </ul>
        <button type="button" className="tl-btn" onClick={onClose}>{copy.close}</button>
      </form>
    </div>
  )
}

function RunsPage({catalog, params, navigate, mode}: {catalog: Catalog; params: URLSearchParams; navigate: Navigate; mode: string | null}) {
  const filtered = useMemo(() => filterRuns(catalog.runs, catalog.now, params), [catalog, params])
  const numbers = metrics(filtered, catalog.demo)
  const range = params.get('range') ?? '7d'
  const windowLabel = range === '1d' ? copy.range1 : range === '30d' ? copy.range30 : range === 'all' ? copy.rangeAll : copy.runsWindow
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const slice = filtered.slice((page - 1) * 50, page * 50)
  const notable = numbers.notable ? catalog.agents.find(item => item.id === numbers.notable?.[0]) : null
  const set = (updates: Record<string, string | null>) => navigate(withParams('/runs', params, updates))
  if (mode === 'loading') return <div aria-busy="true"><p>{copy.loading}</p><div className="tl-skeleton" /><div className="tl-skeleton" /></div>
  if (mode === 'error') return <section className="tl-banner bad" role="alert"><h1>{copy.errorTitle}</h1><p>{copy.errorBody}</p><button type="button" className="tl-btn" onClick={() => set({state: null})}>{copy.retry}</button></section>
  if (mode === 'empty' || catalog.runs.length === 0) return <section><h1>{copy.emptyTitle}</h1><p>{copy.emptyBody}</p><div className="tl-actions"><a className="tl-btn primary" href="/settings">{copy.connect}</a><a className="tl-btn" href="/runs?demo=1">{copy.sample}</a></div></section>
  return (
    <>
      {mode === 'offline' && <p className="tl-banner warn" role="status">{copy.offline}</p>}
      <header className="tl-head-row">
        <div>
          <h1>{copy.runs}</h1>
          <p className="tl-sub">{copy.intro} · {copy.source}: {catalog.source_label ?? copy.unknown}</p>
        </div>
        <button type="button" className="tl-btn primary" onClick={() => set({check: '1'})}>{copy.check}</button>
      </header>
      <section className="tl-kpis" aria-label={copy.runs}>
        <article className="tl-card"><div className="tl-label">{windowLabel}</div><strong className={numbers.runs > 0 ? 'ok' : undefined}>{grouped(numbers.runs)}</strong><p className={range === '7d' && numbers.runs > (catalog.previous_window_runs ?? 0) ? 'tl-delta ok' : 'tl-delta'}>{range === '7d' && catalog.demo ? delta(numbers.runs, catalog.previous_window_runs) : copy.noComparison}</p></article>
        <article className="tl-card"><div className="tl-label">{copy.claimsChecked}</div><strong>{numbers.total ? grouped(numbers.total) : copy.unknown}</strong><p>{copy.average} {tenths(numbers.total, numbers.runs)} {copy.perRun}</p></article>
        <article className="tl-card"><div className="tl-label">{copy.confirmedRate}</div><strong className={numbers.counts.confirmed > 0 ? 'ok' : undefined}>{percent(numbers.counts.confirmed, numbers.total)}</strong><p>{copy.rateHint}. {copy.sameWindow}</p></article>
        <article className="tl-card"><div className="tl-label">{copy.notable}</div><strong>{notable ? notable.name : copy.unknown}</strong><p>{numbers.notable ? `${grouped(numbers.notable[1])} ${copy.refutedClaims}` : copy.noNotable}</p></article>
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
                const total = run.counts.confirmed + run.counts.refuted + run.counts.unclear
                return (
                  <tr key={run.run_id}>
                    <td className="tl-mono"><a href={`/runs/${run.run_id}?${params.toString()}`} onClick={event => go(event, navigate)}>{run.run_id}</a></td>
                    <td><span className="tl-task">{run.task}<small>{projectName(catalog, run.project_id)}</small></span></td>
                    <td><AgentMark catalog={catalog} id={run.agent_id} /></td>
                    <td>{summary === 'damaged' ? copy.unknown : <span className="tl-pills"><span className="tl-bars" aria-hidden="true">{total > 0 && <><i className="confirmed" style={{width: `${(run.counts.confirmed / total) * 100}%`}} /><i className="refuted" style={{width: `${(run.counts.refuted / total) * 100}%`}} /><i className="unclear" style={{width: `${(run.counts.unclear / total) * 100}%`}} /></>}</span>{`${run.counts.confirmed} / ${run.counts.refuted} / ${run.counts.unclear}`}</span>}</td>
                    <td><Pill summary={summary} /></td>
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
      {params.get('check') === '1' && <CheckDialog catalog={catalog} navigate={navigate} onClose={() => set({check: null})} />}
    </>
  )
}

function CheckDialog({catalog, navigate, onClose}: {catalog: Catalog; navigate: Navigate; onClose: () => void}) {
  const title = useId()
  const [note, setNote] = useState<string | null>(null)
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
        <input id="tl-import" type="file" accept="application/json,.json" onChange={async event => {
          const file = event.target.files?.[0]
          if (!file) return
          try {
            const payload = JSON.parse(await file.text()) as {item?: RunView; claims?: RunView['claims']; review_summary?: string}
            const view = payload.item ?? payload as RunView
            const summary = view.claims ? shownSummary(view) : 'damaged'
            setNote(summary === 'damaged' || summary === 'confirmed' && payload.item == null ? copy.importRejected : copy.importOk)
          } catch {
            setNote(copy.importRejected)
          }
        }} />
        {note && <p role="status">{note}</p>}
        <div className="tl-actions"><button type="button" className="tl-btn" onClick={onClose}>{copy.close}</button></div>
      </div>
    </div>
  )
}

function DetailPage({catalog, run, navigate}: {catalog: Catalog; run: RunView; navigate: Navigate}) {
  const summary = shownSummary(run)
  const [ask, setAsk] = useState(false)
  const [recheck, setRecheck] = useState<'idle' | 'pending' | 'fail'>('idle')
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
          <h1>{run.task} <Pill summary={summary} /></h1>
          <p className="tl-meta">
            <AgentMark catalog={catalog} id={run.agent_id} />
            <span>{copy.project} {projectName(catalog, run.project_id)}</span>
            {run.started_at && <time dateTime={run.started_at} title={fullStamp(run.started_at)}>{when(run.started_at, catalog.now)}</time>}
            <span>{copy.duration} {duration(run.duration_ms)}</span>
            <span className="tl-mono">{run.run_id}</span>
          </p>
          <p className="tl-sub">{integrity}. {copy.integrityLine}</p>
        </div>
        <div className="tl-actions">
          <button type="button" className="tl-btn" onClick={download}>{copy.exportJson}</button>
          <button type="button" className="tl-btn primary" onClick={() => setAsk(true)}>{copy.recheck}</button>
        </div>
      </div>
      {summary === 'damaged' ? <section className="tl-banner bad" role="alert"><h2>{copy.damagedTitle}</h2><p>{copy.damagedBody}</p></section> : (
        <>
          <section className="tl-stats">
            <article className="tl-card"><div className="tl-label">{copy.claims}</div><strong>{grouped(run.claims.length)}</strong></article>
            <article className="tl-card"><div className="tl-label">{copy.confirmed}</div><strong className="ok">{grouped(run.counts.confirmed)}</strong></article>
            <article className="tl-card"><div className="tl-label">{copy.refuted}</div><strong className="bad">{grouped(run.counts.refuted)}</strong></article>
            <article className="tl-card"><div className="tl-label">{copy.unclear}</div><strong className="warn">{grouped(run.counts.unclear)}</strong></article>
          </section>
          <div className="tl-detail">
            <div className="tl-table-wrap" tabIndex={0} role="region" aria-label={copy.colStatement}>
              <table className="tl-table">
                <thead><tr><th>{copy.colVerdict}</th><th>{copy.colStatement}</th><th>{copy.colEvidence}</th><th>{copy.colOrigin}</th></tr></thead>
                <tbody>
                  {run.claims.map((item, index) => (
                    <tr key={item.id}>
                      <td><Pill summary={item.verdict} /></td>
                      <td>{item.text}</td>
                      <td>{run.display?.evidence?.[index] ?? (item.evidence_refs[0] ?? copy.unknown)}</td>
                      <td>{run.display?.sources?.[index] ?? item.source_kind}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <aside className="tl-card tl-time" aria-label={copy.timeline}>
              <h2>{copy.timeline}</h2>
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
            </aside>
          </div>
        </>
      )}
      {ask && (
        <div className="tl-search">
          <div role="dialog" aria-modal="true" aria-labelledby="tl-recheck" className="tl-dialog" onKeyDown={event => { if (event.key === 'Escape') setAsk(false) }}>
            <h2 id="tl-recheck">{copy.recheckTitle}</h2>
            <p>{copy.recheckBody}</p>
            {recheck === 'pending' && <p role="status">{copy.recheckPending}</p>}
            {recheck === 'fail' && <p role="alert">{copy.recheckFail}</p>}
            <div className="tl-actions">
              <button type="button" className="tl-btn" onClick={() => setAsk(false)}>{copy.cancel}</button>
              <button type="button" className="tl-btn primary" onClick={() => { setRecheck('pending'); window.setTimeout(() => setRecheck('fail'), 300) }}>{copy.startRecheck}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Secondary({kind, catalog}: {kind: string; catalog: Catalog | null}) {
  if (kind === 'reports') {
    const rows = catalog?.runs.filter(run => run.audit_revision && shownSummary(run) !== 'damaged') ?? []
    const suffix = catalog?.demo ? '?demo=1' : ''
    return <section><h1>{copy.reportsTitle}</h1><p>{copy.reportsBody}</p>{rows.length === 0 ? <p>{copy.reportsEmpty}</p> : <ul>{rows.slice(0, 12).map(run => <li key={run.run_id}><a href={`/runs/${run.run_id}${suffix}`}>{run.task}</a> · {run.audit_revision}</li>)}</ul>}</section>
  }
  if (kind === 'agents') {
    return (
      <section>
        <h1>{copy.agentsTitle}</h1>
        <p>{copy.agentsBody}</p>
        <ul>
          <li>Agent Zero · {copy.notQualified}</li>
          <li>Codex · {copy.notConnected}</li>
          <li>Claude · {copy.notConnected}</li>
          <li>{copy.agy} · {copy.manual}</li>
        </ul>
      </section>
    )
  }
  if (kind === 'sources') {
    return <section><h1>{copy.sourcesTitle}</h1><p>{copy.sourcesBody}</p>{catalog?.demo ? <p>{copy.demo}: {catalog.source_label}</p> : <p>{copy.sourcesEmpty}</p>}</section>
  }
  if (kind === 'settings') {
    return <section><h1>{copy.settingsTitle}</h1><p>{copy.settingsBody}</p><p className="tl-banner">{copy.settingsPlan}</p><p className="tl-mono">{copy.applyHint}</p></section>
  }
  const demo = catalog?.demo === true
  const rows = [
    ['warn', demo ? copy.docWorkspaceOk : copy.docWorkspace],
    ['warn', copy.docAdapter],
    ['idle', copy.docHeart],
    ['warn', copy.docOutput],
    ['warn', copy.docAgent],
    ['idle', copy.docIsolation],
  ] as const
  return (
    <section>
      <h1>{copy.doctorTitle}</h1>
      <p>{copy.doctorBody}</p>
      <ul>
        {rows.map(([state, label]) => <li key={label}><span className={`tl-pill ${state === 'warn' ? 'unclear' : 'unknown'}`}>{state === 'warn' ? copy.doctorWarn : copy.doctorIdle}</span> {label}</li>)}
      </ul>
    </section>
  )
}

export function ReferenceApp({catalog: given, location: forced}: {catalog?: Catalog; location?: string}) {
  const [href, setHref] = useState(forced ?? (typeof window === 'undefined' ? '/runs' : window.location.pathname + window.location.search))
  const [remote, setRemote] = useState<Catalog | null>(null)
  const [failed, setFailed] = useState(false)
  const url = new URL(href, 'http://truthlens.local')
  const demo = url.searchParams.get('demo') === '1'
  const stateParam = url.searchParams.get('state')
  const catalog = given ?? remote
  useEffect(() => {
    if (forced) return
    const onPop = () => setHref(window.location.pathname + window.location.search)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [forced])
  useEffect(() => {
    if (given || !demo || stateParam === 'empty') return
    const controller = new AbortController()
    fetch('/reference-demo.json', {signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error('load')
      setRemote(await response.json() as Catalog)
    }).catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [given, demo, stateParam])
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
  const mode = failed ? 'error' : url.searchParams.get('state')
  const active = url.pathname.startsWith('/runs/') ? catalog?.runs.find(run => run.run_id === decodeURIComponent(url.pathname.slice('/runs/'.length))) : undefined
  const missing = Boolean(catalog && url.pathname.startsWith('/runs/') && !active)
  const crumb = url.pathname.startsWith('/runs/') ? (active?.run_id ?? copy.missingRun) : url.pathname === '/reports' ? copy.reports : url.pathname === '/agents' ? copy.agents : url.pathname === '/sources' ? copy.sources : url.pathname === '/settings' ? copy.settings : url.pathname === '/doctor' ? copy.doctor : copy.runs
  const showSearch = url.searchParams.get('find') === '1' && catalog
  return (
    <Shell catalog={catalog} pathname={url.pathname} search={url.searchParams.toString()} navigate={navigate} crumb={crumb}>
      {!catalog && demo && mode !== 'error' && mode !== 'empty' ? <div aria-busy="true"><p>{copy.loading}</p><div className="tl-skeleton" /></div> : null}
      {url.pathname === '/runs' && (catalog || mode === 'empty' || mode === 'error' || !demo) && (
        <RunsPage catalog={catalog ?? emptyCatalog(demo)} params={url.searchParams} navigate={navigate} mode={catalog ? mode : (demo ? mode : 'empty')} />
      )}
      {active && catalog && <DetailPage catalog={catalog} run={active} navigate={navigate} />}
      {missing && <section role="alert"><h1>{copy.missingRun}</h1></section>}
      {!url.pathname.startsWith('/runs') && <Secondary kind={url.pathname.slice(1)} catalog={catalog} />}
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
