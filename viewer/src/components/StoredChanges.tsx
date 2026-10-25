import type {RunDoc} from '../types.ts'
import type {DrawerTarget} from './Drawer.tsx'
import {recordedDiff} from './overview-data.ts'
import {RenderView} from '../renderkit/RenderView.tsx'
import {Button} from './ui/button.tsx'
import {PageHeading} from './PageHeading.tsx'
export function StoredDiff({doc,onOpenDrawer}:{doc:RunDoc;onOpenDrawer?:(target:DrawerTarget)=>void}){
 const diff=recordedDiff(doc)
 return diff?<><p>Recorded unified diff. No before-file is reconstructed.</p><div className="stored-diff" role="region" aria-label="Stored unified diff" tabIndex={0}><RenderView input={{kind:'blob',mediaType:'text/x-diff',text:diff.text}}/></div>{onOpenDrawer&&<Button variant="outline" onClick={()=>onOpenDrawer({kind:'event',event:diff.event})}>Open diff event</Button>}</>:<p>No stored diff content available. Referenced blobs may be missing or not exported.</p>
}
export function StoredChanges({doc,onOpenDrawer}:{doc:RunDoc;onOpenDrawer:(target:DrawerTarget)=>void}){
 return <section className="evidence-review"><PageHeading title="Changes" description="Captured diff content for this snapshot."/><StoredDiff doc={doc} onOpenDrawer={onOpenDrawer}/></section>
}
