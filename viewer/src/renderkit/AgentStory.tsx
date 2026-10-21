import type { RunDoc } from '../types.ts'
import type { RenderContext } from './types.ts'
import { buildStory } from './story.ts'

/** A lens over the recorded events, not an additional verification or acceptance result. */
export function AgentStory({ doc, context }: { doc: RunDoc; context?: RenderContext }) {
  const steps = buildStory(doc)
  const developer = context?.lens === 'developer'
  return (
    <section>
      <h1 className="text-2xl font-bold mb-6">Agent Story</h1>
      <p className="text-sm text-[#8b949e] border border-[#30363d] rounded-lg p-3 mb-4">
        Review required — technical checks do not replace human acceptance.
      </p>
      {steps.length === 0 ? <p className="text-sm text-[#8b949e]">No recorded story events.</p> : (
        <ol aria-label="Recorded story" className="divide-y divide-[#30363d]">
          {steps.map(step => (
            <li key={step.event.id} className="py-4">
              <h2 className={`text-base font-medium ${step.kind === 'claim' ? 'text-[#d29922]' : 'text-[#e6edf3]'}`}>{step.title}</h2>
              <p className="text-sm mt-1 break-words">{step.text}</p>
              {step.kind === 'claim' && (
                <div className="flex flex-wrap gap-2 text-xs text-[#d29922] mt-2">
                  <span>claimed</span>
                  <span className="break-all">{step.finding ?? 'Finding not exported'}</span>
                </div>
              )}
              {step.criteria.length > 0 && (
                <ul className="text-sm mt-2 space-y-1" aria-label="Related criteria">
                  {step.criteria.map(criterion => (
                    <li key={criterion.criterion_id}>
                      {criterion.text} —<span className={`ml-1 ${step.kind === 'claim' ? 'text-[#8b949e]'
                        : criterion.status === 'met' ? 'text-[#3fb950]' : criterion.status === 'unmet' ? 'text-[#f85149]' : 'text-[#8b949e]'}`}>{criterion.status}</span>
                    </li>
                  ))}
                </ul>
              )}
              {developer && (
                <p className="font-mono text-xs text-[#8b949e] mt-2 break-all">
                  #{step.event.seq} · {step.event.type} · {step.event.id}
                </p>
              )}
              <button type="button" className="text-sm text-[#8b949e] underline mt-2 focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => context?.onOpenDrawer?.({ kind: 'event', event: step.event })}>
                {developer ? `View event #${step.event.seq}` : 'View recorded event'}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
