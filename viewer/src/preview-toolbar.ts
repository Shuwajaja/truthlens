// Official injection-script URL; gated and lazy-loaded by the entry point.
const source='https://vercel.live/_next-live/feedback/feedback.js'

export function mountPreviewToolbar():void{
 if(document.querySelector(`vercel-live-feedback, script[src^="${source}"]`))return
 const script=document.createElement('script')
 script.src=source
 script.async=true
 script.dataset.explicitOptIn='true'
 script.addEventListener('error',()=>console.warn('Preview comments unavailable.'),{once:true})
 document.head.append(script)
}
