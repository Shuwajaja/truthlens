import { Component, type ReactNode } from 'react'
import { RawFallback } from './RawFallback.tsx'
import { defaultRegistry, type Registry } from './registry.ts'
import { isRenderInput, type Renderer } from './types.ts'

interface BoundaryProps { input: unknown; renderer: Renderer; children: ReactNode }
interface BoundaryState { failed: boolean; input: unknown; renderer: Renderer }

class RendererBoundary extends Component<BoundaryProps, BoundaryState> {
  state = { failed: false, input: this.props.input, renderer: this.props.renderer }

  static getDerivedStateFromError() { return { failed: true } }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState) {
    if (state.input !== props.input || state.renderer !== props.renderer) {
      return { failed: false, input: props.input, renderer: props.renderer }
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
export function RenderView({ input, registry = defaultRegistry }: { input: unknown; registry?: Registry }) {
  if (!isRenderInput(input)) return <RawFallback input={input} />
  const renderer = registry.select(input)
  const Selected = renderer.Component
  return (
    <RendererBoundary input={input} renderer={renderer}>
      <Selected input={input} />
    </RendererBoundary>
  )
}
