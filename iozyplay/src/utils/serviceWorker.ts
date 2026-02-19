// Utilitaire pour gérer l'enregistrement du service worker

// Détecter si on est en mode développement
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'

export function registerServiceWorker() {
  // Ne pas enregistrer le service worker en développement pour éviter les problèmes de cache
  if (isDevelopment) {
    console.log('[SW] Development mode: Service Worker disabled to avoid cache issues')

    // Désinscrire le service worker s'il existe déjà et vider tous les caches
    if ('serviceWorker' in navigator) {
      // Désinscrire tous les service workers
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        const unregisterPromises = registrations.map((registration) => {
          return registration.unregister().then((success) => {
            if (success) {
              console.log('[SW] Unregistered service worker:', registration.scope)
            }
            return success
          })
        })

        Promise.all(unregisterPromises).then(() => {
          // Vider tous les caches
          if ('caches' in window) {
            ;(window.caches as CacheStorage).keys().then((cacheNames) => {
              const deletePromises = cacheNames.map((cacheName) => {
                return (window.caches as CacheStorage).delete(cacheName).then((success) => {
                  if (success) {
                    console.log('[SW] Deleted cache:', cacheName)
                  }
                  return success
                })
              })

              Promise.all(deletePromises).then(() => {
                console.log('[SW] All caches cleared')
              })
            })
          }
        })
      })
    }
    return
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Service Worker registered:', registration.scope)

          // Vérifier les mises à jour périodiquement
          setInterval(() => {
            registration.update()
          }, 60000) // Vérifier toutes les minutes

          // Écouter les mises à jour
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Nouveau service worker disponible
                  console.log('[SW] New service worker available')
                  // Optionnel : notifier l'utilisateur pour recharger la page
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('[SW] Service Worker registration failed:', error)
        })

      // Écouter les messages du service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[SW] Message from service worker:', event.data)
      })

      // Gérer les changements de contrôle
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true
          console.log('[SW] New service worker activated, reloading...')
          window.location.reload()
        }
      })
    })
  } else {
    console.warn('[SW] Service Workers are not supported in this browser')
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.unregister()
    })
  }
}
