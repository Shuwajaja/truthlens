import { describe, expect, it } from 'vitest'
import { buildStory } from '../../src/renderkit/story.ts'
import { claimOnlyRun } from '../fixtures/claimOnlyRun.ts'
import type { RunDoc } from '../../src/types.ts'
import publicRun from '../../fixtures/demo-run.json'

const doc = publicRun as RunDoc

describe('recorded Agent Story', () => {
  it('selects the demo steps in sequence order with real event references', () => {
    const steps = buildStory(doc)
    expect(steps.map(step => [step.event.seq, step.title])).toEqual([
      [1, 'Agent started'], [2, 'Task received'], [7, 'Evidence recorded'],
      [8, 'Command recorded'], [9, 'Agent claimed'], [10, 'Agent claimed'],
      [11, 'Agent claimed'], [12, 'Files changed'], [13, 'Artifact recorded'],
      [14, 'Checks reported'], [15, 'Checks reported'], [16, 'Agent finished'],
    ])
    for (const step of steps) expect(doc.events).toContain(step.event)
    expect(steps.at(-1)?.text).toContain('exit code 0')
    expect(steps.find(step => step.event.seq === 14)?.text).toBe('1 passed, 0 failed, 0 skipped. Exit code 0.')
  })

  it('is deterministic, sorts by seq rather than timestamps and does not mutate input', () => {
    const changed = structuredClone(doc)
    changed.events.reverse()
    const before = structuredClone(changed)
    expect(buildStory(changed)).toEqual(buildStory(doc))
    expect(buildStory(changed)).toEqual(buildStory(changed))
    expect(changed).toEqual(before)
  })

  it('does not invent steps from run metadata or criteria when events are absent', () => {
    expect(buildStory({ ...doc, events: [] })).toEqual([])
  })

  it('keeps a claim-only run linked to its one claim and its exported finding', () => {
    const only = claimOnlyRun()
    const steps = buildStory(only)
    expect(steps).toHaveLength(1)
    expect(steps[0].event).toBe(only.events[0])
    expect(steps[0].kind).toBe('claim')
    expect(steps[0].finding).toBe('claim_unwitnessed')
    expect(steps[0].text).toBe(only.claims[0].text)
    expect(steps[0].criteria[0].status).toBe('unverified')
  })

  it('takes a supported finding verbatim without turning a claim into a check', () => {
    const step = buildStory(doc).find(step => step.event.payload.claim_id === doc.claims[0].claim_id)!
    expect(step.finding).toBe(doc.claims[0].finding)
    expect(step.kind).toBe('claim')
  })

  it('does not invent a finding when a claim projection is absent', () => {
    const step = buildStory({ ...doc, claims: [] }).find(step => step.kind === 'claim')!
    expect(step.finding).toBeUndefined()
    expect(step.text).toBe(step.event.payload.text)
  })

  it('shows a recorded evidence result without promoting an unverified criterion', () => {
    const only = claimOnlyRun()
    only.events = [{ ...only.events[0], type: 'evidence.attached', payload: {
      kind: 'test_run', result: 'pass', criterion_ids: [only.criteria[0].criterion_id],
    } }]
    const [step] = buildStory(only)
    expect(step.title).toBe('Checks reported')
    expect(step.text).toBe('Recorded result: pass.')
    expect(step.criteria[0].status).toBe('unverified')
    expect(only.criteria[0].status).toBe('unverified')
  })

  it('ignores unknown event types without manufacturing a story', () => {
    const event = { ...doc.events[0], type: 'fixture.unknown', summary: 'Unknown fixture' }
    expect(buildStory({ ...doc, events: [event] })).toEqual([])
  })

  it('keeps a failed test-command exit visible even with zero test results', () => {
    const event = { ...doc.events[0], type: 'test.reported', payload: {
      passed: 0, failed: 0, skipped: 0, exit_code: 125,
    } }
    const [step] = buildStory({ ...doc, events: [event] })
    expect(step.text).toBe('0 passed, 0 failed, 0 skipped. Exit code 125.')
  })

  it.each([{ changed: [] }, { changed: undefined }])('does not claim files changed when the diff record lists none: %j', ({ changed }) => {
    const event = { ...doc.events[0], type: 'evidence.attached', payload: {
      kind: 'file_changed', refers_to: 'git_diff_after', changed, result: 'info',
    } }
    const [step] = buildStory({ ...doc, events: [event] })
    expect(step.title).toBe('File change record')
    expect(step.text).toBe('No changed files are listed in this record.')
  })
})
