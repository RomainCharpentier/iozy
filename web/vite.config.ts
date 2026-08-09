import { defineConfig } from 'vite'
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
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
