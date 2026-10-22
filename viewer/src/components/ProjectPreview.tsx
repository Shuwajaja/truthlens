import type {RunDoc} from '../types.ts'
import type {DrawerTarget} from './Drawer.tsx'
import {Card} from './ui/card.tsx'
import {Button} from './ui/button.tsx'
import {Empty,EmptyDescription} from './ui/empty.tsx'
import {exportedHtmlArtifact} from './overview-data.ts'

// This is a static view of exported content, never a hosted/live application.
const policy="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'"
export function ProjectPreview({doc,onOpenDrawer}:{doc:RunDoc;onOpenDrawer:(target:DrawerTarget)=>void}){
 const preview=exportedHtmlArtifact(doc)
 return <Card className="panel project-preview" role="region" aria-label="Project preview">
  <div className="panel-heading"><h2>Project preview</h2></div>
  {!preview?<Empty><EmptyDescription>No project preview available.</EmptyDescription><p className="section-note">No supported HTML artifact with exported content.</p></Empty>:<>
   <p className="preview-path"><code>{preview.artifact.path}</code></p>
   <div className="preview-canvas" inert>
    <iframe title={`Project preview: ${preview.artifact.path}`} sandbox="" referrerPolicy="no-referrer" tabIndex={-1}
     srcDoc={`<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}">${preview.text}`}/>
   </div>
   <p className="section-note">Read-only preview of exported HTML.</p>
   <Button variant="outline" size="sm" onClick={()=>onOpenDrawer({kind:'artifact',artifact:preview.artifact,event:doc.events.find(e=>e.type==='artifact.recorded'&&e.payload.artifact_id===preview.artifact.artifact_id)})}>Open preview file record</Button>
  </>}
 </Card>
}
