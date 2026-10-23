// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest'
import {cleanup,render,screen,fireEvent} from '@testing-library/react'
import {Timeline} from '../src/components/Timeline.tsx'
import type {RunDoc} from '../src/types.ts'
import publicRun from '../fixtures/demo-run.json'
import {claimOnlyRun} from './fixtures/claimOnlyRun.ts'
afterEach(cleanup)
const doc=publicRun as RunDoc
it('groups real phases, measured gaps and consecutive claims while opening the exact event',()=>{
 const open=vi.fn();render(<Timeline events={[...doc.events].reverse()} lens="developer" onOpenDrawer={open}/>);
 expect(screen.getByRole('heading',{name:'01 Task'})).toBeTruthy();
 expect(screen.getByRole('heading',{name:'02 Result'})).toBeTruthy();
 expect(screen.getByText(/Gap between records 20.2 s/)).toBeTruthy();
 fireEvent.click(screen.getByText('3 claims'));
 expect(screen.getAllByRole('button')).toHaveLength(16);
 const button=screen.getByRole('button',{name:name=>name.includes(doc.events[13].summary)&&name.includes('#14 · test.reported')&&name.includes('+20,452 ms')});
 expect(button.closest('li')?.getAttribute('data-tone')).toBe('ok');
 fireEvent.click(button);expect(open).toHaveBeenLastCalledWith({kind:'event',event:doc.events[13]});
 expect(screen.getByText('+20,452 ms')).toBeTruthy();
})
it('keeps a claim-only timeline neutral and does not invent run events or an order phase',()=>{
 const {container}=render(<Timeline events={claimOnlyRun().events} lens="client" onOpenDrawer={()=>{}}/>);
 expect(screen.queryByRole('heading',{name:'01 Task'})).toBeNull();
 expect(screen.getAllByRole('button')).toHaveLength(1);
 expect(container.querySelector('.tone-ok')).toBeNull();
 expect(screen.getByText('+0 ms')).toBeTruthy();
})

it.each(['client','developer'] as const)('distinguishes human criteria confirmation from real test outcomes in %s',lens=>{
 const open=vi.fn(),confirmation=doc.events.find(event=>event.type==='criteria.confirmed')!;
 const event={...confirmation,summary:'Criteria met'};
 const before=JSON.stringify(event);
 render(<Timeline events={[event,...doc.events.filter(event=>event.type==='test.reported')]} lens={lens} onOpenDrawer={open}/>);
 const button=screen.getByRole('button',{name:/Criteria confirmed by human.*Confirmation is not a test result/});
 expect(button.closest('li')?.getAttribute('data-tone')).toBe('info');
 expect(screen.queryByText('Criteria met')).toBeNull();
 expect(document.querySelector('[data-tone="ok"]')).toBeTruthy();
 expect(document.querySelector('[data-tone="fail"]')).toBeTruthy();
 fireEvent.click(button);expect(open).toHaveBeenCalledWith({kind:'event',event});
 expect(open.mock.calls[0][0].event).toBe(event);
 expect(JSON.stringify(event)).toBe(before);
})
it('does not call a nonhuman criteria confirmation a human confirmation or passed test',()=>{
 const confirmation=doc.events.find(event=>event.type==='criteria.confirmed')!;
 render(<Timeline events={[{...confirmation,actor:{kind:'agent',id:'test-agent'}}]} lens="client" onOpenDrawer={()=>{}}/>);
 expect(screen.getByRole('button',{name:/Criteria confirmation recorded.*Confirmation is not a test result/})).toBeTruthy();
 expect(screen.queryByText('Criteria confirmed by human')).toBeNull();
 expect(document.querySelector('[data-tone="ok"]')).toBeNull();
})
