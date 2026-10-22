import { useState } from 'react'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Button } from './ui/button.tsx'
import { Separator } from './ui/separator.tsx'

const suggestions=['Which claims have no evidence?','What changed?','What needs review?']

/** Deliberately static UI. There is no transport, generated reply or enabled composer. */
export function Navigator() {
  const [open,setOpen]=useState(true)
  return <aside className="navigator-panel" data-open={open} aria-label="Navigator">
    <header className="navigator-header">
      <h2 className="navigator-title">Navigator</h2>
      <Button variant="ghost" size="icon-sm" aria-label={open?'Collapse Navigator':'Expand Navigator'} aria-expanded={open} aria-controls="navigator-content" onClick={()=>setOpen(value=>!value)}>
        {open?<PanelRightClose aria-hidden="true" />:<PanelRightOpen aria-hidden="true" />}
      </Button>
    </header>
    <div id="navigator-content" className="navigator-content" hidden={!open}>
      <div className="navigator-note" id="navigator-note"><p>Navigator coming later</p><span>Ask about the run and review the evidence.</span></div>
      <Separator />
      <section aria-label="Example questions (static)"><h3>Questions about the run</h3><div className="navigator-suggestions">
        {suggestions.map(text=><Button key={text} variant="outline" disabled className="disabled:opacity-100">{text}</Button>)}
      </div></section>
      <div className="navigator-composer">
        <label htmlFor="navigator-message">Message Navigator</label>
        <textarea id="navigator-message" aria-describedby="navigator-note" disabled rows={3} placeholder="Questions about the run …" />
        <Button variant="secondary" disabled aria-label="Send message" className="disabled:opacity-100">Send message</Button>
      </div>
    </div>
  </aside>
}
