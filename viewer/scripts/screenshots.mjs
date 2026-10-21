// Optional local visual check; not part of npm test or CI. See README.md.
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { preview } from 'vite'

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
  await mkdir(output, { recursive: true })
  stage = 'start vite preview'
  server = await preview({ root: viewerRoot, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  const { port } = server.httpServer.address()
  const origin = `http://127.0.0.1:${port}`
  stage = 'launch Chromium'
  browser = await chromium.launch({ headless: true })
  for (const lens of ['client', 'developer']) {
    stage = `capture ${lens} views`
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'UTC', reducedMotion: 'reduce' })
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
        await page.screenshot({ path: join(output, `${name}-${lens}.png`), fullPage: true, animations: 'disabled' })
        written++
      }
      await capture('overview')
      await page.getByRole('button', { name: 'Claimed vs Proven', exact: true }).click()
      await page.getByRole('heading', { level: 2 }).waitFor()
      await capture('claimed-vs-proven')
      await page.getByRole('button', { name: 'Timeline', exact: true }).click()
      await page.getByRole('heading', { name: 'Timeline', exact: true }).waitFor()
      await capture('timeline')

      const diffEvent = doc.events.find(event => typeof event.payload.sha256 === 'string' && doc.blobs?.[event.payload.sha256]?.startsWith('diff --git'))
      if (diffEvent) {
        stage = `open diff drawer (${lens})`
        const index = [...doc.events].sort((a, b) => a.seq - b.seq).indexOf(diffEvent)
        await page.locator('main').getByRole('row').nth(index + 1).click()
        await page.getByRole('dialog', { name: 'Event detail' }).waitFor()
        await page.getByRole('dialog').locator('pre code').waitFor()
        await capture('diff-drawer')
        stage = `close diff drawer (${lens})`
        const close = page.getByRole('button', { name: 'Close', exact: true })
        const overlaps = await close.evaluate(button => {
          const badge = document.querySelector('.integrity-badge')
          if (!badge) return false
          const a = button.getBoundingClientRect()
          const b = badge.getBoundingClientRect()
          return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
        })
        if (overlaps) throw new Error('Integrity badge overlaps the drawer close button')
        await close.click()
      }
      const criterion = doc.criteria.find(criterion => criterion.evidence.length > 0)
      if (criterion) {
        stage = `return to Overview (${lens})`
        await page.getByRole('button', { name: 'Overview', exact: true }).click()
        stage = `open criterion drawer (${lens})`
        await page.locator('main').getByRole('button').nth(doc.criteria.indexOf(criterion)).click()
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
