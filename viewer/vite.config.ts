import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { allowedHosts: ['terminal.local'] },
  build: {
    rollupOptions: {
      input: { app: 'index.html', widgets: 'demo-widgets.html' },
    },
  },
})
