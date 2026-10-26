// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,it,expect,vi} from 'vitest'
import {cleanup,render,screen,within,fireEvent,waitFor} from '@testing-library/react'
import App from '../src/App.tsx'
import publicRun from '../fixtures/demo-run.json'
afterEach(()=>{cleanup();vi.unstubAllGlobals();localStorage.clear()})
it('opens real run metadata in the mobile sheet and restores the run trigger on Escape',async()=>{
 vi.stubGlobal('matchMedia',(query:string)=>({matches:!query.includes('min-width'),addEventListener(){},removeEventListener(){}}))
 vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(publicRun)})))
 history.replaceState(null,'','/?view=overview')
 render(<App/>);await screen.findByRole('main');fireEvent.click(screen.getByRole('button',{name:'Details',exact:true}));
 const navigation=screen.getByRole('button',{name:'Navigation',exact:true});navigation.focus();fireEvent.click(navigation);
 const trigger=screen.getByRole('button',{name:'Laufdetails',exact:true});
 trigger.focus();fireEvent.click(trigger);
 const dialog=screen.getByRole('dialog',{name:'Kontextinspektor'});
 const details=within(dialog);
 expect(details.getByText(publicRun.run.run_id)).toBeTruthy();
 expect(details.getByText(publicRun.run.command)).toBeTruthy();
 expect(details.getByText('Hash only · signature not checked')).toBeTruthy();
 expect(details.getByText('Integrity is not approval')).toBeTruthy();
 fireEvent.keyDown(document.activeElement!,{key:'Escape'});
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(document.activeElement).toBe(navigation);
 const criterion=screen.getByRole('button',{name:name=>name.startsWith('Evidence:')&&name.includes(publicRun.criteria[0].text)});
 fireEvent.click(criterion);fireEvent.click(screen.getByRole('button',{name:'Open criterion record'}));
 const evidence=within(screen.getByRole('dialog',{name:'Kontextinspektor'}));
 fireEvent.mouseDown(evidence.getByRole('tab',{name:'Tests'}),{button:0,ctrlKey:false});
 expect(evidence.getByText(publicRun.events[13].summary)).toBeTruthy();
})
