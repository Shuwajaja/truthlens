import { useState } from 'react'
import { Compass, PanelRightClose, PanelRightOpen, Send } from 'lucide-react'
import { Button } from './ui/button.tsx'
import { Separator } from './ui/separator.tsx'

const suggestions=['Welche Aussagen sind ohne Beleg?','Was wurde geändert?','Was braucht ein Review?']

/** Deliberately static UI. There is no transport, generated reply or enabled composer. */
export function Navigator() {
  const [open,setOpen]=useState(true)
  return <aside className="navigator-panel" data-open={open} aria-label="Navigator">
    <header className="navigator-header">
      <Compass size={20} className="text-primary shrink-0" aria-hidden="true" />
      <h2 className="navigator-title">Navigator</h2>
      <Button variant="ghost" size="icon-sm" aria-label={open?'Navigator einklappen':'Navigator ausklappen'} aria-expanded={open} aria-controls="navigator-content" onClick={()=>setOpen(value=>!value)}>
        {open?<PanelRightClose aria-hidden="true" />:<PanelRightOpen aria-hidden="true" />}
      </Button>
    </header>
    <div id="navigator-content" className="navigator-content" hidden={!open}>
      <div className="navigator-note" id="navigator-note"><p>Navigator kommt später</p><span>Fragen zum Lauf stellen und Belege gemeinsam durchgehen.</span></div>
      <Separator />
      <section aria-label="Statische Vorschläge"><h3>Fragen zum Lauf</h3><div className="navigator-suggestions">
        {suggestions.map(text=><Button key={text} variant="outline" disabled className="disabled:opacity-100">{text}</Button>)}
      </div></section>
      <div className="navigator-composer">
        <label htmlFor="navigator-message">Nachricht an Navigator</label>
        <textarea id="navigator-message" aria-describedby="navigator-note" disabled rows={3} placeholder="Fragen zum Lauf …" />
        <Button variant="secondary" disabled aria-label="Nachricht senden" size="icon" className="disabled:opacity-100"><Send aria-hidden="true" /></Button>
      </div>
    </div>
  </aside>
}
