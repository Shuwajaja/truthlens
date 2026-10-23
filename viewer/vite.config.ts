import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {readFile} from 'node:fs/promises'

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name:'local-development-fixture',
    apply:'serve',
    configureServer(server){
      server.middlewares.use('/run.json',async(req,res,next)=>{
        if(req.url!=='/'&&req.url!==''){next();return}
        if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.end();return}
        try{
          const bytes=await readFile(new URL('./fixtures/demo-run.json',import.meta.url))
          res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store')
          res.end(req.method==='HEAD'?undefined:bytes)
        }catch{res.statusCode=500;res.end('Development fixture unavailable')}
      })
    },
  }],
  server:{host:'127.0.0.1'},
  define: {
    'import.meta.env.TRUTHLENS_PREVIEW_TOOLBAR': JSON.stringify(process.env.VERCEL_ENV === 'preview'),
  },
  build: {
    rolldownOptions: {
      input: { main: "index.html", widget: "widget.html" },
      output: {
        codeSplitting: {
          groups: [{ name: 'evidence-graph', test: /node_modules[\\/](?:@xyflow|d3-[^\\/]+)[\\/]/, includeDependenciesRecursively: true }],
        },
      },
    },
  },
})
