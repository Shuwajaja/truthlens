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
