function diffLineClass(line: string): string {
  if (line.startsWith('@@')) return 'text-[#8b949e]'
  if (line.startsWith('+++') || line.startsWith('---')) return 'font-semibold text-[#e6edf3]'
  if (line.startsWith('diff --git')) return 'font-semibold text-[#e6edf3]'
  if (line.startsWith('+')) return 'bg-[#3fb950]/15 text-[#3fb950]'
  if (line.startsWith('-')) return 'bg-[#f85149]/15 text-[#f85149]'
  return 'text-[#e6edf3]'
}

export function DiffView({ text }: { text: string }) {
  const lines = text.split(/\r?\n/)
  return (
    <pre className="text-xs font-mono bg-[#0d1117] p-3 rounded-lg overflow-x-auto border border-[#30363d]">
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
