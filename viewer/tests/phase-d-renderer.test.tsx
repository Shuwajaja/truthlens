// @vitest-environment jsdom
import './browser-env.ts'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import {StoredChanges} from '../src/components/StoredChanges.tsx'
import type {RunDoc} from '../src/types.ts'
import fixture from '../fixtures/demo-run.json'
vi.mock('../src/components/DiffView.tsx',()=>({DiffView:()=>{throw Error('Synthetic diff renderer failure')}}))
afterEach(()=>{cleanup();vi.restoreAllMocks()})
it('keeps captured diff data readable when the diff renderer fails',()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{})
 const {container}=render(<StoredChanges doc={fixture as RunDoc} onOpenDrawer={vi.fn()}/>)
 expect(screen.getByText('Could not render; showing raw data')).toBeTruthy()
 expect(container.querySelector('pre')?.textContent).toContain('diff --git')
 expect(screen.getByRole('button',{name:'Open diff event'})).toBeTruthy()
})
