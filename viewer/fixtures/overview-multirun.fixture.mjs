// Synthetic development/review inputs only. No ledger, signature, live agent,
// witnessed execution or human approval is represented by these documents.
// Imported only by tests and the separate manual-review HTML entry, never App.
export function overviewMultirunFixture(){
 const rows=[
  ['A',6,0,0],['B',5,0,0],['A',7,0,0],['C',2,0,4],
  ['A',8,0,0],['B',6,0,0],['C',3,2,0],['A',7,0,0],
  ['A',8,0,0],['B',4,0,3],['C',5,0,0],['B',6,0,0],
  ['A',9,0,0],['A',7,1,1],
 ]
 const names={A:'Fixture Agent A',B:'Fixture Agent B',C:'FixtureAgentWithAnIntentionallyLongUnbrokenNameForEllipsisReview'}
 return rows.map(([agent,met,unmet,unverified],index)=>{
  const id=`fixture-overview-${String(index+1).padStart(2,'0')}`
  const started=new Date(Date.UTC(2026,9,23,12)+index*4*3600000).toISOString()
  const criteria=[],events=[]
  for(const [status,count,card] of [['met',met,'green'],['unmet',unmet,'red'],['unverified',unverified,'gray']]){
   for(let i=0;i<count;i++){
    const criterionId=`${id}-c${criteria.length+1}`,eventId=`${criterionId}-synthetic-report`
    const checked=status!=='unverified'
    criteria.push({criterion_id:criterionId,text:`Development fixture criterion ${criteria.length+1}`,plain:'Synthetic fixture, not a witnessed check.',status,card,claimed:false,evidence:checked?[eventId]:[]})
    if(checked)events.push({seq:events.length+1,id:eventId,ts:started,type:'test.reported',actor:{kind:'system',id:'synthetic-fixture-generator'},summary:'Development fixture · synthetic report',hash:'',payload:{criterion_ids:[criterionId],passed:status==='met'?1:0,failed:status==='unmet'?1:0,skipped:0,exit_code:status==='met'?0:1}})
   }
  }
  for(const kind of ['command_run','file_changed','test_files_changed'])events.push({seq:events.length+1,id:`${id}-${kind}`,ts:started,type:'evidence.attached',actor:{kind:'system',id:'synthetic-fixture-generator'},summary:'Development fixture · synthetic evidence',hash:'',payload:{kind}})
  return {verified:false,integrity:'hash-only',headline:['Synthetic development fixture; not a recorded execution.'],review_required:false,
   run:{run_id:id,project:`Development fixture ${String(index+1).padStart(2,'0')}`,agent:names[agent],command:'',started,finished:null,exit_code:null,ledger_last_hash:'',events:events.length},
   counts:{green:met,red:unmet,gray:unverified,yellow:0,outline:0},criteria,events,claims:[],artifacts:[],blobs:{}}
 })
}
