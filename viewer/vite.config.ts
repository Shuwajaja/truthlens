import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
