import {PageHeading} from '../components/PageHeading.tsx'
import {Button} from '../components/ui/button.tsx'
import {Empty,EmptyDescription} from '../components/ui/empty.tsx'
import type { RunDoc } from '../types.ts'
import type { RenderContext } from './types.ts'
import { buildStory } from './story.ts'
import {groupRecordedPhases} from '../lib/recorded-steps.ts'
import {StepFacts,StepTime,RecordedOutput} from '../components/RecordedStep.tsx'
import {RecordedText} from '../components/RecordedText.tsx'
import {recordedTime,recordedDuration} from '../components/overview-data.ts'

/** A lens over the recorded events, not an additional verification or acceptance result. */
export function AgentStory({ doc, context }: { doc: RunDoc; context?: RenderContext }) {
  const steps = buildStory(doc)
  const phases=groupRecordedPhases(steps)
  const developer = context?.lens === 'developer'
  return (
    <section>
      <PageHeading title="Agent Story" description="Read the recorded actions and claims; inspect their original events."/>
      <p className="text-sm text-2 border border-border rounded-lg p-4 mb-4">
        Review required — technical checks do not replace human acceptance.
      </p>
      {steps.length === 0 ? <Empty><EmptyDescription>No recorded story events.</EmptyDescription></Empty> : (
        <ol aria-label="Recorded story" className="story-phases">
          {phases.map((phase,index)=><li key={phase.items[0].event.id}><section className="story-phase"><div className="phase-heading"><h2>{String(index+1).padStart(2,'0')} {phase.kind}</h2><p>{recordedTime(phase.items[0].event.ts)} · Span {recordedDuration(phase.items[0].event.ts,phase.items.at(-1)!.event.ts)}</p></div><ol className="story-steps">{phase.items.map(step => (
            <li key={step.event.id} className="story-step">
              <StepTime event={step.event}/>
              <h3 className={`step-title ${step.kind === 'claim' ? 'text-open' : 'text-foreground'}`}>{step.title}</h3>
              <StepFacts event={step.event}/>
              {!['started','finished','check','command'].includes(step.kind)&&<RecordedText text={step.text}/>}
              <RecordedOutput event={step.event} blobs={doc.blobs}/>
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
                <p className="developer-only font-mono text-xs text-2 mt-2 break-all">
                  <span className="developer-label">Developer</span> · #{step.event.seq} · {step.event.type} · {step.event.id}
                </p>
              )}
              <Button variant="outline" size="sm" className="mt-2"
                onClick={() => context?.onOpenDrawer?.({ kind: 'event', event: step.event })}>
                {developer ? `View event #${step.event.seq}` : 'View recorded event'}
              </Button>
            </li>
          ))}</ol></section></li>)}
        </ol>
      )}
    </section>
  )
}
