import { DiffView } from '../components/DiffView.tsx'
import { MarkdownView } from '../components/MarkdownView.tsx'
import { Timeline } from '../components/Timeline.tsx'
import { EventDetail } from '../components/EventDetail.tsx'
import { AgentStory } from './AgentStory.tsx'
import { isUnifiedDiff } from '../components/evidenceBlob.ts'
import type { Renderer } from './types.ts'

const ignoreDrawer = () => {}

/** Existing views, with the same content/path heuristics and no extra DOM wrappers. */
export const builtinRenderers: readonly Renderer[] = [
  {
    id: 'agent-story', label: 'Agent Story',
    match: input => input.kind === 'run' ? 10 : 0,
    Component: ({ input, context }) => input.kind === 'run' ? <AgentStory doc={input.doc} context={context} /> : null,
  },
  {
    id: 'diff', label: 'Diff',
    match: input => input.kind === 'blob' && (isUnifiedDiff(input.text) || input.mediaType === 'text/x-diff') ? 30 : 0,
    Component: ({ input }) => input.kind === 'blob' ? <DiffView text={input.text} /> : null,
  },
  {
    id: 'markdown', label: 'Markdown',
    match: input => input.kind === 'blob' && (input.path?.endsWith('.md') || input.mediaType === 'text/markdown') ? 20 : 0,
    Component: ({ input }) => input.kind === 'blob' ? <MarkdownView text={input.text} /> : null,
  },
  {
    id: 'plain-text', label: 'Plain text',
    match: input => input.kind === 'blob' && input.mediaType === 'text/plain' ? 10 : 0,
    Component: ({ input }) => input.kind === 'blob' ? (
      <pre tabIndex={0} className="text-xs font-mono bg-bg p-4 rounded-lg overflow-x-auto border border-border whitespace-pre-wrap">
        {input.text}
      </pre>
    ) : null,
  },
  {
    id: 'timeline', label: 'Timeline',
    match: input => input.kind === 'events' ? 10 : 0,
    Component: ({ input, context }) => input.kind === 'events' ? (
      <Timeline headingLevel={context?.headingLevel} events={input.events} lens={context?.lens ?? 'client'} onOpenDrawer={context?.onOpenDrawer ?? ignoreDrawer} />
    ) : null,
  },
  {
    id: 'event-detail', label: 'Event detail',
    match: input => input.kind === 'event' ? 10 : 0,
    Component: ({ input, context }) => input.kind === 'event' ? (
      <EventDetail evt={input.event} blobs={context?.blobs} lens={context?.lens ?? 'client'} />
    ) : null,
  },
]
