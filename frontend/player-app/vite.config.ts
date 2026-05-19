import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 20102,
    proxy: {
      '/api': {
        target: 'http://localhost:21101',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:21101',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    // Keep Vite's default chunk graph and hashed asset names so each deploy
    // points to a fresh bundle while index.html stays no-cache.
    minify: 'esbuild',
    cssCodeSplit: false,
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
})
