// Optional local visual check; not part of npm test or CI. See README.md.
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { preview } from 'vite'
import { buildEvidenceGraph } from '../src/graph/evidence-graph.ts'

const viewerRoot = fileURLToPath(new URL('../', import.meta.url))
const output = join(viewerRoot, '.screenshots')
// Browser binaries stay inside this clone, including when launched without an env override.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= fileURLToPath(new URL('../../.venv/playwright', import.meta.url))
let server
let browser
let written = 0
let browserError = false
let stage = 'initialization'
try {
  const { chromium } = await import('playwright')
  const doc = JSON.parse(await readFile(join(viewerRoot, 'dist/run.json'), 'utf8'))
  const graph = buildEvidenceGraph(doc)
  await mkdir(output, { recursive: true })
  stage = 'start vite preview'
  server = await preview({ root: viewerRoot, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  const { port } = server.httpServer.address()
  const origin = `http://127.0.0.1:${port}`
  stage = 'launch Chromium'
  browser = await chromium.launch({ headless: true })
  for (const lens of ['client', 'developer']) {
    stage = `capture ${lens} views`
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'UTC', reducedMotion: 'reduce', hasTouch: true })
    try {
      await context.addInitScript(value => localStorage.setItem('tl-lens', value), lens)
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
      const page = await context.newPage()
      page.on('pageerror', () => { browserError = true })
      page.on('console', message => { if (message.type() === 'error') browserError = true })
      page.on('response', response => { if (response.status() >= 400) browserError = true })
      await page.goto(origin)
      await page.getByRole('heading', { level: 1 }).waitFor()
      await page.getByText("This browser checks the file's internal consistency only; it does not verify signatures.", { exact: true }).waitFor()

      const capture = async name => {
        if (browserError) throw new Error('Browser resource or rendering error')
        const hasDialog=(await page.getByRole('dialog').count()) > 0
        if (!hasDialog) await page.evaluate(() => window.scrollTo(0,0))
        await page.screenshot({ path: join(output, `${name}-${lens}.png`), fullPage: !hasDialog, animations: 'disabled' })
        written++
      }
      if (graph.nodes.length) {
        stage = `wait for actual graph nodes and edges (${lens})`
        await page.waitForFunction(({nodes,edges}) => document.querySelectorAll('.react-flow__node').length === nodes && document.querySelectorAll('.react-flow__edge').length === edges, {nodes:graph.nodes.length,edges:graph.edges.length})
        await page.getByRole('region', {name:'Beleg-Graph',exact:true}).screenshot({path:join(output,`graph-${lens}.png`),animations:'disabled'})
        written++
      }
      await capture('overview')
      for (const width of [1280, 1024, 900, 768, 701, 360]) {
        stage = `capture overview at ${width}px (${lens})`
        await page.setViewportSize({ width, height: 1000 })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
        if (overflow) throw new Error('Overview overflows the viewport')
        if (width > 700) {
          await page.evaluate(()=>window.scrollTo(0,900))
          const navHidden=await page.getByRole('navigation',{name:'Viewer navigation'}).getByRole('button',{name:'Overview',exact:true}).evaluate(button=>{
            const rect=button.getBoundingClientRect();return rect.top<0||rect.bottom>innerHeight
          })
          if(navHidden) throw new Error('Navigation is offscreen after scrolling')
          const trustHidden=await page.locator('main > .integrity-notice').evaluate(notice=>{
            const rect=notice.getBoundingClientRect();return rect.top<0||rect.bottom>innerHeight
          })
          if(trustHidden) throw new Error('Trust notice is offscreen after scrolling')
        }
        await capture(`overview-${width}`)
        stage = `toggle Navigator at ${width}px (${lens})`
        await page.getByRole('button',{name:'Navigator einklappen',exact:true}).click()
        if(await page.getByRole('textbox',{name:'Nachricht an Navigator'}).count()) throw new Error('Collapsed Navigator exposes its input')
        if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw new Error('Collapsed Navigator overflows')
        await capture(`navigator-collapsed-${width}`)
        await page.getByRole('button',{name:'Navigator ausklappen',exact:true}).click()
        if(!await page.getByRole('textbox',{name:'Nachricht an Navigator'}).isDisabled()) throw new Error('Navigator input is enabled')
        if (width === 360 && graph.nodes.length) {
          stage = `tap graph node on mobile (${lens})`
          await page.locator('.react-flow__node button').first().tap({timeout:5000})
          await page.getByRole('dialog',{name:'Claim detail'}).waitFor()
          await page.getByRole('dialog').getByText('Integrität ≠ fachliche Freigabe',{exact:true}).waitFor()
          await capture('graph-mobile-drawer')
          await page.getByRole('button',{name:'Close',exact:true}).click()
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 })
      if (graph.nodes.length) {
        stage = `open graph node with pointer (${lens})`
        await page.locator('.react-flow__node button').first().click({timeout:5000})
        await page.getByRole('dialog',{name:'Claim detail'}).waitFor()
        await page.keyboard.press('Tab')
        if (!await page.getByRole('dialog').evaluate(dialog => dialog.contains(document.activeElement))) throw new Error('Focus escaped the Sheet')
        await page.keyboard.press('Escape')
        for (const kind of ['claim','criterion','evidence','file']) {
          const node = page.locator(`.react-flow__node[data-id^="${kind}:"] button`).first()
          if (!await node.count()) continue
          stage = `open ${kind} graph node by keyboard (${lens})`
          await node.focus()
          await page.keyboard.press('Enter')
          const dialog=page.getByRole('dialog')
          await dialog.waitFor()
          await dialog.getByText('Integrität ≠ fachliche Freigabe',{exact:true}).waitFor()
          if (kind==='claim') await capture('graph-drawer')
          await page.keyboard.press('Escape')
          await dialog.waitFor({state:'hidden'})
          await page.waitForFunction(() => document.activeElement?.matches('.graph-record'))
        }
      }
      await page.getByRole('button', { name: 'Claimed vs Proven', exact: true }).click()
      await page.locator('main').getByRole('heading', { level: 1 }).waitFor()
      await capture('claimed-vs-proven')
      stage = `capture Agent Story (${lens})`
      await page.getByRole('button', { name: 'Agent Story', exact: true }).click()
      await page.getByRole('heading', { name: 'Agent Story', exact: true }).waitFor()
      await page.getByText('Review required — technical checks do not replace human acceptance.', { exact: true }).waitFor()
      await capture('agent-story')
      const storyLinks = page.getByRole('list', { name: 'Recorded story' }).getByRole('button')
      if (await storyLinks.count()) {
        await storyLinks.first().click()
        await page.getByRole('dialog', { name: 'Event detail' }).waitFor()
        await capture('agent-story-drawer')
        await page.getByRole('button', { name: 'Close', exact: true }).click()
      }
      await page.getByRole('button', { name: 'Timeline', exact: true }).click()
      await page.getByRole('heading', { name: 'Timeline', exact: true }).waitFor()
      await capture('timeline')

      const diffEvent = doc.events.find(event => typeof event.payload.sha256 === 'string' && doc.blobs?.[event.payload.sha256]?.startsWith('diff --git'))
      if (diffEvent) {
        stage = `open diff drawer (${lens})`
        const index = [...doc.events].sort((a, b) => a.seq - b.seq).indexOf(diffEvent)
        await page.locator('main').getByRole('row').nth(index + 1).getByRole('button').focus()
        await page.keyboard.press('Enter')
        await page.getByRole('dialog', { name: 'Event detail' }).waitFor()
        await page.getByRole('dialog').locator('pre code').waitFor()
        await capture('diff-drawer')
        stage = `close diff drawer (${lens})`
        const close = page.getByRole('button', { name: 'Close', exact: true })
        for (const width of [1440, 360]) {
          await page.setViewportSize({ width, height: 1000 })
          const blocked = await close.evaluate(button => {
            const badge = document.querySelector('.drawer-pane .integrity-badge')
            if (!badge) return true
            const a = button.getBoundingClientRect()
            const b = badge.getBoundingClientRect()
            return b.left < 0 || b.right > window.innerWidth
              || (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)
          })
          if (blocked) throw new Error('Integrity badge is offscreen or overlaps Close')
        }
        await page.setViewportSize({ width: 1440, height: 1000 })
        await close.click()
      }
      const criterion = doc.criteria.find(criterion => criterion.evidence.length > 0)
      if (criterion) {
        stage = `return to Overview (${lens})`
        await page.getByRole('button', { name: 'Overview', exact: true }).click()
        stage = `open criterion drawer (${lens})`
        await page.getByRole('button', { name: `Belege: ${criterion.text}`, exact: true }).click()
        await page.getByRole('dialog', { name: 'Evidence detail' }).waitFor()
        await capture('criterion-drawer')
      }
    } finally {
      await context.close()
    }
  }
  if (browserError) throw new Error('Browser resource or rendering error')
  console.log(`${written} screenshots written to ${output}; no browser or HTTP errors.`)
} catch (error) {
  // Do not dump arbitrary run data, DOM contents or browser logs on failure.
  console.error(`Screenshot check failed (${stage}, ${error.name}). Build the viewer and install Chromium as described in README.md; check the selected run has valid views.`)
  process.exitCode = 1
} finally {
  await browser?.close()
  await server?.close()
}
