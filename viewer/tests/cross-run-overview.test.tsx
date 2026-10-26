// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import {RunsView} from '../src/workspace/RunsView.tsx'
import type {RunDoc} from '../src/types.ts'
import run from '../fixtures/demo-run.json'

afterEach(cleanup)
const source=(doc:RunDoc=structuredClone(run) as RunDoc)=>({sourceId:'source-a',label:'Loaded fixture',kind:'development-fixture' as const,runs:new Map([[doc.run.run_id,doc]])})
it('renders a real criterion headline, four accessible charts and opens the existing run reference',()=>{
 const onOpenRun=vi.fn(),doc=structuredClone(run) as RunDoc
 render(<RunsView sources={[source(doc)]} onOpenRun={onOpenRun}/> )
 expect(screen.getByText('TruthLens checks whether AI agents really did what they claim.')).toBeTruthy()
 expect(screen.getByText(`${doc.criteria.filter(c=>c.status==='met').length} of ${doc.criteria.length} criteria met`)).toBeTruthy()
 for(const name of ['Criteria met over recent runs','Criteria per run','Recorded evidence kinds','Criteria by agent'])expect(screen.getByRole('figure',{name})).toBeTruthy()
 expect(screen.getByText(/Overall run verdicts are not available/)).toBeTruthy()
 expect(screen.queryByText(/runs passed|signature checked/i)).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:name=>name.startsWith(doc.run.project)}))
 expect(onOpenRun).toHaveBeenCalledWith({kind:'run',sourceId:'source-a',runId:doc.run.run_id})
})
it('shows an honest empty state for sources with no documents and no example chart',()=>{
 render(<RunsView sources={[{...source(),runs:new Map()}]} onOpenRun={()=>{}}/> )
 expect(screen.getByText('No loaded runs to summarize.')).toBeTruthy()
 expect(screen.queryByRole('figure')).toBeNull()
 expect(screen.queryByText(/0 of 0/)).toBeNull()
 expect(screen.getByText(/Integrity is not approval/)).toBeTruthy()
})
it('summarizes loaded snapshots even when earlier catalog sources have empty caches',()=>{
 const empty={...source(),runs:new Map()}
 const sources=[...Array.from({length:200},()=>empty),source()]
 render(<RunsView sources={sources} onOpenRun={()=>{}}/> )
 expect(screen.getByRole('button',{name:name=>name.startsWith(run.run.project)})).toBeTruthy()
})
it('renders hostile recorded strings as text, retaining metadata and the local trust boundary',()=>{
 const doc=structuredClone(run) as RunDoc
 doc.run.project='<img src=x onerror=alert(1)>'
 doc.run.agent='<script>globalThis.pwned=true</script>'
 const {container}=render(<RunsView sources={[{...source(doc),kind:'local-folder'}]} onOpenRun={()=>{}}/> )
 expect(screen.getByRole('button',{name:name=>name.startsWith(doc.run.project)})).toBeTruthy()
 expect(container.querySelector('img,script')).toBeNull()
 expect(screen.getByText(/Local folders are unregistered. Not D34 admission/)).toBeTruthy()
 expect(within(screen.getByRole('figure',{name:'Criteria by agent'})).getByText(doc.run.agent)).toBeTruthy()
})
