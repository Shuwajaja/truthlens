import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'
import {referenceThemeViolations,styleViolations} from '../scripts/check-styles.mjs'
it.each([
 '.x{color:#79B8FF}', '<path fill="#fff"/>', '<div style={{color:"rgb(1,2,3)"}}/>',
 '.x{background:hsl(20 50% 40%)}', '.x{fill:oklch(60% 0.2 30)}',
 '<div className="hover:bg-blue-500 dark:text-rose-400 ring-offset-white outline-violet-300"/>',
 '<svg stroke="red"/>', '.x{color:cyan}', '<svg stroke="chartreuse"/>', '<div className="bg-[cyan]"/>', '<div className="from-emerald-500 via-black to-zinc-900"/>',
])('rejects literal colours in CSS, JSX, SVG and default utilities: %s',source=>{
 expect(styleViolations(source).length).toBeGreaterThan(0)
})
it('allows only semantic colours and inherited/transparent styling while retaining size checks',()=>{
 expect(styleViolations('.x{color:var(--text);background:color-mix(in srgb,var(--surface) 80%,transparent);fill:currentColor} <div className="bg-surface text-2 ring-ring border-fail/40"/>')).toEqual([])
 expect(styleViolations('.x{font-size:13px}')).toContain('typography')
})

it('checks the reference theme instead of skipping it',()=>{
 const source=readFileSync('src/reference/theme.css','utf8')
 expect(referenceThemeViolations(source)).toEqual([])
 expect(referenceThemeViolations(source+'\n.x{font-size:15px}')).toContain('typography')
 expect(referenceThemeViolations(source+'\n.x{color:red}')).toContain('literal colour')
 expect(referenceThemeViolations(source+'\n.x{background:linear-gradient(#fff,#000)}')).toContain('decorative effect or emoji')
})

it.each(['.x{background:linear-gradient(var(--bg),var(--surface))}','<div className="backdrop-blur-md"/>','<div className="drop-shadow-lg"/>','<p>🚀</p>'])('rejects decorative effects or emoji: %s',source=>{
 expect(styleViolations(source)).toContain('decorative effect or emoji')
})
