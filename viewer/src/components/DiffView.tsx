function diffLineClass(line: string): string {
  if (line.startsWith('@@')) return 'text-2'
  if (line.startsWith('+++') || line.startsWith('---')) return 'font-semibold text-foreground'
  if (line.startsWith('diff --git')) return 'font-semibold text-foreground'
  if (line.startsWith('+')) return 'bg-ok/15 text-ok'
  if (line.startsWith('-')) return 'bg-fail/15 text-fail'
  return 'text-foreground'
}

export function DiffView({ text }: { text: string }) {
  const lines = text.split(/\r?\n/)
  return (
    <pre className="text-xs font-mono bg-bg p-3 rounded-lg overflow-x-auto border border-border">
      <code>
        {lines.map((line, i) => (
          <div key={i} className={diffLineClass(line)}>
            {line || '\u00a0'}
          </div>
        ))}
      </code>
    </pre>
  )
}
