import {PageHeading} from '../components/PageHeading.tsx'
import {Card} from '../components/ui/card.tsx'
import {Button} from '../components/ui/button.tsx'
import {Empty,EmptyDescription} from '../components/ui/empty.tsx'
import type { RunDoc } from '../types.ts'
import type { RenderContext } from './types.ts'
import { buildStory } from './story.ts'

/** A lens over the recorded events, not an additional verification or acceptance result. */
export function AgentStory({ doc, context }: { doc: RunDoc; context?: RenderContext }) {
  const steps = buildStory(doc)
  const developer = context?.lens === 'developer'
  return (
    <section>
      <PageHeading title="Agent Story" description="Read the recorded actions and claims; inspect their original events."/>
      <p className="text-sm text-2 border border-border rounded-lg p-4 mb-4">
        Review required — technical checks do not replace human acceptance.
      </p>
      {steps.length === 0 ? <Empty><EmptyDescription>No recorded story events.</EmptyDescription></Empty> : (
        <ol aria-label="Recorded story" className="space-y-4">
          {steps.map(step => (
            <Card key={step.event.id} asChild><li>
              <h2 className={`text-base font-medium ${step.kind === 'claim' ? 'text-open' : 'text-foreground'}`}>{step.title}</h2>
              <p className="text-sm mt-2 break-words">{step.text}</p>
              {step.kind === 'claim' && (
                <div className="flex flex-wrap gap-2 text-xs text-open mt-2">
                  <span>claimed</span>
                  <span className="break-all">{step.finding ?? 'Finding not exported'}</span>
                </div>
              )}
              {step.criteria.length > 0 && (
                <ul className="text-sm mt-2 space-y-2" aria-label="Related criteria">
                  {step.criteria.map(criterion => (
                    <li key={criterion.criterion_id}>
                      {criterion.text} —<span className={`ml-2 ${step.kind === 'claim' ? 'text-2'
                        : criterion.status === 'met' ? 'text-ok' : criterion.status === 'unmet' ? 'text-fail' : 'text-2'}`}>{criterion.status}</span>
                    </li>
                  ))}
                </ul>
              )}
              {developer && (
                <p className="font-mono text-xs text-2 mt-2 break-all">
                  #{step.event.seq} · {step.event.type} · {step.event.id}
                </p>
              )}
              <Button variant="outline" size="sm" className="mt-2"
                onClick={() => context?.onOpenDrawer?.({ kind: 'event', event: step.event })}>
                {developer ? `View event #${step.event.seq}` : 'View recorded event'}
              </Button>
            </li></Card>
          ))}
        </ol>
      )}
    </section>
  )
}
