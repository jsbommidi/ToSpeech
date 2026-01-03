import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 1310,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:1311',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://localhost:1311',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:1311',
        changeOrigin: true,
      },
      '/register': {
        target: 'http://localhost:1311',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})

