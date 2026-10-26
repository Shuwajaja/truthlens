import {expect,it,vi} from 'vitest'
import {readFileSync,readdirSync} from 'node:fs'
import {join} from 'node:path'
import {fixture,entries,canonical,hash} from './fixtures/local-folder.mjs'
import {openLocalFolder,originalDownload,derivedDownload,LOCAL_LIMITS} from '../src/local-folder.ts'

it('opens a valid folder, recomputes its evidence and never authenticates without a key',async()=>{
 const f=fixture(),opened=await openLocalFolder(entries(f.files))
 expect(opened.doc.run.run_id).toBe('run_synthetic');expect(opened.doc.criteria[0].status).toBe('met')
 expect(opened.doc).toMatchObject({verified:false,integrity:'hash-only',review_required:true})
 expect(opened.sourceId).toMatch(/^local-[a-f0-9]{64}$/)
})
it('rejects a corrupted ledger before returning any document',async()=>{
 const f=fixture();f.files.set('ledger.jsonl',Buffer.from(f.files.get('ledger.jsonl')!.toString().replace('Synthetic agent','Tampered agent')))
 await expect(openLocalFolder(entries(f.files))).rejects.toThrow(/hash/i)
})
it('rejects a manifest whose claimed acceptance was manipulated',async()=>{
 const f=fixture();f.manifest.acceptance[0].status='unmet';f.sync()
 await expect(openLocalFolder(entries(f.files))).rejects.toThrow(/manifest/i)
})
it('ignores forged export verified fields and derives all trust metadata',async()=>{
 const f=fixture();f.files.set('run.json',Buffer.from('{"verified":true,"integrity":"hmac"}'));Object.assign(f.manifest,{verified:true,integrity:'hmac'});f.sync()
 const opened=await openLocalFolder(entries(f.files));expect(opened.doc.verified).toBe(false);expect(opened.doc.integrity).toBe('hash-only')
})
it.each(['../ledger.jsonl','/ledger.jsonl','a/../../ledger.jsonl','a\\ledger.jsonl','a//b','a/./b','C:/ledger.jsonl','%2e%2e/ledger.jsonl'])('rejects traversal/ambiguous entry %s before reading',async path=>{
 const read=vi.fn();await expect(openLocalFolder([{path,kind:'file',size:1,read}])).rejects.toThrow(/path/i);expect(read).not.toHaveBeenCalled()
})
it('rejects symlink and unknown entries before reading any file',async()=>{
 const read=vi.fn();await expect(openLocalFolder([...entries(fixture().files),{path:'link',kind:'symlink',size:1,read}])).rejects.toThrow(/regular file|symlink/i);expect(read).not.toHaveBeenCalled()
})
it('rejects artifact traversal even in an otherwise hash-consistent ledger',async()=>{
 const f=fixture();f.events[3].payload.path='../outside';for(let n=3;n<f.events.length;n++){const e=f.events[n];e.prev_hash=f.events[n-1].hash;if(e.type==='run.finished')e.payload.last_hash=e.prev_hash;const {hash:_,...body}=e;e.hash=hash(canonical(body))}f.manifest.ledger_last_hash=f.events.at(-1).hash;f.manifest.artifacts[0].path='../outside';f.sync()
 await expect(openLocalFolder(entries(f.files))).rejects.toThrow(/path/i)
})
it('enforces file count, per-file and total size before reading',async()=>{
 const read=vi.fn(),entry={path:'x',kind:'file',size:1,read}
 await expect(openLocalFolder(Array.from({length:LOCAL_LIMITS.files+1},(_,i)=>({...entry,path:`x${i}`})))).rejects.toThrow(/count/i)
 await expect(openLocalFolder([{...entry,size:LOCAL_LIMITS.fileBytes+1}])).rejects.toThrow(/size/i)
 await expect(openLocalFolder(Array.from({length:Math.floor(LOCAL_LIMITS.totalBytes/LOCAL_LIMITS.fileBytes)+1},(_,i)=>({...entry,path:`x${i}`,size:LOCAL_LIMITS.fileBytes})))).rejects.toThrow(/size/i)
 expect(read).not.toHaveBeenCalled()
})
it('rejects actual bytes exceeding the declared size',async()=>{
 const f=fixture();const items=entries(f.files);items[0].size=1;await expect(openLocalFolder(items)).rejects.toThrow(/size/i)
})
it('rejects oversized image pixel dimensions before image decoding',async()=>{
 const png=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(13,8);png.write('IHDR',12);png.writeUInt32BE(100000,16);png.writeUInt32BE(100000,20)
 await expect(openLocalFolder(entries(fixture(png).files))).rejects.toThrow(/image|pixel/i)
})
it('fails closed on missing or corrupted referenced blobs',async()=>{
 const f=fixture();f.files.delete([...f.files.keys()].find(p=>p.startsWith('blobs/'))!);await expect(openLocalFolder(entries(f.files))).rejects.toThrow(/blob/i)
 const f2=fixture();f2.files.set([...f2.files.keys()].find(p=>p.startsWith('blobs/'))!,Buffer.from('corrupt'));await expect(openLocalFolder(entries(f2.files))).rejects.toThrow(/blob|hash/i)
})
it('downloads exact original ledger, manifest and evidence bytes; source stays unchanged',async()=>{
 const f=fixture(),before=new Map([...f.files].map(([p,b])=>[p,Buffer.from(b)])),opened=await openLocalFolder(entries(f.files))
 for(const [path,bytes] of before){expect(Buffer.from(originalDownload(opened,path).bytes)).toEqual(bytes);expect(f.files.get(path)).toEqual(bytes)}
 const derived=derivedDownload(opened);expect(derived.filename).toContain('derived');expect(JSON.parse(new TextDecoder().decode(derived.bytes))).toMatchObject({verified:false,integrity:'hash-only'})
 expect(()=>originalDownload(opened,'../outside')).toThrow();expect(()=>originalDownload(opened,'missing')).toThrow()
})
it.each(['torn','seq','unknown','duplicate','float','noncanonical','actor','after-close'])('rejects %s ledgers',async mode=>{
 const f=fixture()
 if(mode==='torn')f.files.set('ledger.jsonl',f.files.get('ledger.jsonl')!.subarray(0,-1))
 else if(mode==='duplicate')f.files.set('ledger.jsonl',Buffer.from(f.files.get('ledger.jsonl')!.toString().replace('"seq":1','"seq":1,"seq":1')))
 else if(mode==='float')f.files.set('ledger.jsonl',Buffer.from(f.files.get('ledger.jsonl')!.toString().replace('"seq":1','"seq":1.0')))
 else if(mode==='noncanonical')f.files.set('ledger.jsonl',Buffer.from(' '+f.files.get('ledger.jsonl')!.toString()))
 else{if(mode==='seq')f.events[1].seq=3;if(mode==='unknown')f.events[1].verified=true;if(mode==='actor')f.events[2].actor.kind='agent';if(mode==='after-close')f.add('agent.claim',{text:'after close'});f.sync()}
 await expect(openLocalFolder(entries(f.files))).rejects.toThrow()
})
it('matches the existing synthetic demo acceptance and original binary/text blobs',async()=>{
 const root='../demo/runs/demo-2',files=new Map<string,Buffer>()
 function walk(dir:string,prefix=''){for(const name of readdirSync(dir,{withFileTypes:true})){const path=prefix+name.name;if(name.isDirectory())walk(join(dir,name.name),path+'/');else files.set(path,readFileSync(join(dir,name.name)))}}
 walk(root);const opened=await openLocalFolder(entries(files));const manifest=JSON.parse(files.get('manifest.json')!.toString())
 expect(opened.doc.criteria.map(({criterion_id,text,evidence,status})=>({criterion_id,text,evidence,status}))).toEqual(manifest.acceptance)
})

function rechain(f:ReturnType<typeof fixture>){
 for(const [index,e] of f.events.entries()){
  e.seq=index+1;e.prev_hash=index?f.events[index-1].hash:'0'.repeat(64)
  if(e.type==='run.finished')e.payload.last_hash=e.prev_hash
  const {hash:_,...body}=e;e.hash=hash(canonical(body))
 }
 f.manifest.ledger_last_hash=f.events.at(-1).hash;f.sync()
}
it.each([null,'I could not finish.','Only the documentation is done.','Done.'])('does not invent a completion quote for claim %s',async text=>{
 const f=fixture()
 if(text!==null)f.events.splice(-1,0,{...f.events[0],id:'evt_claim',type:'agent.claim',actor:{kind:'agent',id:'synthetic'},payload:{claim_id:'claim_1',kind:'completion',text,criterion_ids:[]}})
 rechain(f)
 const before=new Map([...f.files].map(([path,bytes])=>[path,Buffer.from(bytes)]))
 const opened=await openLocalFolder(entries(f.files))
 expect(opened.doc.claims).toEqual(text===null?[]:[{claim_id:'claim_1',text,criterion_ids:[],finding:'claim_unwitnessed'}])
 expect(opened.doc).toMatchObject({verified:false,integrity:'hash-only',review_required:true})
 expect(JSON.parse(new TextDecoder().decode(derivedDownload(opened).bytes)).headline).toEqual(opened.doc.headline)
 for(const [path,bytes] of before)expect(Buffer.from(originalDownload(opened,path).bytes)).toEqual(bytes)
 expect(f.files).toEqual(before)
 expect(opened.doc.headline).toEqual(text===null?["Here's what this run actually proves."]:["Your agent made recorded claims.","Here's what's actually proven."])
})
it('rejects impossible UTC calendar dates even when hashes and manifest agree',async()=>{
 const f=fixture();f.events[0].ts='2026-02-31T00:00:00.000Z';rechain(f)
 await expect(openLocalFolder(entries(f.files))).rejects.toThrow(/timestamp/i)
})
it.each(['agent-confirmation','agent-witness','criterion-text','second-start'])('rejects semantic violation %s in a rehashed ledger',async mode=>{
 const f=fixture()
 if(mode==='agent-confirmation')f.events.splice(3,0,{...f.events[2],id:'evt_confirmation',type:'criteria.confirmed',actor:{kind:'agent',id:'synthetic'},payload:{criteria:[{criterion_id:'c1',text_sha256:f.events[2].payload.text_sha256}]}})
 if(mode==='agent-witness')f.events[4].actor.kind='agent'
 if(mode==='criterion-text')f.events[2].payload.text='Changed criterion'
 if(mode==='second-start')f.events[1].type='run.started'
 rechain(f);await expect(openLocalFolder(entries(f.files))).rejects.toThrow()
})
it('does not read unrelated files or trust their exported claims',async()=>{
 const f=fixture(),read=vi.fn(()=>{throw Error('Unrelated file must not be read')})
 const opened=await openLocalFolder([...entries(f.files),{path:'run.json',kind:'file',size:1,read}]);expect(read).not.toHaveBeenCalled();expect(opened.doc.verified).toBe(false)
})
it('rejects approvals expired by a microsecond in a rehashed ledger',async()=>{
 const f=fixture(),template=f.events[0],action_hash='a'.repeat(64)
 f.events.splice(-1,0,
  {...template,id:'evt_approval',actor:{kind:'human',id:'synthetic'},type:'approval.granted',payload:{action_hash,expires_at:'2026-10-25T00:00:00.000001Z'}},
  {...template,id:'evt_executed',ts:'2026-10-25T00:00:00.000002Z',type:'action.executed',payload:{action_hash,approval_event_id:'evt_approval'}})
 rechain(f)
 const outcome=await openLocalFolder(entries(f.files)).then(()=> 'accepted',error=>error.message)
 expect(outcome).toMatch(/expired/i)
})
