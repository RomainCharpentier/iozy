import { execSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Quel numéro porterait ce qu'on est en train d'écrire.
 *
 * En conteneur, le numéro vient du workflow (`ARG VERSION`, voir
 * .github/workflows/deploiement.yml) et cette fonction n'est jamais appelée -
 * `VITE_VERSION` est déjà posé, et l'image de build n'a de toute façon pas
 * git. Hors conteneur, il n'y avait RIEN : le pied de page disait « Version
 * dev », ce qui répond « je ne sais pas » à la seule question qu'il pose.
 *
 * Git, lui, sait : c'est le même `git rev-list --count` que la publication.
 *
 * Le suffixe `-dev` n'est pas décoratif. Un poste de travail a des
 * modifications non commises, et son numéro ne désigne donc AUCUNE image
 * publiée : afficher « 380 » tout court ferait passer un brouillon pour une
 * livraison, exactement ce que `ARG VERSION=dev` évitait jusqu'ici. « 380-dev »
 * dit les deux choses à la fois - de quel commit on part, et qu'on n'est pas
 * une livraison.
 */
function versionDuPosteDeTravail(): string {
  try {
    return `${execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim()}-dev`
  } catch {
    // Pas de git (archive téléchargée, dépôt absent) : ne rien inventer.
    return 'dev'
  }
}

// Vite expose les variables `VITE_` déjà présentes dans process.env : celle du
// conteneur gagne, et rien ne s'exécute quand elle est là.
process.env.VITE_VERSION ??= versionDuPosteDeTravail()

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
