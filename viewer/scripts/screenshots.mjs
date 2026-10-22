// Optional review of the current P3 interface in both lenses.
process.env.P3_LENSES='client,developer'
process.env.P3_SHOTS??='.screenshots/both-lenses'
await import('./review-screenshots.mjs')
