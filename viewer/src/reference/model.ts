import {copy} from './copy.ts'

export type Verdict = 'confirmed' | 'refuted' | 'unclear'

export type Claim = {
  id: string
  text: string
  verdict: Verdict
  evidence_refs: string[]
  source_kind: string
  scope: string
  reason_code: string
}

export type TimelineEvent = {
  id: string
  timestamp: string
  kind: string
  title: string
  detail: string
  observation: 'captured' | 'agent_reported' | 'imported'
}

export type RunView = {
  schema_version: 'run-view-v1'
  run_id: string
  project_id: string
  task: string
  execution: string
  audit_state: string
  integrity: 'hash-only' | 'hmac' | 'failed' | 'unknown'
  review_summary: Verdict
  claims: Claim[]
  timeline: TimelineEvent[]
  counts: {confirmed: number; refuted: number; unclear: number}
  agent_id?: string | null
  started_at?: string | null
  finished_at?: string | null
  duration_ms?: number | null
  git_commit?: string | null
  audit_revision?: string | null
  demo?: boolean
  synthetic?: boolean
  problem?: 'damaged' | null
  display?: {
    evidence?: string[]
    sources?: string[]
    timeline?: [string, TimelineEvent['observation'], string, string][]
  }
}

export type Catalog = {
  demo: boolean
  now: string
  previous_window_runs?: number | null
  source_label?: string | null
  projects: {id: string; name: string}[]
  agents: {id: string; name: string; initial: string}[]
  runs: RunView[]
}

export type Summary = Verdict | 'damaged'

const DOUBTFUL = new Set(['benchmark_missing'])

/** Display tone. Stored verdicts stay confirmed, refuted, unclear.
 * The green and red words require integrity hmac. Anything else stays unclear. */
export function displayTone(
  summary: Summary,
  claims: {reason_code?: string}[] = [],
  integrity?: RunView['integrity'],
): Summary {
  if (summary === 'damaged') return summary
  if (integrity !== 'hmac') return 'unclear'
  if (summary === 'refuted') return summary
  if (claims.some(item => item.reason_code != null && DOUBTFUL.has(item.reason_code))) return 'unclear'
  return summary
}

const DAY = 86_400_000

export function shownSummary(run: RunView): Summary {
  if (run.problem === 'damaged' || run.integrity === 'failed' || !Array.isArray(run.claims) || !run.counts) return 'damaged'
  const counts = {confirmed: 0, refuted: 0, unclear: 0}
  for (const item of run.claims) {
    if (item.verdict !== 'confirmed' && item.verdict !== 'refuted' && item.verdict !== 'unclear') return 'damaged'
    counts[item.verdict] += 1
  }
  if (
    counts.confirmed !== run.counts.confirmed
    || counts.refuted !== run.counts.refuted
    || counts.unclear !== run.counts.unclear
  ) return 'damaged'
  const derived: Verdict = counts.refuted > 0
    ? 'refuted'
    : run.integrity === 'unknown' || run.execution !== 'completed' || run.audit_state !== 'complete' || run.claims.length === 0 || counts.unclear > 0
      ? 'unclear'
      : 'confirmed'
  if (run.review_summary !== derived) return 'damaged'
  if (derived === 'confirmed' && run.integrity !== 'hash-only' && run.integrity !== 'hmac') return 'damaged'
  return derived
}

export function eligible(run: RunView, demoMode: boolean): boolean {
  if (run.synthetic || shownSummary(run) === 'damaged') return false
  return demoMode ? run.demo !== false : run.demo !== true
}

export function rangeStart(now: string, range: string): number | null {
  const base = new Date(now).getTime()
  if (!Number.isFinite(base) || range === 'all') return null
  if (range === '1d') return base - DAY
  if (range === '30d') return base - 30 * DAY
  return base - 7 * DAY
}

export function filterRuns(runs: RunView[], now: string, query: URLSearchParams): RunView[] {
  const project = query.get('project')
  const agent = query.get('agent')
  const status = query.get('status')
  const text = (query.get('q') ?? '').trim().toLowerCase()
  const start = rangeStart(now, query.get('range') ?? '7d')
  return runs.filter(run => {
    if (project && run.project_id !== project) return false
    if (agent && run.agent_id !== agent) return false
    const summary = shownSummary(run)
    if (status && displayTone(summary, run.claims, run.integrity) !== status) return false
    if (text && !`${run.task} ${run.run_id}`.toLowerCase().includes(text)) return false
    if (start != null) {
      const at = new Date(run.started_at ?? '').getTime()
      if (!Number.isFinite(at) || at < start) return false
    }
    return true
  }).sort((a, b) => {
    const dir = query.get('sort') === 'oldest' ? 1 : -1
    return ((a.started_at ?? '').localeCompare(b.started_at ?? '')) * dir
  })
}

export function metrics(runs: RunView[], demoMode: boolean) {
  const rows = runs.filter(run => eligible(run, demoMode))
  const counts = {confirmed: 0, refuted: 0, unclear: 0}
  const byAgent = new Map<string, number>()
  for (const run of rows) {
    for (const claim of run.claims) {
      const tone = displayTone(claim.verdict, [claim], run.integrity)
      if (tone !== 'confirmed' && tone !== 'refuted' && tone !== 'unclear') continue
      counts[tone] += 1
      if (tone === 'refuted' && run.agent_id) byAgent.set(run.agent_id, (byAgent.get(run.agent_id) ?? 0) + 1)
    }
  }
  const total = counts.confirmed + counts.refuted + counts.unclear
  const ranked = [...byAgent.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1])
  const notable = ranked.length > 0 && (ranked.length === 1 || ranked[0][1] > ranked[1][1]) ? ranked[0] : null
  return {runs: rows.length, counts, total, notable}
}

export function exportBody(run: RunView, demo: boolean) {
  if (shownSummary(run) === 'damaged') {
    return {schema_version: 1, error: {code: 'DAMAGED', message: copy.damagedTitle}}
  }
  const item = {
    schema_version: run.schema_version, run_id: run.run_id, project_id: run.project_id, task: run.task,
    execution: run.execution, audit_state: run.audit_state, integrity: run.integrity,
    review_summary: run.review_summary, claims: run.claims, timeline: run.timeline, counts: run.counts,
    agent_id: run.agent_id ?? null, started_at: run.started_at ?? null, finished_at: run.finished_at ?? null,
    duration_ms: run.duration_ms ?? null, git_commit: run.git_commit ?? null, audit_revision: run.audit_revision ?? null,
  }
  return {schema_version: 1, demo, item}
}

function asRun(value: unknown): RunView | null {
  if (!value || typeof value !== 'object') return null
  const run = value as RunView
  if (run.schema_version !== 'run-view-v1' || typeof run.run_id !== 'string') return null
  if (!Array.isArray(run.claims) || !run.counts) return null
  if (shownSummary(run) === 'damaged') return null
  return run
}

/** Operator file from `runs show --json`, a catalog, or a list of run views.
 * Damaged views are dropped. This does not read a ledger or start an audit. */
export function catalogFromOperatorFile(payload: unknown, now: string): Catalog | null {
  let views: unknown[] = []
  let envelopeDemo = false
  let stamp = now
  if (Array.isArray(payload)) views = payload
  else if (payload && typeof payload === 'object') {
    const body = payload as {runs?: unknown; item?: unknown; demo?: unknown; now?: unknown; schema_version?: unknown}
    envelopeDemo = body.demo === true
    if (typeof body.now === 'string' && Number.isFinite(new Date(body.now).getTime())) stamp = body.now
    if (Array.isArray(body.runs)) views = body.runs
    else if (body.item && typeof body.item === 'object') views = [body.item]
    else if (body.schema_version === 'run-view-v1') views = [payload]
    else return null
  } else return null
  const runs = views.flatMap(item => {
    const run = asRun(item)
    return run ? [run] : []
  })
  if (runs.length === 0) return null
  const demo = envelopeDemo || runs.some(run => run.demo === true)
  const projects = [...new Map(runs.map(run => [run.project_id, {id: run.project_id, name: run.project_id}])).values()]
  const agents = [...new Map(runs.flatMap(run => {
    if (!run.agent_id) return []
    return [[run.agent_id, {id: run.agent_id, name: run.agent_id, initial: run.agent_id.slice(0, 1).toUpperCase()}] as const]
  })).values()]
  return {demo, now: stamp, source_label: copy.loadedSource, projects, agents, runs, previous_window_runs: null}
}
