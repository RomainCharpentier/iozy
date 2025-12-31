// Utilitaire pour gérer l'enregistrement du service worker

export function registerServiceWorker() {
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








