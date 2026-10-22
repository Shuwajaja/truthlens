// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest'
afterEach(()=>{document.head.innerHTML='';document.body.innerHTML='';vi.resetModules()})
const source='https://vercel.live/_next-live/feedback/feedback.js'
it('mounts one official loader when repeated callers request preview comments',async()=>{
 const {mountPreviewToolbar}=await import('../src/preview-toolbar.ts')
 await Promise.all([mountPreviewToolbar(),mountPreviewToolbar()])
 const scripts=document.querySelectorAll<HTMLScriptElement>('script')
 expect(scripts).toHaveLength(1)
 expect(scripts[0].src).toBe(source)
 expect(scripts[0].dataset.explicitOptIn).toBe('true')
})
it.each(['script','vercel-live-feedback'])('reuses a platform-injected %s rather than injecting a second toolbar',async tag=>{
 const existing=document.createElement(tag)
 if(existing instanceof HTMLScriptElement)existing.src=source
 document.head.append(existing)
 const {mountPreviewToolbar}=await import('../src/preview-toolbar.ts')
 await mountPreviewToolbar()
 expect(document.head.childNodes).toHaveLength(1)
 expect(document.head.firstChild).toBe(existing)
})
