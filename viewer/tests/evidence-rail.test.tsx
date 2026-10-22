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
 const rail=within(screen.getByRole('complementary',{name:'Beleg-Schublade'}));
 const event=publicRun.events[13];
 fireEvent.click(rail.getByRole('button',{name:`Beleg #${event.seq}: ${event.summary}`}));
 const dialog=within(screen.getByRole('dialog',{name:'Event detail'}));
 expect(dialog.getByText(event.summary)).toBeTruthy();
 expect(dialog.getByText('Nur Hash · HMAC nicht geprüft')).toBeTruthy();
 expect(dialog.getByText('Integrität ≠ fachliche Freigabe')).toBeTruthy();
})

it('filters real test and artifact records without inventing entries',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(publicRun)})))
 render(<App/>);await screen.findByRole('main');
 const rail=within(screen.getByRole('complementary',{name:'Beleg-Schublade'}));
 fireEvent.mouseDown(rail.getByRole('tab',{name:'Tests'}),{button:0,ctrlKey:false});
 expect(rail.getAllByRole('button',{name:/^Beleg #/})).toHaveLength(2);
 fireEvent.mouseDown(rail.getByRole('tab',{name:'Artefakte'}),{button:0,ctrlKey:false});
 fireEvent.click(rail.getByRole('button',{name:`Datei: ${publicRun.artifacts[0].path}`}));
 const dialog=within(screen.getByRole('dialog',{name:'File detail'}));
 expect(dialog.getByText(publicRun.artifacts[0].sha256)).toBeTruthy();
 fireEvent.mouseDown(dialog.getByRole('tab',{name:'Artefakte'}),{button:0,ctrlKey:false});
 fireEvent.click(dialog.getByRole('button',{name:'Datei öffnen'}));
 expect(dialog.getByRole('tab',{name:'Übersicht'}).getAttribute('aria-selected')).toBe('true');
 const file=screen.getByRole('dialog',{name:'File detail'});
 expect(file.querySelector('pre')?.textContent).toBe(publicRun.blobs[publicRun.artifacts[0].sha256]);
 fireEvent.mouseDown(dialog.getByRole('tab',{name:'Zeit'}),{button:0,ctrlKey:false});
 expect(file.querySelector('time')?.getAttribute('dateTime')).toBe(publicRun.events[12].ts);
})
