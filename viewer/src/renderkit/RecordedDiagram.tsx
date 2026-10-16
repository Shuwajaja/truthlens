import { useState } from 'react';
import DOMPurify from 'dompurify';
import { allowedDiagram } from './diagram-policy.ts';

export function RecordedDiagram({ source }: { source: string }) {
  const [document, setDocument] = useState('');
  const [height, setHeight] = useState(180);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function render() {
    if (!allowedDiagram(source)) {
      setMessage('This preview supports text-only flowcharts without styling, links or configuration. The recorded source remains available.'); return;
    }
    setBusy(true); setMessage('');
    const id = 'diagram-' + crypto.randomUUID();
    const container = window.document.createElement('div');
    // Keep Mermaid measurement nodes separate and always remove them on failure.
    container.style.cssText = 'position:fixed;left:-100000px;top:0';
    window.document.body.append(container);
    try {
      const engine = import.meta.env.VITE_MCP_WIDGET ? null : await import('mermaid');
      if (!engine) throw Error('Diagram engine is available in the web app.');
      const mermaid = engine.default;
      mermaid.initialize({ startOnLoad:false, securityLevel:'strict', theme:'default', htmlLabels:false,
        maxTextSize:10000, maxEdges:200, flowchart:{htmlLabels:false}, suppressErrorRendering:true });
      const { svg } = await mermaid.render(id, source, container);
      const clean = DOMPurify.sanitize(svg, { USE_PROFILES:{svg:true,svgFilters:true},
        FORBID_TAGS:['foreignObject','script','a','image'], FORBID_ATTR:['href','xlink:href'] });
      const bounds = new DOMParser().parseFromString(clean, 'image/svg+xml').documentElement.getAttribute('viewBox')?.split(/\s+/).map(Number);
      setHeight(bounds && Number.isFinite(bounds[3]) ? Math.max(180, Math.min(420, bounds[3] + 40)) : 300);
      setDocument(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{margin:16px;font:16px system-ui;background:white;color:#17211b}svg{max-width:100%;min-width:480px;height:auto}</style>${clean}`);
    } catch { setMessage('This diagram could not be rendered. Read the original source below.'); }
    finally { container.remove(); setBusy(false); }
  }
  return <section className="rk-diagram" aria-label="Recorded diagram">
    {import.meta.env.VITE_MCP_WIDGET && <p>Open this document in the web app to render the diagram. Its source is available here.</p>}
    <button disabled={busy || !!import.meta.env.VITE_MCP_WIDGET} onClick={() => void render()}>{busy ? 'Rendering diagram…' : document ? 'Render again' : 'Show diagram'}</button>
    {message && <p role="status">{message}</p>}
    {document && <iframe style={{height}} title="Recorded diagram preview" sandbox="" referrerPolicy="no-referrer" srcDoc={document} />}
    <details open={!document}><summary>Diagram source</summary><pre>{source}</pre></details>
    <p className="rk-document-note">Diagram from recorded text. Connections shown here are not independently verified.</p>
  </section>;
}
