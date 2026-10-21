import { Component, type ReactNode } from 'react'
import { RawFallback } from './RawFallback.tsx'
import { defaultRegistry, type Registry } from './registry.ts'
import { isRenderInput, type RenderContext, type Renderer } from './types.ts'

interface BoundaryProps { input: unknown; renderer: Renderer; context?: RenderContext; children: ReactNode }
interface BoundaryState { failed: boolean; input: unknown; renderer: Renderer; context?: RenderContext }

class RendererBoundary extends Component<BoundaryProps, BoundaryState> {
  state = { failed: false, input: this.props.input, renderer: this.props.renderer, context: this.props.context }

  static getDerivedStateFromError() { return { failed: true } }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState) {
    if (state.input !== props.input || state.renderer !== props.renderer || state.context !== props.context) {
      return { failed: false, input: props.input, renderer: props.renderer, context: props.context }
    }
    return null
  }

  render() {
    if (this.state.failed) return (
      <>
        <p role="status" className="text-sm text-[#8b949e] mb-2">Could not render; showing raw data</p>
        <RawFallback input={this.props.input} />
      </>
    )
    return this.props.children
  }
}

/** Select a presentation only; statuses, findings and integrity stay in the input unchanged. */
export function RenderView({ input, registry = defaultRegistry, context }: { input: unknown; registry?: Registry; context?: RenderContext }) {
  if (!isRenderInput(input)) return <RawFallback input={input} />
  const renderer = registry.select(input)
  const Selected = renderer.Component
  return (
    <RendererBoundary input={input} renderer={renderer} context={context}>
      <Selected input={input} context={context} />
    </RendererBoundary>
  )
}
