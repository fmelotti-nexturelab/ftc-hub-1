import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

function swVersionPlugin() {
  return {
    name: 'sw-version',
    writeBundle() {
      const version = `ftc-hub-${Date.now()}`
      const swPath = path.resolve(__dirname, 'dist/sw.js')
      if (fs.existsSync(swPath)) {
        const content = fs.readFileSync(swPath, 'utf-8').replace('__SW_VERSION__', version)
        fs.writeFileSync(swPath, content)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), swVersionPlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['hub.nexturelab.com'],
    proxy: {
      '/api': { target: 'http://backend:8000', changeOrigin: true },
    },
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})