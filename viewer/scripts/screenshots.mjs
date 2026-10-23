// Local-first Phase A uses the shared fixture review; the legacy runner remains below.
if((await (await import('node:fs/promises')).readFile(new URL('../src/App.tsx',import.meta.url),'utf8')).includes('<WorkspaceShell')){await (await import('./review-workspace.mjs')).reviewWorkspace();process.exit(0)}
// Optional review of the current P3 interface in both lenses.
process.env.P3_LENSES='client,developer'
process.env.P3_SHOTS??='.screenshots/both-lenses'
await import('./review-screenshots.mjs')
