export type Lens = 'client' | 'developer'

const STORAGE_KEY = 'tl-lens'

export function readLens(): Lens {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'developer') return 'developer'
  } catch {
    /* private mode */
  }
  return 'client'
}

export function writeLens(lens: Lens): void {
  try {
    localStorage.setItem(STORAGE_KEY, lens)
  } catch {
    /* private mode */
  }
}
