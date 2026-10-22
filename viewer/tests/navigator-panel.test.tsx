// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Navigator } from '../src/components/Navigator.tsx'

afterEach(()=>{cleanup();vi.unstubAllGlobals()})

describe('static Navigator', () => {
  it('shows disabled suggestions and a labelled disabled input with the future-feature note', () => {
    render(<Navigator />)
    expect(screen.getByText('Navigator coming later')).toBeTruthy()
    const input=screen.getByRole('textbox',{name:'Message Navigator'}) as HTMLTextAreaElement
    expect(input.disabled).toBe(true)
    expect(input.getAttribute('aria-describedby')).toBe('navigator-note')
    expect(input.value).toBe('')
    for(const name of ['Which claims have no evidence?','What changed?','What needs review?']) expect((screen.getByRole('button',{name}) as HTMLButtonElement).disabled).toBe(true)
  })
  it('collapses and expands accessibly, keeping focus on the real toggle', () => {
    render(<Navigator />)
    const toggle=screen.getByRole('button',{name:'Collapse Navigator'})
    toggle.focus();fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(document.activeElement).toBe(toggle)
    fireEvent.click(screen.getByRole('button',{name:'Expand Navigator'}))
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('textbox')).toBeTruthy()
    expect(document.activeElement).toBe(toggle)
  })
  it('never requests or invents a response while interacting with the UI', () => {
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch)
    render(<Navigator />)
    fireEvent.click(screen.getByRole('button',{name:'Which claims have no evidence?'}))
    fireEvent.click(screen.getByRole('button',{name:'Send message'}))
    fireEvent.click(screen.getByRole('button',{name:'Collapse Navigator'}))
    fireEvent.click(screen.getByRole('button',{name:'Expand Navigator'}))
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByRole('log')).toBeNull()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
  })
})
