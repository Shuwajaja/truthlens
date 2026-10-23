import {useSyncExternalStore} from 'react'
const query='(max-width: 767px)'
function subscribe(change:()=>void){
 const media=typeof window!=='undefined'&&window.matchMedia?.(query)
 if(!media)return ()=>{}
 media.addEventListener('change',change)
 return ()=>media.removeEventListener('change',change)
}
function snapshot(){return typeof window!=='undefined'&&(window.matchMedia?.(query).matches??false)}
export function useMobile(){return useSyncExternalStore(subscribe,snapshot,()=>false)}

const wideQuery='(min-width: 1200px)'
function subscribeWide(change:()=>void){const media=window.matchMedia?.(wideQuery);if(!media)return ()=>{};media.addEventListener('change',change);return ()=>media.removeEventListener('change',change)}
export function useWide(){return useSyncExternalStore(subscribeWide,()=>typeof window!=='undefined'&&(window.matchMedia?.(wideQuery).matches??true),()=>true)}
