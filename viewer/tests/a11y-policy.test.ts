import {expect,it} from 'vitest'
import {requiredScans,validateAudit} from '../scripts/a11y-policy.mjs'

const report=()=>({errors:[],keyboard:[{reachable:true,reached:true,focusVisible:true,scrolled:true}],results:requiredScans().map(scan=>({...scan,passes:['aria-prohibited-attr'],violations:[],incomplete:[]}))})
it('requires48 complete viewport/lens/view/dialog/tab combinations',()=>{
 expect(requiredScans()).toHaveLength(48)
 expect(()=>validateAudit(report())).not.toThrow()
})
it('rejects missing mobile/lens coverage even if the total count is unchanged',()=>{
 const value=report();value.results[value.results.length-1]=value.results[0]
 expect(()=>validateAudit(value)).toThrow(/coverage/)
})
it('fails on any violation, including a minor one',()=>{
 const value=report();Object.assign(value.results[0],{violations:[{id:'synthetic-policy-failure',impact:'minor'}]})
 expect(()=>validateAudit(value)).toThrow(/violations/)
})
it('fails on browser errors or inaccessible overflowing records',()=>{
 const value=report();Object.assign(value,{errors:['Synthetic browser failure']})
 expect(()=>validateAudit(value)).toThrow(/browser/)
 const keyboard=report();keyboard.keyboard[0].scrolled=false
 expect(()=>validateAudit(keyboard)).toThrow(/keyboard/)
})
it('retains incomplete results as review items instead of silently turning them into passes',()=>{
 const value=report();Object.assign(value.results[0],{incomplete:[{id:'color-contrast',nodes:[{target:['.synthetic-clipped-text']}]}]})
 validateAudit(value)
 expect(value.results[0].incomplete).toHaveLength(1)
})
