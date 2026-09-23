import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // Les noms personnalisés sont exposés uniquement parce qu’ils contiennent
  // des valeurs publiques destinées au navigateur.
  envPrefix: ['VITE_', 'supabaseurl', 'anonkey', 'Apikey', 'Clé API', 'clé anonyme', 'âne anonyme'],
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      input: {
        landing: resolve(root, 'index.html'),
        app: resolve(root, 'app.html'),
      },
    },
  },
})
