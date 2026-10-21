import type { Claim, Criterion, RunDoc, RunEvent } from '../types.ts'

export interface StoryStep {
  event: RunEvent
  kind: 'task' | 'started' | 'finished' | 'files' | 'artifact' | 'check' | 'evidence' | 'command' | 'claim'
  title: string
  text: string
  finding?: Claim['finding']
  criteria: readonly Criterion[]
}

function exitText(payload: Record<string, unknown>): string {
  return Number.isInteger(payload.exit_code) ? `Exit code ${payload.exit_code}.` : ''
}

function describeEvent(event: RunEvent, claim?: Claim): Pick<StoryStep, 'kind' | 'title' | 'text'> | undefined {
  const p = event.payload
  switch (event.type) {
    case 'requirement.recorded':
      return { kind: 'task', title: 'Task received', text: typeof p.text === 'string' ? p.text : event.summary }
    case 'run.started':
      return { kind: 'started', title: 'Agent started', text: 'The agent started this run.' }
    case 'run.finished':
      return { kind: 'finished', title: 'Agent finished', text: Number.isInteger(p.exit_code)
        ? `The run finished with exit code ${p.exit_code}.` : 'The run finished.' }
    case 'artifact.recorded':
      return { kind: 'artifact', title: 'Artifact recorded', text: 'An artifact was recorded for this run.' }
    case 'agent.claim':
      return { kind: 'claim', title: 'Agent claimed', text: claim?.text ?? (typeof p.text === 'string' ? p.text : event.summary) }
    case 'test.reported': {
      const counts = ['passed', 'failed', 'skipped'].flatMap(key => Number.isInteger(p[key]) && (p[key] as number) >= 0 ? [`${p[key]} ${key}`] : [])
      const results = counts.length ? `${counts.join(', ')}.` : event.summary
      return { kind: 'check', title: 'Checks reported', text: [results, exitText(p)].filter(Boolean).join(' ') }
    }
    case 'evidence.attached':
      if (p.kind === 'file_changed' && p.refers_to === 'git_diff_after') {
        const changed = Array.isArray(p.changed) && p.changed.some(path => typeof path === 'string' && path.length > 0)
        return { kind: 'files', title: changed ? 'Files changed' : 'File change record',
          text: changed ? 'File changes were recorded.' : 'No changed files are listed in this record.' }
      }
      if (p.kind === 'command_run') return { kind: 'command', title: 'Command recorded', text: exitText(p) || 'A command record was captured.' }
      return {
        kind: p.kind === 'test_run' ? 'check' : 'evidence',
        title: p.kind === 'test_run' ? 'Checks reported' : 'Evidence recorded',
        text: typeof p.result === 'string' ? `Recorded result: ${p.result}.` : 'Evidence was attached to this run.',
      }
  }
}

/** Select and phrase recorded facts only: no run metadata, status/finding inference or synthetic events. */
export function buildStory(doc: Pick<RunDoc, 'events' | 'criteria' | 'claims'>): StoryStep[] {
  const claims = new Map(doc.claims.map(claim => [claim.claim_id, claim]))
  return [...doc.events].sort((a, b) => a.seq - b.seq).flatMap(event => {
    const claim = event.type === 'agent.claim' && typeof event.payload.claim_id === 'string' ? claims.get(event.payload.claim_id) : undefined
    const description = describeEvent(event, claim)
    if (!description) return []
    const ids = claim?.criterion_ids ?? (Array.isArray(event.payload.criterion_ids) ? event.payload.criterion_ids : [])
    return [{ ...description, event, finding: claim?.finding, criteria: doc.criteria.filter(criterion => ids.includes(criterion.criterion_id)) }]
  })
}
