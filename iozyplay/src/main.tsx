import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App'
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
