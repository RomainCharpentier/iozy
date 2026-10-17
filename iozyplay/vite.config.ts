import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

// La version de package.json, compilée dans le fichier : affichée en pied de
// page (voir AppShell) pour savoir ce qui tourne sans ouvrir les réglages.
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string
}

export default defineConfig({
  plugins: [react()],
  // Le chemin sous lequel l'app est servie : '/' seul (Vercel, dev), ou
  // '/play/' quand le serveur Node la sert à côté d'IozyCore (voir
  // server/index.js et le Dockerfile). La même variable pilote le serveur.
  base: `${(process.env.IOZYPLAY_BASE_PATH ?? '').replace(/\/+$/, '')}/`,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: [],
  },
  server: {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
    hmr: {
      overlay: true,
    },
  },
  preview: {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  },
})
