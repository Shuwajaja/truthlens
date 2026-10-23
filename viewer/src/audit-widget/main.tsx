import { createRoot } from 'react-dom/client'
import '../index.css'
import { RegistryWidget } from './Widget'
const runId=new URLSearchParams(window.location.search).get('run_id')
createRoot(document.getElementById('root')!).render(<RegistryWidget runId={runId} />)
