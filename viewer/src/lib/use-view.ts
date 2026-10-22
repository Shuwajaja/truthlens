import {useEffect,useState} from 'react'

export type View = 'overview' | 'claimed-vs-proven' | 'timeline' | 'agent-story'

function readView():View {
  const value=new URL(window.location.href).searchParams.get('view')
  return value==='claimed-vs-proven'||value==='timeline'||value==='agent-story' ? value : 'overview'
}

/** The URL is shareable; only actual view changes add history entries. */
export function useView() {
  const [view,setView]=useState<View>(readView)
  useEffect(()=>{
    const restore=()=>setView(readView())
    window.addEventListener('popstate',restore)
    return ()=>window.removeEventListener('popstate',restore)
  },[])
  const navigate=(next:View)=>{
    if(next!==readView()){
      const url=new URL(window.location.href)
      url.searchParams.set('view',next)
      window.history.pushState(window.history.state,'',url)
    }
    setView(next)
  }
  return [view,navigate] as const
}
