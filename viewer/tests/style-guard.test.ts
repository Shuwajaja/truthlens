import {expect,it} from 'vitest'
import {styleViolations} from '../scripts/check-styles.mjs'
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
