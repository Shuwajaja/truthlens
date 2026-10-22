import { describe, expect, it, vi } from 'vitest'
import { RegistryPoller } from './poller'

const run = 'run_00000000000000000000000001'
const event = (seq: number, hash = 'a'.repeat(64)) => ({run_id: run, seq, hash, type: 'test.reported', actor: 'wrapper', recorded_at: '2026-10-23T00:00:00Z'})
const page = (events = [event(1)]) => ({run_id: run, events, next_seq: events.at(-1)?.seq ?? 0, has_more: false, audit: {state:'queued', connection:'not connected'}})

describe('registry polling contract', () => {
  it('deduplicates identical records and rejects changed hashes without replacing last data', async () => {
    let body = page()
    const load = vi.fn(async () => body)
    const poller = new RegistryPoller(run, load, () => {})
    await poller.refresh()
    await poller.refresh()
    expect(poller.snapshot.events).toHaveLength(1)
    body = page([event(1, 'b'.repeat(64))])
    await poller.refresh()
    expect(poller.snapshot.problem).toBe('Record consistency error')
    expect(poller.snapshot.events[0].hash).toBe('a'.repeat(64))
  })
  it('keeps the last data after three failures and backs off; hidden pages make no request', async () => {
    const load = vi.fn(async () => page())
    const poller = new RegistryPoller(run, load, () => {})
    await poller.refresh()
    load.mockRejectedValue(new Error('network'))
    await poller.refresh(); await poller.refresh(); await poller.refresh()
    expect(poller.snapshot.problem).toBe('Updates interrupted')
    expect(poller.snapshot.events).toHaveLength(1)
    expect(poller.delay).toBe(15000)
    poller.hidden = true
    await poller.refresh()
    expect(load).toHaveBeenCalledTimes(4)
  })
  it('allows only one request and does not accept sequence gaps or another run', async () => {
    let finish: (value: unknown) => void = () => {}
    const load = vi.fn(() => new Promise<unknown>(resolve => { finish = resolve }))
    const poller = new RegistryPoller(run, load, () => {})
    const pending = poller.refresh()
    await poller.refresh()
    expect(load).toHaveBeenCalledTimes(1)
    finish(page()); await pending
    load.mockResolvedValue(page([event(3)]))
    await poller.refresh()
    expect(poller.snapshot.problem).toBe('Record consistency error')
    expect(poller.snapshot.events[0].seq).toBe(1)
  })
})
