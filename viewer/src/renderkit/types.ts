import type { ComponentType } from 'react'
import type { RunDoc, RunEvent } from '../types.ts'
import type { Lens } from '../lens.ts'
import type { DrawerTarget } from '../components/Drawer.tsx'
import { validateRunDoc } from '../validateRunDoc.ts'

/** Presentation inputs contain recorded data; renderers must not modify or upgrade it. */
export type RenderInput =
  | { readonly kind: 'blob'; readonly mediaType: string; readonly path?: string; readonly text: string }
  | { readonly kind: 'event'; readonly event: RunEvent }
  | { readonly kind: 'events'; readonly events: readonly RunEvent[] }
  | { readonly kind: 'run'; readonly doc: RunDoc }

/** Presentation options and evidence lookup, kept separate from recorded RenderInput data. */
export interface RenderContext {
  readonly headingLevel?: 1 | 2
  readonly lens?: Lens
  readonly blobs?: Record<string, string>
  readonly onOpenDrawer?: (target: DrawerTarget) => void
}

export interface RendererProps { input: RenderInput; context?: RenderContext }

export interface Renderer {
  readonly id: string
  readonly label: string
  /** Pure, deterministic rule: zero means no match; higher finite positive scores win. */
  readonly match: (input: RenderInput) => number
  readonly Component: ComponentType<RendererProps>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEvent(value: unknown): value is RunEvent {
  return isRecord(value)
    && typeof value.seq === 'number' && Number.isInteger(value.seq) && value.seq > 0
    && ['id', 'ts', 'type', 'summary', 'hash'].every(key => typeof value[key] === 'string')
    && isRecord(value.actor) && typeof value.actor.kind === 'string' && typeof value.actor.id === 'string'
    && isRecord(value.payload)
}

/** Check the union at runtime so unknown/malformed input bypasses specialized renderers. */
export function isRenderInput(value: unknown): value is RenderInput {
  try {
    if (!isRecord(value)) return false
    switch (value.kind) {
      case 'blob':
        return typeof value.mediaType === 'string' && typeof value.text === 'string'
          && (value.path === undefined || typeof value.path === 'string')
      case 'event':
        return isEvent(value.event)
      case 'events':
        if (!Array.isArray(value.events)) return false
        for (const event of value.events) if (!isEvent(event)) return false
        return true
      case 'run':
        return validateRunDoc(value.doc)
      default:
        return false
    }
  } catch {
    return false
  }
}
