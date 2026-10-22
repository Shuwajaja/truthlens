import { useState, type ReactNode } from 'react'

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'code'; text: string }

function parseBlocks(source: string): Block[] {
  const lines = source.split(/\r?\n/)
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i++
      continue
    }
    if (line.startsWith('```')) {
      i++
      const buf: string[] = []
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      if (i < lines.length) i++
      blocks.push({ kind: 'code', text: buf.join('\n') })
      continue
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] })
      i++
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push({ kind: 'ul', items })
      continue
    }
    const para: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !/^[-*]\s+/.test(lines[i]) && !lines[i].startsWith('```')) {
      para.push(lines[i])
      i++
    }
    blocks.push({ kind: 'para', text: para.join(' ') })
  }
  return blocks
}

/** Inline: emphasis, `code`, [label](url) → React elements (no raw HTML). */
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      parts.push(
        <code key={key++} className="font-mono text-xs bg-surface-2 px-2 rounded border border-border">
          {m[1]}
        </code>,
      )
    } else if (m[2] !== undefined) {
      parts.push(`${m[2]} (${m[3]})`)
    } else if (m[4] !== undefined) {
      parts.push(<strong key={key++}>{renderInline(m[4])}</strong>)
    } else if (m[5] !== undefined) {
      parts.push(<em key={key++}>{renderInline(m[5])}</em>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : [text]
}

function RenderedMarkdown({ source }: { source: string }) {
  const blocks = parseBlocks(source)
  return (
    <div className="text-sm space-y-4 text-foreground">
      {blocks.map((b, i) => {
        if (b.kind === 'heading') {
          const sizes = ['text-xl', 'text-lg', 'text-base', 'text-sm', 'text-sm', 'text-xs']
          const cls = sizes[Math.min(b.level - 1, sizes.length - 1)]
          return (
            <div key={i} className={`font-semibold ${cls}`}>
              {renderInline(b.text)}
            </div>
          )
        }
        if (b.kind === 'para') {
          return <p key={i}>{renderInline(b.text)}</p>
        }
        if (b.kind === 'ul') {
          return (
            <ul key={i} className="list-disc pl-6 space-y-2">
              {b.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          )
        }
        return (
          <pre
            tabIndex={0}
            key={i}
            className="text-xs font-mono bg-bg p-4 rounded-lg overflow-x-auto border border-border"
          >
            {b.text}
          </pre>
        )
      })}
    </div>
  )
}

export function MarkdownView({ text }: { text: string }) {
  const [mode, setMode] = useState<'rendered' | 'source'>('rendered')
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          className={`text-xs px-2 py-2 rounded border ${mode === 'rendered' ? 'border-2 text-foreground' : 'border-border text-2'}`}
          onClick={() => setMode('rendered')}
        >
          Rendered
        </button>
        <button
          type="button"
          className={`text-xs px-2 py-2 rounded border ${mode === 'source' ? 'border-2 text-foreground' : 'border-border text-2'}`}
          onClick={() => setMode('source')}
        >
          Source
        </button>
      </div>
      {mode === 'rendered' ? (
        <RenderedMarkdown source={text} />
      ) : (
        <pre tabIndex={0} className="text-xs font-mono bg-bg p-4 rounded-lg overflow-x-auto border border-border whitespace-pre-wrap">
          {text}
        </pre>
      )}
    </div>
  )
}
