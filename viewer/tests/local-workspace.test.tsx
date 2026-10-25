// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import {webcrypto} from 'node:crypto'
import App from '../src/App.tsx'
import {fixture} from './fixtures/local-folder.mjs'
function directory(files:Map<string,Buffer>){
 const root={kind:'directory',name:'synthetic',async *values():AsyncGenerator<unknown>{
  const groups=new Map<string,Map<string,Buffer>>()
  for(const [path,data] of files){const [name,...rest]=path.split('/');if(!rest.length)yield {kind:'file',name,getFile:async()=>({size:data.length,arrayBuffer:async()=>Uint8Array.from(data).buffer})};else{if(!groups.has(name))groups.set(name,new Map());groups.get(name)!.set(rest.join('/'),data)}}
  for(const [name,files] of groups)yield {...directory(files),name}
 }};return root
}
afterEach(()=>{cleanup();localStorage.clear();history.replaceState(null,'','/');vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks()})
it('opens locally through existing tabs/evidence views without network, catalog, queue or persisted content',async()=>{
 vi.stubEnv('DEV',false);vi.stubGlobal('scrollTo',()=>{});vi.stubGlobal('crypto',webcrypto)
 const fetch=vi.fn(),f=fixture();vi.stubGlobal('fetch',fetch);vi.stubGlobal('showDirectoryPicker',vi.fn(async()=>directory(f.files)))
 render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Open local folder',exact:true}))
 await screen.findByRole('heading',{name:'Synthetic local folder',exact:true})
 expect(screen.getAllByText(/not authenticated/i).length).toBeGreaterThan(0)
 expect(screen.queryByText('Signature checked',{exact:true})).toBeNull()
 const navigation=within(screen.getByRole('navigation',{name:'Viewer navigation'}))
 fireEvent.click(navigation.getByRole('button',{name:'Changes',exact:true}));expect(await screen.findByRole('heading',{name:'Changes',exact:true})).toBeTruthy()
 expect(within(screen.getByRole('region',{name:'Workspace tabs'})).getAllByRole('button',{name:/^Select Changes/})).toHaveLength(1)
 expect(fetch).not.toHaveBeenCalled()
 const persisted=JSON.stringify({...localStorage});expect(persisted).not.toContain('Original evidence');expect(persisted).not.toContain('Synthetic agent');expect(persisted).not.toContain('blobs')
})
it('keeps the disconnected fallback and announces rejection of a damaged folder',async()=>{
 vi.stubEnv('DEV',false);vi.stubGlobal('crypto',webcrypto);const f=fixture();f.files.set('ledger.jsonl',Buffer.from('damaged'))
 vi.stubGlobal('showDirectoryPicker',vi.fn(async()=>directory(f.files)));vi.stubGlobal('fetch',vi.fn())
 render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Open local folder',exact:true}));await screen.findByRole('alert')
 expect(screen.getByRole('heading',{name:'Not connected',exact:true})).toBeTruthy();expect(screen.queryByText('Original downloads')).toBeNull()
})
