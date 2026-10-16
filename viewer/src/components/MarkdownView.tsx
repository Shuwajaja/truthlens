import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RecordedDiagram } from '../renderkit/RecordedDiagram.tsx';
import './markdown-view.css';

export function MarkdownView({ text, controls = true }: { text: string; controls?: boolean }) {
  const [mode, setMode] = useState<'rendered' | 'source'>('rendered');
  return <div className="rk-document">
    {controls && <div className="rk-document-controls">
      <button aria-pressed={mode === 'rendered'} onClick={() => setMode('rendered')}>Rendered</button>
      <button aria-pressed={mode === 'source'} onClick={() => setMode('source')}>Source</button>
    </div>}
    {mode === 'source' ? <pre>{text}</pre> : <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml
      components={{
        // Links remain readable references; no arbitrary external navigation or fetch.
        a: ({ children, href }) => href?.startsWith('#user-content-') ? <a href={href}>{children}</a> : <span>{children}{href && <> ({href})</>}</span>,
        h1: ({children}) => <h2>{children}</h2>,
        input: ({checked}) => <input type="checkbox" checked={!!checked} disabled aria-label={checked ? 'Recorded task marked complete' : 'Recorded task not marked complete'} />,
        img: ({alt}) => <span className="rk-document-note">[Image reference: {alt || 'no description'} · open an imported image artifact to view it]</span>,
        table: ({children}) => <div className="tl-scroll" tabIndex={0} role="region" aria-label="Document table"><table>{children}</table></div>,
        pre: ({children}) => <div className="rk-code-block">{children}</div>,
        code: ({className,children}) => className === 'language-mermaid'
          ? <RecordedDiagram source={String(children).replace(/\n$/, '')} />
          : <code className={className}>{children}</code>,
      }}>{text}</ReactMarkdown>}
  </div>;
}
