import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App'
import '@/styles/design-tokens.css'
import '@/styles/index.css'
import '@/styles/category-manager.css'
import '@/styles/category-selector.css'
import '@/styles/confirm-dialog.css'
import '@/styles/design-system.css'
import '@/styles/game-layout.css'
import '@/styles/answer-input.css'
import '@/styles/settings.css'
import '@/styles/settings-menu.css'
import '@/styles/responsive.css'
import '@/styles/logo.css'
import '@/styles/error-boundary.css'
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
