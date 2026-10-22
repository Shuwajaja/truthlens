import { isRenderInput } from './types.ts'

const MAX_BYTES = 200 * 1024
const encoder = new TextEncoder()

function clip(text: string, limit: number) {
  const bytes = encoder.encode(text.slice(0, limit))
  // Streaming decode leaves a partial final UTF-8 character out instead of inventing a replacement.
  const output = new TextDecoder().decode(bytes.subarray(0, limit), { stream: true })
  return { text: output, bytes: encoder.encode(output).length, truncated: text.length > limit || bytes.length > limit }
}

interface Budget { bytes: number; nodes: number; truncated: boolean }

/** Copy a bounded preview without running getters/toJSON or following circular references. */
function preview(value: unknown, budget: Budget, ancestors: WeakSet<object>, depth = 0): unknown {
  if (budget.nodes-- <= 0 || budget.bytes <= 0 || depth > 32) {
    budget.truncated = true
    return '[Truncated]'
  }
  budget.bytes -= 8
  if (typeof value === 'string') {
    const result = clip(value, Math.max(0, budget.bytes))
    budget.bytes -= result.bytes
    budget.truncated ||= result.truncated
    return result.text
  }
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
  if (typeof value === 'bigint') return preview(`${value}n`, budget, ancestors, depth)
  if (typeof value === 'symbol') return preview(String(value), budget, ancestors, depth)
  if (typeof value === 'undefined') return '[undefined]'
  if (typeof value === 'function') return '[Function]'
  if (ancestors.has(value)) return '[Circular]'
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const result: unknown[] = []
      for (let index = 0; index < value.length; index++) {
        if (budget.nodes <= 0 || budget.bytes <= 0) { budget.truncated = true; break }
        const property = Object.getOwnPropertyDescriptor(value, String(index))
        result.push(!property ? preview(null, budget, ancestors, depth + 1)
          : preview('value' in property ? property.value : '[Accessor]', budget, ancestors, depth + 1))
      }
      return result
    }
    const result: Record<string, unknown> = Object.create(null)
    for (const key in value) {
      const property = Object.getOwnPropertyDescriptor(value, key)
      if (!property?.enumerable) continue
      if (budget.nodes <= 0 || budget.bytes <= 0) { budget.truncated = true; break }
      const name = clip(key, budget.bytes)
      if (name.truncated) { budget.truncated = true; break }
      budget.bytes -= name.bytes
      const child = 'value' in property ? preview(property.value, budget, ancestors, depth + 1) : '[Accessor]'
      // Null-prototype objects keep keys such as __proto__ as data.
      Object.defineProperty(result, key, { value: child, enumerable: true, configurable: true })
    }
    return result
  } finally {
    ancestors.delete(value)
  }
}

function format(input: unknown): { text: string; truncated: boolean } {
  try {
    const budget: Budget = { bytes: MAX_BYTES, nodes: 10_000, truncated: false }
    // Inspect only the bounded data copy, including envelope fields such as kind/text.
    const safeInput = preview(input, budget, new WeakSet())
    let value = safeInput
    if (isRenderInput(safeInput)) {
      switch (safeInput.kind) {
        case 'blob': value = safeInput.text; break
        case 'event': value = safeInput.event; break
        case 'events': value = safeInput.events; break
        case 'run': value = safeInput.doc; break
      }
    }
    if (typeof value === 'string') {
      const bounded = clip(value, MAX_BYTES)
      if (bounded.truncated || budget.truncated) return { text: bounded.text, truncated: true }
      try {
        const parsedBudget: Budget = { bytes: MAX_BYTES, nodes: 10_000, truncated: false }
        value = preview(JSON.parse(value), parsedBudget, new WeakSet())
        budget.truncated = parsedBudget.truncated
      } catch { return bounded }
    }
    const bounded = clip(JSON.stringify(value, null, 2), MAX_BYTES)
    return { text: bounded.text, truncated: budget.truncated || bounded.truncated }
  } catch {
    return { text: '[Unable to display raw data]', truncated: false }
  }
}

/** Escaped text only; output is capped at 200 KiB and never interpreted as HTML. */
export function RawFallback({ input }: { input: unknown }) {
  const output = format(input)
  return (
    <div>
      {output.truncated && <p className="text-sm text-2 mb-2">Truncated raw preview (maximum 200 KiB).</p>}
      <pre tabIndex={0} className="text-xs font-mono bg-bg p-4 rounded-lg overflow-x-auto border border-border whitespace-pre-wrap">
        {output.text}
      </pre>
    </div>
  )
}
