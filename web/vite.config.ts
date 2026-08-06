import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
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
