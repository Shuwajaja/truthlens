// @vitest-environment jsdom
import '../browser-env.ts'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Drawer, type DrawerTarget } from '../../src/components/Drawer.tsx'
import { EvidenceGraph } from '../../src/components/EvidenceGraph.tsx'
import { buildEvidenceGraph } from '../../src/graph/evidence-graph.ts'
import type { RunDoc } from '../../src/types.ts'
import publicRun from '../../public/run.json'

const doc=publicRun as RunDoc
afterEach(cleanup)
function Harness({target}: {target: DrawerTarget}) {
  const [open,setOpen]=useState(false)
  return <><button type="button" onClick={()=>setOpen(true)}>Recorded trigger</button>{open&&<Drawer target={target} blobs={doc.blobs} trust={doc} lens="developer" onClose={()=>setOpen(false)} />}</>
}
describe('graph evidence and Sheet', () => {
  it('moves focus into Sheet, closes with Escape and restores the actual trigger', async () => {
    render(<Harness target={{kind:'event',event:doc.events[0]}} />)
    const trigger=screen.getByRole('button',{name:'Recorded trigger'})
    trigger.focus();fireEvent.click(trigger)
    const dialog=screen.getByRole('dialog',{name:'Event detail'})
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(within(dialog).getByText('Nur Hash · HMAC nicht geprüft')).toBeTruthy()
    expect(within(dialog).getByText('Integrität ≠ fachliche Freigabe')).toBeTruthy()
    fireEvent.keyDown(document.activeElement!,{key:'Escape'})
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(()=>expect(document.activeElement).toBe(trigger))
  })
  it('opens every actual graph record through its accessible list', () => {
    const targets: DrawerTarget[]=[]
    render(<EvidenceGraph doc={doc} onOpenDrawer={target=>targets.push(target)} />)
    fireEvent.click(screen.getByText('Alle Datensätze und Verknüpfungen als Liste'))
    const buttons=within(screen.getByRole('list',{name:'Graph-Datensätze'})).getAllByRole('button')
    const graph=buildEvidenceGraph(doc)
    expect(buttons).toHaveLength(graph.nodes.length)
    buttons.forEach((button,index)=>{fireEvent.click(button);expect(targets.at(-1)).toEqual(graph.nodes[index].target)})
  })
  it('shows a claim without an exported event as a claim, never invented proof', () => {
    render(<Drawer target={{kind:'claim',claim:doc.claims[1]}} trust={doc} lens="client" onClose={()=>{}} />)
    const dialog=screen.getByRole('dialog',{name:'Claim detail'})
    expect(within(dialog).getByText('Claim · claim_unwitnessed')).toBeTruthy()
    expect(within(dialog).getByText('Kein zugehöriges Ereignis exportiert.')).toBeTruthy()
    expect(dialog.querySelector('[data-variant=belegt]')).toBeNull()
  })
  it.each([true,false])('shows artifact content only if exported (present=%s), with HTML escaped', present => {
    render(<Drawer target={{kind:'artifact',artifact:doc.artifacts[0]}} blobs={present?doc.blobs:undefined} trust={doc} lens="developer" onClose={()=>{}} />)
    const dialog=screen.getByRole('dialog',{name:'File detail'})
    expect(within(dialog).getByText(doc.artifacts[0].sha256)).toBeTruthy()
    expect(dialog.querySelector('script')).toBeNull()
    if(present) expect(dialog.querySelector('pre')?.textContent).toBe(doc.blobs![doc.artifacts[0].sha256])
    else expect(within(dialog).getByText('Content not exported')).toBeTruthy()
  })
})
