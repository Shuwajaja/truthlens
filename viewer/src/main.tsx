import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(<App />)

// Vite removes this branch and its chunks from every non-preview build.
if(import.meta.env.TRUTHLENS_PREVIEW_TOOLBAR){
  void import('./preview-toolbar.ts')
    .then(({mountPreviewToolbar})=>mountPreviewToolbar())
    .catch(()=>console.warn('Preview comments unavailable.'))
}
