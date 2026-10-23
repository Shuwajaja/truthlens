export type ViewerTheme = 'petrol-porcelain' | 'cool-graphite'
export const themeKey = 'truthlens.theme'
export function readTheme(): ViewerTheme {
 try { return localStorage.getItem(themeKey) === 'cool-graphite' ? 'cool-graphite' : 'petrol-porcelain' }
 catch { return 'petrol-porcelain' }
}
export function applyTheme(theme: ViewerTheme) {
 document.documentElement.dataset.viewerTheme = theme
}
export function saveTheme(theme: ViewerTheme) {
 applyTheme(theme)
 try { localStorage.setItem(themeKey, theme) } catch { /* Presentation remains usable without storage. */ }
}
