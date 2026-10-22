// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,it,expect,vi} from 'vitest'
import {cleanup,render,screen,within,fireEvent,waitFor} from '@testing-library/react'
import App from '../src/App.tsx'
import publicRun from '../public/run.json'
afterEach(()=>{cleanup();vi.unstubAllGlobals();localStorage.clear()})
it('opens real run metadata in the mobile sheet and restores the run trigger on Escape',async()=>{
 vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}))
 vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(publicRun)})))
 render(<App/>);await screen.findByRole('main');
 const sections=['.status-grid','.criteria-panel','.project-preview','.criterion-detail','.timeline-panel'].map(selector=>document.querySelector(selector)!);
 for(let i=1;i<sections.length;i++)expect(sections[i-1].compareDocumentPosition(sections[i])&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 const trigger=screen.getByRole('button',{name:/^Open run:/});
 trigger.focus();fireEvent.click(trigger);
 const dialog=screen.getByRole('dialog',{name:'Run detail'});
 const details=within(dialog);
 expect(details.getByText(publicRun.run.run_id)).toBeTruthy();
 expect(details.getByText(publicRun.run.command)).toBeTruthy();
 expect(details.getByText('Hash only · signature not checked')).toBeTruthy();
 expect(details.getByText('Integrity is not approval')).toBeTruthy();
 fireEvent.keyDown(document.activeElement!,{key:'Escape'});
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(document.activeElement).toBe(trigger);
 const criterion=screen.getByRole('button',{name:name=>name.startsWith('Evidence:')&&name.includes(publicRun.criteria[0].text)});
 fireEvent.click(criterion);fireEvent.click(screen.getByRole('button',{name:'Open criterion record'}));
 const evidence=within(screen.getByRole('dialog',{name:'Evidence detail'}));
 fireEvent.mouseDown(evidence.getByRole('tab',{name:'Tests'}),{button:0,ctrlKey:false});
 expect(evidence.getByText(publicRun.events[13].summary)).toBeTruthy();
})
