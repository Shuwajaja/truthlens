// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RegistryWidget } from './Widget'
afterEach(cleanup)
it('defaults to disconnected with trust boundary visible and details closed', () => {
  render(<RegistryWidget runId={null} />)
  expect(screen.getByRole('heading', {name:'Audit status'})).toBeTruthy()
  expect(screen.getByText('Not connected')).toBeTruthy()
  expect(screen.getByText('Integrity is not approval')).toBeTruthy()
  expect(document.querySelector('details')).toBeNull()
  expect(screen.queryByText('Signature checked')).toBeNull()
})
