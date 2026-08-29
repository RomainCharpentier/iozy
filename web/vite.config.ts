import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // "localhost" seul laissait Vite n'écouter QUE sur l'IPv6 ([::1]) sur
    // cette machine (vérifié manuellement : `netstat` ne montrait aucun
    // listener sur le 127.0.0.1 IPv4) - le navigateur résolvant "localhost"
    // en IPv4 se voyait alors refuser la connexion. true = écoute sur
    // toutes les interfaces (0.0.0.0 ET ::), quelle que soit la résolution
    // DNS locale de "localhost".
    host: true,
    // Le backend (Spring Boot, docker compose) tourne sur :8080 sans CORS
    // structurant pour ce cas - toutes les requêtes /api passent par ce
    // proxy plutôt que par une URL absolue, donc le navigateur les voit
    // comme same-origin (voir backend/src/main/java/com/iozycore/api/config/CorsConfig.java
    // pour le filet de sécurité côté serveur, non requis ici).
    proxy: {
      '/api': {
        // Configurable pour les tests de bout en bout, qui font tourner leur
        // propre pile sur un autre port (voir backend/docker-compose.e2e.yml) :
        // sans ça, ils écriraient dans la base de tous les jours.
        target: process.env.IOZYCORE_API ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    // jsdom pour tout le monde : les modules purs n'en ont pas besoin, mais
    // deux environnements dans la même suite obligeraient à se demander, à
    // chaque nouveau fichier, dans lequel il tombe.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Pas de `globals: true` : `describe`/`it`/`expect` s'importent, comme
    // tout le reste du code de ce dépôt. Un test qui se lit sans savoir ce
    // que la configuration injecte se relit des mois plus tard.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
