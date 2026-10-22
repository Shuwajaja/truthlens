// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,it,expect,vi} from 'vitest'
import {cleanup,render,screen,within,fireEvent} from '@testing-library/react'
import App from '../src/App.tsx'
import publicRun from '../public/run.json'
afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals()})
it('opens a real test event from the evidence rail and preserves trust boundaries',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(publicRun)})))
 render(<App/>);await screen.findByRole('main');
 const rail=within(screen.getByRole('complementary',{name:'Evidence drawer'}));
 const event=publicRun.events[13];
 fireEvent.click(rail.getByRole('button',{name:name=>name.includes(event.summary)&&name.includes(`#${event.seq} · ${event.type}`)}));
 const dialog=within(screen.getByRole('dialog',{name:'Event detail'}));
 expect(dialog.getByText(event.summary)).toBeTruthy();
 expect(dialog.getByText('Hash only · signature not checked')).toBeTruthy();
 expect(dialog.getByText('Integrity is not approval')).toBeTruthy();
})

it('filters real test and artifact records without inventing entries',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(publicRun)})))
 render(<App/>);await screen.findByRole('main');
 const rail=within(screen.getByRole('complementary',{name:'Evidence drawer'}));
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
