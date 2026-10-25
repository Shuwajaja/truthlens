import { createRoot } from 'react-dom/client'
import '../index.css'
import { RegistryWidget } from './Widget'
import {applyTheme,readTheme} from '../workspace/theme.ts'
applyTheme(readTheme())
const runId=new URLSearchParams(window.location.search).get('run_id')
createRoot(document.getElementById('root')!).render(<RegistryWidget runId={runId} />)
