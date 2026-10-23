export type RecordedEvent = {run_id:string;seq:number;hash:string;type:string;actor:string;recorded_at:string;result?:Record<string,number>}
export type AuditSummary = {state:string;conclusion?:string|null;connection:string;authentication?:string;integrity?:string;verified?:boolean;last_activity?:string|null;claim_checks?:{rule_id:string;message:string;outcome:string}[]}
export type Snapshot = {events:RecordedEvent[];audit:AuditSummary|null;problem:string|null;stale:boolean;hasMore:boolean}
type Page = {run_id:string;events:RecordedEvent[];next_seq:number;has_more:boolean;audit:AuditSummary}
const object = (v:unknown):v is Record<string,unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
function validate(value:unknown, run:string):Page {
  if(!object(value) || value.run_id !== run || !Array.isArray(value.events) || value.events.length > 5 ||
    !Number.isSafeInteger(value.next_seq) || typeof value.has_more !== 'boolean' || !object(value.audit) ||
    typeof value.audit.state !== 'string' || typeof value.audit.connection !== 'string') throw Error('invalid source')
  for(const key of ['conclusion','authentication','integrity','last_activity']) {
    const scalar=value.audit[key]
    if(scalar !== undefined && scalar !== null && typeof scalar !== 'string') throw Error('invalid source')
  }
  if(value.audit.verified !== undefined && typeof value.audit.verified !== 'boolean') throw Error('invalid source')
  for(const event of value.events) {
    if(!object(event) || event.run_id !== run || !Number.isSafeInteger(event.seq) || Number(event.seq) <= 0 ||
      typeof event.hash !== 'string' || !/^[a-f0-9]{64}$/.test(event.hash) || typeof event.type !== 'string' ||
      typeof event.actor !== 'string' || typeof event.recorded_at !== 'string' ||
      (event.result !== undefined && (!object(event.result) || Object.entries(event.result).some(([key,v])=>!['passed','failed','skipped','exit_code'].includes(key) || !Number.isSafeInteger(v))))) throw Error('invalid source')
  }
  if(value.audit.claim_checks !== undefined && (!Array.isArray(value.audit.claim_checks) ||
    value.audit.claim_checks.some(c=>!object(c) || typeof c.rule_id !== 'string' || !/^TL-AUD-[0-9]{3}$/.test(c.rule_id) || typeof c.message !== 'string' || c.message.length>1024 || typeof c.outcome !== 'string'))) throw Error('invalid source')
  return value as Page
}

export class RegistryPoller {
  snapshot:Snapshot = {events:[],audit:null,problem:null,stale:false,hasMore:false}
  hidden = false
  busy = false
  delay = 2000
  private cursor = 0
  private latest:RecordedEvent[] = []
  private history = false
  private failures = 0
  private hashes = new Map<number,string>()
  private controller:AbortController|null = null
  private stopped = false
  private consistencyError = false
  private run:string
  private load:(cursor:number,signal:AbortSignal,before?:number)=>Promise<unknown>
  private changed:(snapshot:Snapshot)=>void
  constructor(run:string,load:(cursor:number,signal:AbortSignal,before?:number)=>Promise<unknown>,changed:(snapshot:Snapshot)=>void) {
    this.run=run;this.load=load;this.changed=changed
  }
  showLatest() {this.history=false;this.snapshot={...this.snapshot,events:this.latest};this.changed(this.snapshot)}
  stop() {this.stopped=true;this.controller?.abort()}
  async refresh(before?:number) {
    if(this.busy || this.hidden || this.stopped || this.consistencyError) return
    this.busy = true
    this.controller = new AbortController()
    const timeout = setTimeout(()=>this.controller?.abort(),10000)
    try {
      const page = validate(await this.load(before ? 0 : this.cursor,this.controller.signal,before),this.run)
      if(this.stopped) return
      let cursor = before ? 0 : this.cursor
      const known = new Map(this.hashes)
      const incoming:RecordedEvent[] = []
      for(const event of page.events) {
        const old = known.get(event.seq)
        if(old && old !== event.hash) throw Error('consistency')
        if(!before && event.seq <= cursor && !old) throw Error('consistency')
        if(!before && !old) {
          // The first authorized tail page establishes its own starting cursor.
          if(cursor && event.seq !== cursor+1) throw Error('consistency')
          cursor = event.seq
        }
        known.set(event.seq,event.hash)
        incoming.push(event)
      }
      if(!before && page.next_seq !== cursor) throw Error('consistency')
      if(known.size>100000) throw Error('consistency')
      this.hashes = known
      if(!before) this.cursor = cursor
      if(before) this.history=true
      if(!before) this.latest = [...this.latest,...incoming.filter(e=>!this.latest.some(old=>old.seq===e.seq))].slice(-5)
      const merged = before ? incoming : this.history ? this.snapshot.events : this.latest
      this.failures=0;this.delay=2000
      this.snapshot = {events:merged,audit:page.audit,problem:null,stale:false,hasMore:page.has_more || (merged[0]?.seq ?? 1)>1}
    } catch(error) {
      if(this.stopped) return
      this.failures++
      const inconsistent = error instanceof Error && error.message === 'consistency'
      if(inconsistent) this.consistencyError=true
      if(this.failures>=3) this.delay=15000
      this.snapshot = {...this.snapshot,stale:true,problem:inconsistent?'Record consistency error':this.failures>=3?'Updates interrupted':'Not connected'}
    } finally {
      clearTimeout(timeout)
      this.busy=false
      if(!this.stopped) this.changed(this.snapshot)
    }
  }
}
