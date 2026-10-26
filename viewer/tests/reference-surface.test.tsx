// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach, expect, it} from 'vitest'
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react'
import App from '../src/App.tsx'
import {ReferenceApp} from '../src/reference/ReferenceApp.tsx'
import {copy} from '../src/reference/copy.ts'
import type {Catalog, RunView} from '../src/reference/model.ts'

afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
})

function claim(id: string, verdict: RunView['claims'][number]['verdict'], text: string): RunView['claims'][number] {
  return {id, text, verdict, evidence_refs: [`ev_${id}`], source_kind: verdict === 'confirmed' ? 'witnessed_test' : 'file_diff', scope: 'scope', reason_code: verdict}
}

function run(patch: Partial<RunView> & Pick<RunView, 'run_id' | 'review_summary' | 'claims' | 'counts'>): RunView {
  return {
    schema_version: 'run-view-v1',
    project_id: 'mcpdeck',
    task: patch.run_id,
    execution: 'completed',
    audit_state: 'complete',
    integrity: 'hash-only',
    timeline: [],
    agent_id: 'agent-zero',
    started_at: '2026-10-26T15:00:00.000Z',
    demo: true,
    synthetic: false,
    ...patch,
  }
}

function catalog(runs: RunView[], projects: Catalog['projects'] = [{id: 'mcpdeck', name: 'MCPDeck'}, {id: 'vpsman', name: 'VPSMan'}]): Catalog {
  return {
    demo: true,
    now: '2026-10-26T15:53:00.000Z',
    previous_window_runs: 1,
    source_label: 'fixture',
    projects,
    agents: [{id: 'agent-zero', name: 'Agent Zero', initial: 'A'}, {id: 'codex', name: 'Codex', initial: 'C'}],
    runs,
  }
}

it('renders a refuted run as refuted and keeps a damaged run off the confirmed path', () => {
  const refuted = run({
    run_id: 'run_bad',
    review_summary: 'refuted',
    claims: [claim('a', 'confirmed', 'passes'), claim('b', 'refuted', 'dependency changed')],
    counts: {confirmed: 1, refuted: 1, unclear: 0},
  })
  const damaged = run({
    run_id: 'run_hurt',
    task: 'damaged task',
    review_summary: 'confirmed',
    claims: [claim('c', 'confirmed', 'must-not-render-confirmed')],
    counts: {confirmed: 9, refuted: 0, unclear: 0},
    problem: 'damaged',
  })
  render(<ReferenceApp location="/runs?demo=1" catalog={catalog([refuted, damaged])} />)
  const bad = screen.getByRole('row', {name: /run_bad/})
  expect(within(bad).getByText(copy.refuted).className).toContain('refuted')
  expect(within(bad).queryByText(copy.confirmed)).toBeNull()
  const hurt = screen.getByRole('row', {name: /run_hurt/})
  expect(within(hurt).getByText(copy.damaged).className).toContain('damaged')
  expect(within(hurt).queryByText(copy.confirmed)).toBeNull()
  expect(hurt.querySelector('.tl-bars')).toBeNull()
  expect(screen.queryByText('must-not-render-confirmed')).toBeNull()
})

it('hides confirmed claims when a damaged run is opened', () => {
  const damaged = run({
    run_id: 'run_hurt',
    review_summary: 'confirmed',
    claims: [claim('c', 'confirmed', 'must-not-render-confirmed')],
    counts: {confirmed: 2, refuted: 0, unclear: 0},
  })
  render(<ReferenceApp location="/runs/run_hurt?demo=1" catalog={catalog([damaged])} />)
  expect(screen.getByRole('alert').textContent).toContain(copy.damagedTitle)
  expect(screen.queryByText('must-not-render-confirmed')).toBeNull()
  expect(screen.getByText(/Hash only/)).toBeTruthy()
  expect(screen.getByText(/Integrität ist keine Freigabe/)).toBeTruthy()
})

it('shows an empty project on /runs and the demo label only for demo data', () => {
  const {unmount} = render(<ReferenceApp location="/runs" />)
  expect(screen.getByRole('link', {name: copy.connect})).toBeTruthy()
  expect(screen.getByRole('link', {name: copy.sample})).toBeTruthy()
  expect(screen.queryByText(copy.demo)).toBeNull()
  expect(screen.queryByText('1.204')).toBeNull()
  unmount()
  const sample = run({
    run_id: 'run_ok',
    review_summary: 'confirmed',
    claims: [claim('a', 'confirmed', 'passes')],
    counts: {confirmed: 1, refuted: 0, unclear: 0},
  })
  render(<ReferenceApp location="/runs?demo=1" catalog={catalog([sample])} />)
  expect(screen.getByText(copy.demo)).toBeTruthy()
})

it('applies a project filter to the same figures as the table', () => {
  const first = run({
    run_id: 'run_one',
    review_summary: 'confirmed',
    claims: [claim('a', 'confirmed', 'one')],
    counts: {confirmed: 1, refuted: 0, unclear: 0},
  })
  const second = run({
    run_id: 'run_two',
    project_id: 'vpsman',
    agent_id: 'codex',
    review_summary: 'unclear',
    claims: [claim('b', 'unclear', 'two')],
    counts: {confirmed: 0, refuted: 0, unclear: 1},
  })
  render(<ReferenceApp location="/runs?demo=1" catalog={catalog([first, second])} />)
  expect(document.querySelector('.tl-kpis strong')?.textContent).toBe('2')
  fireEvent.click(screen.getByRole('button', {name: 'VPSMan'}))
  expect(document.querySelector('.tl-kpis strong')?.textContent).toBe('1')
  expect(screen.queryByRole('row', {name: /run_one/})).toBeNull()
  expect(screen.getByRole('row', {name: /run_two/})).toBeTruthy()
})

it('returns focus to the search control after Escape', () => {
  const sample = run({
    run_id: 'run_ok',
    review_summary: 'confirmed',
    claims: [claim('a', 'confirmed', 'passes')],
    counts: {confirmed: 1, refuted: 0, unclear: 0},
  })
  render(<ReferenceApp location="/runs?demo=1" catalog={catalog([sample])} />)
  const search = screen.getByRole('button', {name: copy.search})
  search.focus()
  fireEvent.keyDown(window, {key: 'k', ctrlKey: true})
  const dialog = screen.getByRole('dialog')
  expect(dialog).toBeTruthy()
  fireEvent.keyDown(dialog, {key: 'Escape'})
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(search)
})

it('keeps the browser doctor off the green confirmed pill', () => {
  const sample = run({
    run_id: 'run_ok',
    review_summary: 'confirmed',
    claims: [claim('a', 'confirmed', 'passes')],
    counts: {confirmed: 1, refuted: 0, unclear: 0},
  })
  render(<ReferenceApp location="/doctor?demo=1" catalog={catalog([sample])} />)
  expect(document.querySelector('.tl-pill.confirmed')).toBeNull()
  expect(screen.getByText(copy.docIsolation)).toBeTruthy()
})

it('serves the reference surface from /runs without replacing the evidence workspace', () => {
  window.history.pushState({}, '', '/runs')
  render(<App />)
  expect(screen.getByRole('link', {name: copy.sample})).toBeTruthy()
  expect(screen.queryByText('Not connected')).toBeNull()
})
