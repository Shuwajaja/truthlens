import { RawFallback } from './RawFallback.tsx'
import { isRenderInput, type Renderer } from './types.ts'

const raw: Renderer = { id: 'raw', label: 'Raw data', match: () => 0, Component: RawFallback }

export interface Registry {
  select(input: unknown): Renderer
  listRenderers(): Renderer[]
}

/** Registration order is captured once; a tie never replaces the earlier renderer. */
export function createRegistry(renderers: readonly Renderer[] = []): Registry {
  const registered = [...renderers]
  return {
    select(input) {
      if (!isRenderInput(input)) return raw
      let selected = raw
      let best = 0
      for (const renderer of registered) {
        try {
          const score = renderer.match(input)
          if (Number.isFinite(score) && score > best) { best = score; selected = renderer }
        } catch {
          // A broken rule cannot prevent the safe fallback or a later valid match.
        }
      }
      return selected
    },
    listRenderers: () => [...registered, raw],
  }
}

/** Empty until existing views are explicitly migrated/registered in the next step. */
export const defaultRegistry = createRegistry()
