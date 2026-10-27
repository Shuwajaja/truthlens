import {expect,it} from 'vitest'
import {auditWord,criterionWord,exportAuthenticated} from '../src/workspace/display-label.ts'

it('maps criteria only when the export pair is verified hmac',()=>{
 expect(exportAuthenticated({verified:true,integrity:'hmac'})).toBe(true)
 expect(exportAuthenticated({verified:false,integrity:'hmac'})).toBe(false)
 expect(exportAuthenticated({verified:true,integrity:'hash-only'})).toBe(false)
 expect(criterionWord('met',false)).toBe('UNKNOWN')
 expect(criterionWord('unmet',false)).toBe('UNKNOWN')
 expect(criterionWord('met',true)).toBe('TRUE')
 expect(criterionWord('unmet',true)).toBe('FALSE')
 expect(criterionWord('unverified',true)).toBe('UNKNOWN')
 expect(criterionWord('proposed',true)).toBe('UNKNOWN')
})

it('never derives an audit word from criteria or an extra field',()=>{
 expect(auditWord()).toBe('UNKNOWN')
 expect(auditWord('passed')).toBe('UNKNOWN')
 expect(auditWord({status:'passed',criteria:[{status:'met'}]})).toBe('UNKNOWN')
})
