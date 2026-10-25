// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest'
import {act,cleanup,renderHook} from '@testing-library/react'
import {useWorkspaceNavigation} from '../src/workspace/use-workspace-navigation.ts'
import type {WorkspaceSource} from '../src/workspace/navigation-types.ts'
import {initialNavigationState,navigationReducer} from '../src/workspace/navigation-reducer.ts'
import {NAVIGATION_STORAGE_KEY,serializeNavigation} from '../src/workspace/navigation-storage.ts'
import run from '../fixtures/demo-run.json'
const sources:WorkspaceSource[]=['one','two'].map(sourceId=>({sourceId,label:sourceId,kind:'development-fixture',runs:new Map([[run.run.run_id,run]])}))
afterEach(()=>{cleanup();localStorage.clear();history.replaceState(null,'','/');vi.restoreAllMocks()})
it('canonicalizes the initial catalog and restores Back/Forward without loading a document',()=>{
 const catalogSources:WorkspaceSource[]=[{sourceId:'reader',label:'Reader',kind:'private-reader',runs:new Map()}]
 const {result}=renderHook(()=>useWorkspaceNavigation({sources:catalogSources}))
 const initialUrl=location.href
 expect(result.current.activeTab?.ref).toEqual({kind:'runs',sourceId:'reader'})
 expect(new URL(initialUrl).searchParams.get('view')).toBe('runs')
 act(()=>result.current.navigate({kind:'run',sourceId:'snapshot',runId:'one'},'claimed-vs-proven'))
 const forwardUrl=location.href,push=vi.spyOn(history,'pushState')
 history.replaceState(null,'',initialUrl)
 act(()=>window.dispatchEvent(new PopStateEvent('popstate')))
 expect(result.current.activeTab?.view).toBe('runs')
 history.replaceState(null,'',forwardUrl)
 act(()=>window.dispatchEvent(new PopStateEvent('popstate')))
 expect(result.current.activeTab?.view).toBe('claimed-vs-proven')
 expect(result.current.activeRun).toBeUndefined()
 expect(push).not.toHaveBeenCalled()
})
it('routes the same run ID by source and restores popstate without pushing history',()=>{
 history.replaceState({kept:true},'','/?source=one&run='+run.run.run_id+'&view=overview&filter=kept#anchor')
 const {result}=renderHook(()=>useWorkspaceNavigation({sources})),push=vi.spyOn(history,'pushState')
 act(()=>result.current.navigate({kind:'run',sourceId:'two',runId:run.run.run_id},'timeline'))
 expect(result.current.activeSource?.sourceId).toBe('two');expect(result.current.state.tabs).toHaveLength(2)
 expect(history.state).toEqual({kept:true});expect(location.hash).toBe('#anchor');expect(new URL(location.href).searchParams.get('filter')).toBe('kept');expect(push).toHaveBeenCalledTimes(1)
 history.replaceState(history.state,'','/?source=one&run='+run.run.run_id+'&view=overview')
 act(()=>window.dispatchEvent(new PopStateEvent('popstate')))
 expect(result.current.activeSource?.sourceId).toBe('one');expect(push).toHaveBeenCalledTimes(1)
 act(()=>result.current.dispatch({type:'toggle-pin',tabId:result.current.activeTab!.tabId}))
 expect(push).toHaveBeenCalledTimes(1)
})
it('reloads unavailable stored references without substituting or fetching a run',()=>{
 const state=navigationReducer(initialNavigationState(),{type:'open-run',ref:{kind:'run',sourceId:'missing',runId:'absent'},view:'overview'})
 localStorage.setItem(NAVIGATION_STORAGE_KEY,serializeNavigation(state));const fetch=vi.spyOn(globalThis,'fetch')
 const {result,unmount}=renderHook(()=>useWorkspaceNavigation({sources}));expect(result.current.activeTab?.ref.sourceId).toBe('missing');expect(result.current.activeRun).toBeUndefined();unmount()
 const second=renderHook(()=>useWorkspaceNavigation({sources}));expect(second.result.current.activeTab?.ref.sourceId).toBe('missing');expect(fetch).not.toHaveBeenCalled()
})
it('keeps all forty open tabs and visibly rejects restoring at capacity',()=>{
 let state=initialNavigationState();for(let i=0;i<40;i++)state=navigationReducer(state,{type:'open-run',ref:{kind:'run',sourceId:'one',runId:String(i)},view:'overview'})
 state=navigationReducer(state,{type:'close-tab',tabId:state.tabs[0].tabId,closedAt:1});state=navigationReducer(state,{type:'open-run',ref:{kind:'run',sourceId:'one',runId:'extra'},view:'overview'})
 localStorage.setItem(NAVIGATION_STORAGE_KEY,serializeNavigation(state));const {result}=renderHook(()=>useWorkspaceNavigation({sources}))
 act(()=>result.current.dispatch({type:'restore-closed',index:0}));expect(result.current.capacityError).toBe('open-tabs-limit');expect(result.current.state.tabs).toHaveLength(40);expect(result.current.state.closed).toHaveLength(1)
})
it('keeps malformed routes unavailable when only pin metadata changes',()=>{
 const state=navigationReducer(initialNavigationState(),{type:'open-run',ref:{kind:'run',sourceId:'one',runId:run.run.run_id},view:'overview'})
 localStorage.setItem(NAVIGATION_STORAGE_KEY,serializeNavigation(state));history.replaceState(null,'','/?source=incomplete')
 const {result}=renderHook(()=>useWorkspaceNavigation({sources}));expect(result.current.malformed).toBe(true)
 act(()=>result.current.dispatch({type:'toggle-pin',tabId:result.current.state.tabs[0].tabId}))
 expect(result.current.malformed).toBe(true);expect(result.current.activeRun).toBeUndefined()
 act(()=>result.current.dispatch({type:'select-tab',tabId:result.current.state.tabs[0].tabId}))
 expect(result.current.activeRun).toBe(run);expect(new URL(location.href).searchParams.get('run')).toBe(run.run.run_id)
})
it.each(['one','missing'])('restores the initial stored %s identity when returning to its history entry',sourceId=>{
 const state=navigationReducer(initialNavigationState(),{type:'open-run',ref:{kind:'run',sourceId,runId:run.run.run_id},view:'timeline'})
 localStorage.setItem(NAVIGATION_STORAGE_KEY,serializeNavigation(state));history.replaceState({kept:'yes'},'','/review?filter=kept#anchor')
 const {result}=renderHook(()=>useWorkspaceNavigation({sources}));const initialUrl=location.href
 expect(new URL(initialUrl).searchParams.get('source')).toBe(sourceId);expect(history.state).toEqual({kept:'yes'})
 act(()=>result.current.navigate({kind:'run',sourceId:'two',runId:run.run.run_id},'overview'))
 history.replaceState(history.state,'',initialUrl);const push=vi.spyOn(history,'pushState')
 act(()=>window.dispatchEvent(new PopStateEvent('popstate')))
 expect(result.current.activeTab?.ref.sourceId).toBe(sourceId);expect(result.current.activeTab?.view).toBe('timeline');expect(push).not.toHaveBeenCalled();expect(location.hash).toBe('#anchor');expect(new URL(location.href).searchParams.get('filter')).toBe('kept')
})
