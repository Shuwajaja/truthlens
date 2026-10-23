// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,it,expect,vi} from 'vitest'
import {cleanup,render,screen,within,fireEvent} from '@testing-library/react'
import App from '../src/App.tsx'
import {EvidenceTabs} from '../src/components/EvidenceRail.tsx'
import {Drawer,type DrawerTarget} from '../src/components/Drawer.tsx'
import {useState} from 'react'
import type {RunDoc} from '../src/types.ts'
import publicRun from '../fixtures/demo-run.json'
afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals()})
it('opens a real test event from Timeline without a duplicate shell rail',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(publicRun)})))
 render(<App/>);await screen.findByRole('main');
 fireEvent.click(within(screen.getByRole('navigation',{name:'Viewer navigation'})).getByRole('button',{name:'Timeline'}));
 expect(screen.queryByRole('complementary',{name:'Evidence drawer'})).toBeNull();
 const rail=within(screen.getByRole('main'));
 const event=publicRun.events[13];
 fireEvent.click(rail.getByRole('button',{name:name=>name.includes(event.summary)}));
 const dialog=within(screen.getByRole('region',{name:'Event detail'}));
 expect(dialog.getByText(event.summary)).toBeTruthy();
 expect(dialog.getByText('Hash only · signature not checked')).toBeTruthy();
 expect(dialog.getByText('Integrity is not approval')).toBeTruthy();
})

it('filters real test and artifact records without inventing entries',async()=>{
 function Harness(){const [target,setTarget]=useState<DrawerTarget|null>(null);return <><section aria-label="Recorded evidence"><EvidenceTabs doc={publicRun as RunDoc} onOpenDrawer={setTarget}/></section>{target&&<Drawer target={target} doc={publicRun as RunDoc} lens="client" trust={publicRun as RunDoc} blobs={publicRun.blobs} onOpenDrawer={setTarget} onClose={()=>setTarget(null)}/>}</>}
 render(<Harness/>);
 const rail=within(screen.getByRole('region',{name:'Recorded evidence'}));
 fireEvent.mouseDown(rail.getByRole('tab',{name:'Tests'}),{button:0,ctrlKey:false});
 expect(rail.getAllByRole('button',{name:/#\d+ · test\.reported$/})).toHaveLength(2);
 fireEvent.mouseDown(rail.getByRole('tab',{name:'Files'}),{button:0,ctrlKey:false});
 fireEvent.click(rail.getByRole('button',{name:name=>name.includes(publicRun.artifacts[0].path)&&name.includes(publicRun.artifacts[0].sha256)}));
 const dialog=within(screen.getByRole('dialog',{name:'File detail'}));
 expect(dialog.getByText(publicRun.artifacts[0].sha256)).toBeTruthy();
 fireEvent.mouseDown(dialog.getByRole('tab',{name:'Files'}),{button:0,ctrlKey:false});
 fireEvent.click(dialog.getByRole('button',{name:'Open file'}));
 expect(dialog.getByRole('tab',{name:'Overview'}).getAttribute('aria-selected')).toBe('true');
 const file=screen.getByRole('dialog',{name:'File detail'});
 expect(file.querySelector('pre')?.textContent).toBe(publicRun.blobs[publicRun.artifacts[0].sha256]);
 fireEvent.mouseDown(dialog.getByRole('tab',{name:'Time'}),{button:0,ctrlKey:false});
 expect(file.querySelector('time')?.getAttribute('dateTime')).toBe(publicRun.events[12].ts);
})
