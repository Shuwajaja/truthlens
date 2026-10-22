import {useSyncExternalStore} from 'react'
const query='(max-width: 760px)'
function subscribe(change:()=>void){
 const media=typeof window!=='undefined'&&window.matchMedia?.(query)
 if(!media)return ()=>{}
 media.addEventListener('change',change)
 return ()=>media.removeEventListener('change',change)
}
function snapshot(){return typeof window!=='undefined'&&(window.matchMedia?.(query).matches??false)}
export function useMobile(){return useSyncExternalStore(subscribe,snapshot,()=>false)}
