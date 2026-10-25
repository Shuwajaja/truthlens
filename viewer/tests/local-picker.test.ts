import {expect,it,vi} from 'vitest'
import {directoryEntries,selectedEntries,type ReadHandle} from '../src/local-picker.ts'
const directory=(children:ReadHandle[]):ReadHandle=>({kind:'directory',name:'root',async *values(){yield* children}})
it('requests only file reads and rejects a surfaced symlink without invoking it',async()=>{
 const getFile=vi.fn();await expect(directoryEntries(directory([{kind:'symlink',name:'link',getFile}]))).rejects.toThrow(/regular|symlink/);expect(getFile).not.toHaveBeenCalled()
})
it('propagates native browser refusal of a filesystem link',async()=>{
 await expect(directoryEntries(directory([{kind:'file',name:'link',getFile:async()=>{throw new DOMException('Synthetic link refusal','NotAllowedError')}}]))).rejects.toThrow(/link refusal/)
})
it('bounds empty directories and rejects traversal in directory/file handle names',async()=>{
 await expect(directoryEntries(directory(Array.from({length:401},(_,n)=>({...directory([]),name:`d${n}`}))))).rejects.toThrow(/count/)
 for(const name of ['..','../outside','a/b','/absolute'])await expect(directoryEntries(directory([{...directory([]),name}]))).rejects.toThrow(/path/)
})
it('rejects mixed roots, flat and unsafe browser-relative selections',()=>{
 const file=(webkitRelativePath:string)=>({webkitRelativePath,size:1}) as File
 for(const files of [[file('flat')],[file('one/ledger.jsonl'),file('two/manifest.json')],[file('root/../outside')]])expect(()=>selectedEntries(files)).toThrow()
})
it('retains original browser file bytes without a writer API',async()=>{
 const bytes=new Uint8Array([255,0,13,10]),file={webkitRelativePath:'root/blobs/file',size:bytes.length,arrayBuffer:async()=>bytes.buffer} as File
 const [entry]=selectedEntries([file]);expect(entry.path).toBe('blobs/file');expect(await entry.read()).toEqual(bytes);expect(entry.kind).toBe('file')
})
