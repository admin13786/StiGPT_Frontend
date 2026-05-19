import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 20101,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:21101',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:21101',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    // Keep Vite's default chunk graph. The previous manual split created
    // circular vendor chunks and caused a production blank screen.
    minify: 'esbuild',
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
})
