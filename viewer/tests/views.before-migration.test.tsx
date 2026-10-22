// @vitest-environment jsdom
import './browser-env.ts'
import { createHash } from 'node:crypto'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import { Drawer, type DrawerTarget } from '../src/components/Drawer.tsx'
import { EvidenceBlobContent } from '../src/components/EvidenceBlobContent.tsx'
import type { Lens } from '../src/lens.ts'
import type { RunDoc, RunEvent } from '../src/types.ts'
import publicRun from '../public/run.json'

const doc = publicRun as RunDoc
const lenses: Lens[] = ['client', 'developer']

beforeEach(() => {
  vi.stubEnv('TZ', 'UTC')
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => structuredClone(doc) })))
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

// The real export has a diff but no Markdown. Supplement only this isolated drawer fixture;
// never change public/run.json or present this synthetic event as a recorded witness.
const markdown = '# Synthetic snapshot fixture\n\n**Claimed**, not witnessed. See `fixture.ts`.\n\n- one\n- two\n\n```text\n<script>escaped</script>\n```'
const markdownSha = createHash('sha256').update(markdown).digest('hex')
const diffEvent = doc.events.find(event => {
  const sha = event.payload.sha256
  return typeof sha === 'string' && doc.blobs?.[sha]?.startsWith('diff --git')
})!
const markdownEvent: RunEvent = {
  ...diffEvent,
  id: 'synthetic-markdown-fixture',
  summary: 'Synthetic Markdown fixture, not a recorded witness',
  actor: { kind: 'agent', id: 'snapshot-fixture' },
  payload: { path: 'fixture-report.md', sha256: markdownSha },
}
const target: DrawerTarget = {
  kind: 'criterion',
  criterion: {
    criterion_id: 'synthetic-criterion-fixture', text: 'Synthetic renderer snapshot fixture',
    plain: 'Synthetic fixture, not a recorded witness.', status: 'unverified',
    claimed: false, card: 'gray', evidence: [diffEvent.id, markdownEvent.id],
  },
  matched: [diffEvent, markdownEvent],
}
const fixtureBlobs = { ...doc.blobs, [markdownSha]: markdown }

// Snapshot a cloned portal as a fragment, preserving the original DOM serializer.
function dialogFragment() {
  const fragment=document.createDocumentFragment()
  fragment.appendChild(screen.getByRole('dialog').cloneNode(true))
  fragment.normalize() // Match RTL asFragment(): adjacent text nodes serialize together.
  return fragment
}

// P2 intentionally updates six App layouts (header, navigation, trust notice, overview,
// claim badges and keyboard-accessible Timeline). P2 Step 3 adds Graph to the two
// Overview snapshots and replaces the outer drawer shell with a portalled Sheet.
// Snapshot the actual dialog; diff/Markdown/plain content remains unchanged.
// P3 intentionally updates layout snapshots; the P1 behavior-only migration is complete.
// P2 Step 4 adds the static Navigator and a sticky-control wrapper to six App snapshots.
describe('pre-migration viewer snapshots (must remain unchanged)', () => {
  for (const lens of lenses) {
    for (const view of ['Overview', 'Claimed vs Proven', 'Timeline']) {
      it(`${view}, ${lens} lens, real public/run.json`, async () => {
        localStorage.setItem('tl-lens', lens)
        const { asFragment } = render(<App />)
        await screen.findByRole('heading', { level: 1 })
        fireEvent.click(screen.getByRole('button', { name: ({Overview:'Übersicht','Claimed vs Proven':'Behauptet vs. belegt',Timeline:'Zeitachse'} as const)[view], exact: true }))
        expect(screen.getByText("This browser checks the file's internal consistency only; it does not verify signatures.")).toBeTruthy()
        expect(asFragment()).toMatchSnapshot()
      })
    }

    it(`criterion drawer with diff and synthetic Markdown, ${lens} lens`, () => {
      render(<Drawer target={target} blobs={fixtureBlobs} lens={lens} onClose={() => {}} />)
      expect(screen.getByRole('dialog', { name: 'Evidence detail' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Source' })).toBeTruthy()
      expect(screen.getByText('diff --git a/dev/null b/index.html')).toBeTruthy()
      expect(dialogFragment()).toMatchSnapshot()
    })
  }

  it('preserves the Markdown source toggle inside the criterion drawer', () => {
    render(<Drawer target={target} blobs={fixtureBlobs} lens="client" onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Source' }))
    expect(within(screen.getByRole('dialog')).getByText(markdown, { normalizer: text => text })).toBeTruthy()
    expect(dialogFragment()).toMatchSnapshot()
  })

  it('preserves plain text byte for byte, including JSON-looking content', () => {
    const text = '{"status":"unverified","verified":false}\n<script>escaped</script>'
    const { container, asFragment } = render(<EvidenceBlobContent payload={{ sha256: 'plain-fixture', path: 'fixture.txt' }} blobs={{ 'plain-fixture': text }} />)
    expect(container.querySelector('pre')?.textContent).toBe(text)
    expect(container.querySelector('script')).toBeNull()
    expect(asFragment()).toMatchSnapshot()
  })
})
