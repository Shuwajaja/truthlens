// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Navigator } from '../src/components/Navigator.tsx'

afterEach(()=>{cleanup();vi.unstubAllGlobals()})

describe('static Navigator', () => {
  it('shows disabled suggestions and a labelled disabled input with the future-feature note', () => {
    render(<Navigator />)
    expect(screen.getByText('Navigator kommt später')).toBeTruthy()
    const input=screen.getByRole('textbox',{name:'Nachricht an Navigator'}) as HTMLTextAreaElement
    expect(input.disabled).toBe(true)
    expect(input.getAttribute('aria-describedby')).toBe('navigator-note')
    expect(input.value).toBe('')
    for(const name of ['Welche Aussagen sind ohne Beleg?','Was wurde geändert?','Was braucht ein Review?']) expect((screen.getByRole('button',{name}) as HTMLButtonElement).disabled).toBe(true)
  })
  it('collapses and expands accessibly, keeping focus on the real toggle', () => {
    render(<Navigator />)
    const toggle=screen.getByRole('button',{name:'Navigator einklappen'})
    toggle.focus();fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(document.activeElement).toBe(toggle)
    fireEvent.click(screen.getByRole('button',{name:'Navigator ausklappen'}))
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('textbox')).toBeTruthy()
    expect(document.activeElement).toBe(toggle)
  })
  it('never requests or invents a response while interacting with the UI', () => {
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch)
    render(<Navigator />)
    fireEvent.click(screen.getByRole('button',{name:'Welche Aussagen sind ohne Beleg?'}))
    fireEvent.click(screen.getByRole('button',{name:'Nachricht senden'}))
    fireEvent.click(screen.getByRole('button',{name:'Navigator einklappen'}))
    fireEvent.click(screen.getByRole('button',{name:'Navigator ausklappen'}))
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByRole('log')).toBeNull()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
  })
})
