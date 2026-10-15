import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App'
// Polices de la charte (auto-hébergées, mêmes graisses qu'IozyCore) :
// Space Grotesk pour les titres, Inter pour le texte. Voir docs/CHARTE.md.
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
// La charte de la famille Iozy (IozyKit), copie vendorisée : `npm run kit:sync`.
// Tokens d'abord : les styles de l'app sont des alias dessus.
import '../vendor/iozykit/css/tokens.css'
import '../vendor/iozykit/css/base.css'
import '../vendor/iozykit/css/components.css'
import '@/styles/main.scss'
import '@/services/settingsService'
import { registerServiceWorker } from '@/utils/serviceWorker'

// Désinscrire le service worker en développement AVANT de monter l'app
// pour éviter qu'il serve des anciennes versions en cache
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'

if (isDevelopment && 'serviceWorker' in navigator) {
  // Désinscrire immédiatement tous les service workers
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister()
    })
  })

  // Vider tous les caches
  if ('caches' in window) {
    ;(window.caches as CacheStorage).keys().then((cacheNames) => {
      cacheNames.forEach((cacheName) => {
        ;(window.caches as CacheStorage).delete(cacheName)
      })
    })
  }
}

// Enregistrer le service worker (sera désactivé en développement par la fonction)
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
