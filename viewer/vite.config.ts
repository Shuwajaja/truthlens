import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'evidence-graph', test: /node_modules[\\/](?:@xyflow|d3-[^\\/]+)[\\/]/, includeDependenciesRecursively: true }],
        },
      },
    },
  },
})
