import assert from 'node:assert/strict'

export function requiredScans(){
 const scans=[]
 for(const viewport of [{width:1440,height:900},{width:390,height:844}])for(const lens of ['client','developer']){
  const mobile=viewport.width===390
  const states=['overview','claims','timeline','agent-story',...(mobile?['overview-trust-sheet','claims-trust-sheet','timeline-trust-sheet','agent-story-trust-sheet','run-sheet','criterion-sheet']:['claim-drawer','criterion-drawer','evidence-drawer','file-drawer'])]
  const criterion=mobile?'criterion-sheet':'criterion-drawer'
  states.push(...['Tests','Files','Time'].map(tab=>`${criterion}:tab:${tab}`))
  scans.push(...states.map(state=>({viewport,lens,state})))
 }
 return scans
}

export function validateAudit(report){
 const key=s=>`${s.viewport.width}x${s.viewport.height}/${s.lens}/${s.state}`
 assert(Array.isArray(report.results),'coverage: missing results')
 const keys=report.results.map(key)
 assert.equal(new Set(keys).size,keys.length,'coverage: duplicate states')
 for(const scan of requiredScans())assert(keys.includes(key(scan)),`coverage: missing ${key(scan)}`)
 assert.deepEqual(report.errors,[],'browser errors')
 for(const result of report.results){
  assert(Array.isArray(result.passes)&&result.passes.length>0,'missing axe results')
  assert(Array.isArray(result.incomplete),'missing incomplete review evidence')
  assert.deepEqual(result.violations,[],`axe violations: ${key(result)}`)
 }
 assert(report.keyboard.length>0&&report.keyboard.every(c=>c.reachable&&c.reached&&c.focusVisible&&c.scrolled),'keyboard scroll/focus failure')
}
