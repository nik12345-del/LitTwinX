import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/analyze': {
        target: 'http://localhost:8003',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8003',
        changeOrigin: true,
      },
      '/test': {
        target: 'http://localhost:8003',
        changeOrigin: true,
      }
    }
  }
})
